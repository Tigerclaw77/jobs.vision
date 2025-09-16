// backend/services/brandRegistry.js

function norm(s = "") { return s.trim().toLowerCase(); }
function normalizeDomain(raw = "") {
  const s = norm(raw)
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];
  return s;
}

/** Brand groups allow a single domain verification to cover multiple brands. */
const GROUPS = {
  walmart_inc: {
    label: "Walmart Inc.",
    domains: ["walmart.com", "samsclub.com"],
    brands: ["walmart_vision_center", "sams_club_optical"],
  },
  luxottica: {
    label: "EssilorLuxottica",
    // Keep this conservative; expand if you decide later
    domains: ["luxottica.com", "essilorluxottica.com", "targetoptical.com", "lenscrafters.com", "sunglasshut.com"],
    brands: ["target_optical", "lenscrafters", "sunglass_hut"],
  },
};

/** Canonical brand records */
const BRANDS = {
  walmart_vision_center: {
    key: "walmart_vision_center",
    label: "Walmart Vision Center",
    aliases: ["walmart", "walmart vision", "walmart vision center"],
    domains: ["walmart.com"],
    group: "walmart_inc",
  },
  sams_club_optical: {
    key: "sams_club_optical",
    label: "Sam's Club Optical",
    aliases: ["sam's club optical", "sams club optical", "sams optical", "sam's club"],
    domains: ["samsclub.com"],
    group: "walmart_inc",
  },
  target_optical: {
    key: "target_optical",
    label: "Target Optical",
    aliases: ["target optical", "target"],
    // Deliberately *not* including target.com unless you want Target HQ to qualify.
    domains: ["targetoptical.com"],
    group: "luxottica",
  },
  lenscrafters: {
    key: "lenscrafters",
    label: "LensCrafters",
    aliases: ["lenscrafters"],
    domains: ["lenscrafters.com"],
    group: "luxottica",
  },
  sunglass_hut: {
    key: "sunglass_hut",
    label: "Sunglass Hut",
    aliases: ["sunglass hut", "sgh"],
    domains: ["sunglasshut.com", "sgh.com"],
    group: "luxottica",
  },
  // add more as needed...
};

function allBrandKeys() { return Object.keys(BRANDS); }

function brandByKey(key) { return BRANDS[key] || null; }

function groupByKey(key) { return GROUPS[key] || null; }

/** Given text like "Walmart Vision Center", return the first matching brand key. */
function detectBrandKeyFromText(text = "") {
  const n = norm(text);
  if (!n) return null;
  for (const key of allBrandKeys()) {
    const b = BRANDS[key];
    if (b.aliases.some(a => n.includes(norm(a)))) return key;
  }
  return null;
}

/** Domains acceptable for verifying a given brand (brand.domains ∪ group.domains). */
function acceptedDomainsForBrand(key) {
  const b = brandByKey(key);
  if (!b) return [];
  const g = b.group ? groupByKey(b.group) : null;
  const set = new Set([...(b.domains || []), ...((g?.domains) || [])]);
  return Array.from(set);
}

module.exports = {
  normalizeDomain,
  detectBrandKeyFromText,
  acceptedDomainsForBrand,
  brandByKey,
  groupByKey,
};
