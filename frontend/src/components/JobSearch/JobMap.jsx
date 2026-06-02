import React, { useEffect, useRef, useState } from "react";

/* Normalize possible lat/lng shapes */
function getPosition(job) {
  const lat =
    job.lat ?? job.latitude ?? job?.coordinates?.lat ?? job?.geo?.lat ?? null;
  const lng =
    job.lng ?? job.longitude ?? job?.coordinates?.lng ?? job?.geo?.lng ?? null;

  const nLat = lat != null ? Number(lat) : NaN;
  const nLng = lng != null ? Number(lng) : NaN;
  if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) return null;
  return { lat: nLat, lng: nLng };
}

const DEFAULT_CENTER = { lat: 31.0, lng: -99.0 };
const DEFAULT_ZOOM = 5;

function getSearchCenter(center) {
  const lat = Number(center?.lat);
  const lng = Number(center?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function zoomForRadius(radiusMi) {
  const radius = Number(radiusMi) || 25;
  if (radius <= 10) return 11;
  if (radius <= 25) return 10;
  if (radius <= 50) return 9;
  if (radius <= 100) return 8;
  return 7;
}

const JobMap = ({
  jobs = [],
  onMarkerClick,
  showMap = true,
  apiKey,
  searchCenter = null,
  radiusMi = 25,
  hasActiveRadius = false,
}) => {
  const mapEl = useRef(null);
  const map = useRef(null);
  const geocoder = useRef(null);
  const markers = useRef([]);
  const geoCache = useRef(new Map());
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");

  // stable callback to avoid re-running marker effect
  const clickCbRef = useRef(onMarkerClick);
  useEffect(() => { clickCbRef.current = onMarkerClick; }, [onMarkerClick]);

  // load script once
  useEffect(() => {
    if (!showMap) return;
    if (window.google?.maps) { setLoadError(""); setReady(true); return; }
    if (!apiKey) {
      setLoadError("Google Maps API key is not configured.");
      setReady(false);
      return;
    }

    const id = "googleMaps";
    const existing = document.getElementById(id);
    if (existing) {
      existing.addEventListener("load", () => {
        if (window.google?.maps) {
          setLoadError("");
          setReady(true);
        } else {
          setLoadError("Google Maps script loaded without Maps support.");
        }
      }, { once: true });
      existing.addEventListener("error", () => {
        setLoadError("Google Maps script failed to load.");
      }, { once: true });
      return;
    }

    const previousAuthFailure = window.gm_authFailure;
    const authFailureHandler = () => {
      setLoadError("Google Maps authentication failed.");
      if (typeof previousAuthFailure === "function") previousAuthFailure();
    };
    window.gm_authFailure = authFailureHandler;

    const s = document.createElement("script");
    s.id = id; s.async = true; s.defer = true;
    s.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
    s.onload = () => {
      if (window.google?.maps) {
        setLoadError("");
        setReady(true);
      } else {
        setLoadError("Google Maps script loaded without Maps support.");
      }
    };
    s.onerror = () => {
      setLoadError("Google Maps script failed to load.");
    };
    document.body.appendChild(s);

    return () => {
      if (window.gm_authFailure === authFailureHandler) {
        window.gm_authFailure = previousAuthFailure;
      }
    };
  }, [apiKey, showMap]);

  // init map + geocoder
  useEffect(() => {
    if (!ready || !showMap || !mapEl.current || map.current) return;
    try {
      map.current = new window.google.maps.Map(mapEl.current, {
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        gestureHandling: "greedy",
      });
      geocoder.current = new window.google.maps.Geocoder();
      setLoadError("");
    } catch (error) {
      setLoadError(error?.message || "Google Maps failed to initialize.");
    }
  }, [ready, showMap]);

  // add markers (ONLY when jobs change or map becomes ready)
  useEffect(() => {
    if (!map.current || !showMap) return;
    const activeCenter = hasActiveRadius ? getSearchCenter(searchCenter) : null;
    const applyViewport = () => {
      if (activeCenter) {
        map.current.setCenter(activeCenter);
        map.current.setZoom(zoomForRadius(radiusMi));
        return;
      }

      map.current.setCenter(DEFAULT_CENTER);
      map.current.setZoom(DEFAULT_ZOOM);
    };

    // clear old markers
    markers.current.forEach((m) => m.setMap(null));
    markers.current = [];

    const addMarker = (job, pos) => {
      const m = new window.google.maps.Marker({
        position: pos,
        map: map.current,
        title: job.title || "",
      });
      m.addListener("click", () => {
        if (clickCbRef.current) clickCbRef.current(job);
      });
      markers.current.push(m);
    };

    const toGeocode = [];

    jobs.forEach((job) => {
      const pos = getPosition(job);
      if (pos) addMarker(job, pos);
      else if (job.location && typeof job.location === "string") {
        const key = job.location.trim();
        const cached = geoCache.current.get(key);
        if (cached) addMarker(job, cached);
        else toGeocode.push({ job, key });
      }
    });

    // async geocoding for missing
    const gc = geocoder.current;
    if (toGeocode.length && gc) {
      let i = 0;
      const tick = () => {
        if (i >= toGeocode.length) {
          applyViewport();
          return;
        }
        const { job, key } = toGeocode[i++];
        gc.geocode({ address: key }, (res, status) => {
          if (status === "OK" && res?.[0]?.geometry?.location) {
            const loc = res[0].geometry.location;
            const pos = { lat: loc.lat(), lng: loc.lng() };
            geoCache.current.set(key, pos);
            addMarker(job, pos);
          }
          setTimeout(tick, 180);
        });
      };
      tick();
    }

    applyViewport();
  }, [jobs, ready, showMap, searchCenter, radiusMi, hasActiveRadius]); // <- NO onMarkerClick here

  return (
    <div
      ref={mapEl}
      data-map-error={loadError || undefined}
      style={{ display: showMap ? "block" : "none", width: "100%", height: "100%" }}
    />
  );
};

export default JobMap;
