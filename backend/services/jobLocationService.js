const LOCATION_MAP_ERROR = "We couldn't map this location. Please check the city and state.";
const NOMINATIM_USER_AGENT = "jobs.vision imported job city geocoding repair";
let lastNominatimRequestAt = 0;

function requestError(statusCode, message, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function coordinateFrom(value, field, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) {
    throw requestError(400, LOCATION_MAP_ERROR, "invalid_job_location");
  }
  return n;
}

function providedCoordinatePair(fields = {}) {
  const hasLat = Object.prototype.hasOwnProperty.call(fields, "latitude");
  const hasLng = Object.prototype.hasOwnProperty.call(fields, "longitude");
  if (!hasLat && !hasLng) return undefined;

  const latBlank = fields.latitude == null || fields.latitude === "";
  const lngBlank = fields.longitude == null || fields.longitude === "";
  if (latBlank && lngBlank) return null;
  if (latBlank || lngBlank) {
    throw requestError(400, LOCATION_MAP_ERROR, "invalid_job_location");
  }

  return {
    latitude: coordinateFrom(fields.latitude, "latitude", -90, 90),
    longitude: coordinateFrom(fields.longitude, "longitude", -180, 180),
  };
}

const COUNTRY_TOKEN_PATTERN = /^(u\.?s\.?a?\.?|usa|united states|united states of america)$/i;
const US_STATE_NAMES = new Set([
  "alabama",
  "alaska",
  "arizona",
  "arkansas",
  "california",
  "colorado",
  "connecticut",
  "delaware",
  "florida",
  "georgia",
  "hawaii",
  "idaho",
  "illinois",
  "indiana",
  "iowa",
  "kansas",
  "kentucky",
  "louisiana",
  "maine",
  "maryland",
  "massachusetts",
  "michigan",
  "minnesota",
  "mississippi",
  "missouri",
  "montana",
  "nebraska",
  "nevada",
  "new hampshire",
  "new jersey",
  "new mexico",
  "new york",
  "north carolina",
  "north dakota",
  "ohio",
  "oklahoma",
  "oregon",
  "pennsylvania",
  "rhode island",
  "south carolina",
  "south dakota",
  "tennessee",
  "texas",
  "utah",
  "vermont",
  "virginia",
  "washington",
  "west virginia",
  "wisconsin",
  "wyoming",
  "district of columbia",
]);

function isCountryToken(value) {
  return COUNTRY_TOKEN_PATTERN.test(cleanText(value));
}

function normalizeStateValue(value) {
  const text = cleanText(value);
  if (/^[a-z]{2}$/i.test(text)) return text.toUpperCase();
  return text || null;
}

function normalizeCityValue(value) {
  const text = cleanText(value);
  if (/^du\s+bois$/i.test(text)) return "DuBois";
  return text || null;
}

function isLikelyUsState(value) {
  const text = cleanText(value);
  return /^[a-z]{2}$/i.test(text) || US_STATE_NAMES.has(text.toLowerCase());
}

function stripTrailingCountryParts(parts = []) {
  const next = [...parts];
  while (next.length && isCountryToken(next[next.length - 1])) {
    next.pop();
  }
  return next;
}

function normalizeCityStateLocation(location) {
  const text = cleanText(location);
  if (!text) return { city: null, state: null, location: null, geocodeAddress: null };

  const parts = stripTrailingCountryParts(
    text
      .split(",")
      .map((part) => cleanText(part))
      .filter(Boolean)
  );

  if (parts.length >= 3 && isLikelyUsState(parts[1])) {
    const state = normalizeStateValue(parts[1]);
    const city = normalizeCityValue(parts[0]);
    const streetAddress = parts.slice(2).join(", ");
    const normalizedLocation = [city, state].filter(Boolean).join(", ");
    return {
      city: city || null,
      state: state || null,
      location: normalizedLocation || text,
      geocodeAddress: [streetAddress, city, state].filter(Boolean).join(", ") || text,
    };
  }

  if (parts.length >= 2) {
    const state = normalizeStateValue(parts[parts.length - 1]);
    const cityParts = parts.slice(0, -1);
    if (cityParts.length > 1 && normalizeStateValue(cityParts[cityParts.length - 1]) === state) {
      cityParts.pop();
    }
    const city = normalizeCityValue(cityParts.join(", "));
    const normalizedLocation = [city, state].filter(Boolean).join(", ");
    return {
      city: city || null,
      state: state || null,
      location: normalizedLocation || text,
      geocodeAddress: normalizedLocation || text,
    };
  }

  return {
    city: parts[0] || text,
    state: null,
    location: parts[0] || text,
    geocodeAddress: parts[0] || text,
  };
}

function normalizeImportedLocationFields(fields = {}) {
  const location = cleanText(fields.location);
  const city = cleanText(fields.city);
  const state = cleanText(fields.state);
  const cityState = [city, state].filter(Boolean).join(", ");
  const candidates = [];

  if (city && (city.includes(",") || isCountryToken(state))) {
    candidates.push(cityState);
  }

  if (location) candidates.push(location);
  if (cityState) candidates.push(cityState);

  for (const candidate of candidates) {
    const normalized = normalizeCityStateLocation(candidate);
    if (normalized.city && normalized.state && !isCountryToken(normalized.state)) {
      return normalized;
    }
  }

  return normalizeCityStateLocation(candidates[0] || "");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForNominatimSlot() {
  const elapsed = Date.now() - lastNominatimRequestAt;
  if (elapsed < 1100) {
    await delay(1100 - elapsed);
  }
  lastNominatimRequestAt = Date.now();
}

function geocodeAddressForJob(fields = {}) {
  if (cleanText(fields.geocodeAddress)) return cleanText(fields.geocodeAddress);
  const location = normalizeCityStateLocation(fields.location);
  if (location.geocodeAddress && location.geocodeAddress !== location.location) {
    return location.geocodeAddress;
  }
  if (location.city && location.state) return `${location.city}, ${location.state}`;
  return cleanText([fields.city, fields.state].filter(Boolean).join(", ") || fields.location);
}

async function geocodeJobLocation(fields = {}) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
  const address = geocodeAddressForJob(fields);
  if (!apiKey || !address) return null;

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", address);
  url.searchParams.set("components", "country:US");
  url.searchParams.set("key", apiKey);

  let response;
  try {
    response = await fetch(url);
  } catch {
    throw requestError(400, LOCATION_MAP_ERROR, "job_location_not_mappable");
  }

  const data = await response.json().catch(() => null);
  const location = data?.results?.[0]?.geometry?.location;
  if (!response.ok || data?.status !== "OK" || !location) {
    throw requestError(400, LOCATION_MAP_ERROR, "job_location_not_mappable");
  }

  return {
    latitude: coordinateFrom(location.lat, "latitude", -90, 90),
    longitude: coordinateFrom(location.lng, "longitude", -180, 180),
  };
}

async function geocodeCityStateWithNominatim(fields = {}) {
  const location = normalizeImportedLocationFields(fields);
  if (!location.city || !location.state) return null;

  await waitForNominatimSlot();

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("city", location.city);
  url.searchParams.set("state", location.state);
  url.searchParams.set("country", "USA");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");

  let response;
  try {
    response = await fetch(url, {
      headers: {
        "User-Agent": NOMINATIM_USER_AGENT,
      },
    });
  } catch {
    return null;
  }

  if (!response.ok) return null;

  const data = await response.json().catch(() => null);
  const result = Array.isArray(data) ? data[0] : null;
  if (!result?.lat || !result?.lon) return null;

  return {
    latitude: coordinateFrom(result.lat, "latitude", -90, 90),
    longitude: coordinateFrom(result.lon, "longitude", -180, 180),
  };
}

async function geocodeFreeFormWithNominatim(fields = {}) {
  const location = normalizeImportedLocationFields(fields);
  const address = cleanText(fields.geocodeAddress || location.geocodeAddress || geocodeAddressForJob(fields));
  if (!address || address === location.location) return null;

  await waitForNominatimSlot();

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", /united states|usa/i.test(address) ? address : `${address}, USA`);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");

  let response;
  try {
    response = await fetch(url, {
      headers: {
        "User-Agent": NOMINATIM_USER_AGENT,
      },
    });
  } catch {
    return null;
  }

  if (!response.ok) return null;

  const data = await response.json().catch(() => null);
  const result = Array.isArray(data) ? data[0] : null;
  if (!result?.lat || !result?.lon) return null;

  return {
    latitude: coordinateFrom(result.lat, "latitude", -90, 90),
    longitude: coordinateFrom(result.lon, "longitude", -180, 180),
  };
}

async function resolveJobCoordinates(fields, { required = false } = {}) {
  const provided = providedCoordinatePair(fields);
  if (provided) return provided;

  const geocoded = await geocodeJobLocation(fields);
  if (geocoded) return geocoded;

  if (required) {
    throw requestError(400, LOCATION_MAP_ERROR, "job_location_not_mappable");
  }

  return null;
}

async function resolveImportedJobCoordinates(fields, { required = false } = {}) {
  const provided = providedCoordinatePair(fields);
  if (provided) return provided;

  let geocodeError = null;

  try {
    const googleGeocoded = await geocodeJobLocation(fields);
    if (googleGeocoded) return googleGeocoded;
  } catch (error) {
    geocodeError = error;
  }

  const fallbackGeocoded = await geocodeCityStateWithNominatim(fields);
  if (fallbackGeocoded) return fallbackGeocoded;

  const freeFormGeocoded = await geocodeFreeFormWithNominatim(fields);
  if (freeFormGeocoded) return freeFormGeocoded;

  if (required) {
    throw geocodeError || requestError(400, LOCATION_MAP_ERROR, "job_location_not_mappable");
  }

  return null;
}

module.exports = {
  LOCATION_MAP_ERROR,
  cleanText,
  coordinateFrom,
  geocodeCityStateWithNominatim,
  geocodeFreeFormWithNominatim,
  geocodeAddressForJob,
  geocodeJobLocation,
  isCountryToken,
  normalizeCityStateLocation,
  normalizeImportedLocationFields,
  providedCoordinatePair,
  resolveImportedJobCoordinates,
  resolveJobCoordinates,
};
