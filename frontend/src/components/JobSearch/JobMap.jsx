import React, { useEffect, useRef, useState } from "react";

/* Normalize possible lat/lng shapes */
function getPosition(job) {
  const lat =
    job.lat ?? job.latitude ?? job?.coordinates?.lat ?? job?.geo?.lat ?? null;
  const lng =
    job.lng ?? job.longitude ?? job?.coordinates?.lng ?? job?.geo?.lng ?? null;

  if (lat == null || lng == null || lat === "" || lng === "") return null;
  const nLat = Number(lat);
  const nLng = Number(lng);
  if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) return null;
  return { lat: nLat, lng: nLng };
}

const DEFAULT_CENTER = { lat: 31.0, lng: -99.0 };
const DEFAULT_ZOOM = 5;

function getSearchCenter(center) {
  const lat = center?.lat;
  const lng = center?.lng;
  if (lat == null || lng == null || lat === "" || lng === "") return null;
  const nLat = Number(lat);
  const nLng = Number(lng);
  if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) return null;
  return { lat: nLat, lng: nLng };
}

function zoomForRadius(radiusMi) {
  const radius = Number(radiusMi) || 25;
  if (radius <= 10) return 11;
  if (radius <= 25) return 10;
  if (radius <= 50) return 9;
  if (radius <= 100) return 8;
  return 7;
}

const MARKER_STYLES = {
  applied: { color: "#16a34a", zIndex: 40 },
  saved: { color: "#f59e0b", zIndex: 30 },
  featured: { color: "#7c3aed", zIndex: 20 },
  normal: { color: "#dc2626", zIndex: 10 },
};

function markerStateFor(job = {}) {
  if (job.isApplied || job.applied) return "applied";
  if (job.isFavorite || job.isSaved || job.saved) return "saved";
  if (job.featured || job.isFeatured) return "featured";
  return "normal";
}

function markerIconSvg(color, state) {
  const centerSymbol =
    state === "saved"
      ? '<path d="M16 8.4l2.2 4.5 5 .7-3.6 3.5.8 5-4.4-2.4-4.4 2.4.8-5-3.6-3.5 5-.7L16 8.4z" fill="#fff"/>'
      : '<circle cx="16" cy="15.5" r="4.5" fill="#fff" opacity=".92"/>';

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42">
      <path d="M16 40.5S29 26.1 29 16A13 13 0 1 0 3 16c0 10.1 13 24.5 13 24.5z" fill="${color}" stroke="#fff" stroke-width="2"/>
      <circle cx="16" cy="16" r="10" fill="${color}" opacity=".98"/>
      ${centerSymbol}
    </svg>
  `;
}

function markerIconForState(google, state) {
  const style = MARKER_STYLES[state] || MARKER_STYLES.normal;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
      markerIconSvg(style.color, state)
    )}`,
    scaledSize: new google.maps.Size(32, 42),
    anchor: new google.maps.Point(16, 40),
  };
}

const JobMap = ({
  jobs = [],
  onMarkerClick,
  showMap = true,
  apiKey,
  searchCenter = null,
  radiusMi = 25,
  hasActiveRadius = false,
  emptyMessage = "",
}) => {
  const mapEl = useRef(null);
  const map = useRef(null);
  const markers = useRef([]);
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

  // init map
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
      setLoadError("");
    } catch (error) {
      setLoadError(error?.message || "Google Maps failed to initialize.");
    }
  }, [ready, showMap]);

  // add markers (ONLY when jobs change or map becomes ready)
  useEffect(() => {
    if (!map.current || !showMap) return;
    let cancelled = false;
    const activeCenter = hasActiveRadius ? getSearchCenter(searchCenter) : null;
    const markerPositions = [];

    const applyViewport = () => {
      if (cancelled || !map.current) return;
      if (markerPositions.length > 0) {
        const uniquePositions = markerPositions.filter((position, index, list) => {
          return (
            list.findIndex(
              (item) => item.lat === position.lat && item.lng === position.lng
            ) === index
          );
        });

        if (uniquePositions.length === 1) {
          map.current.setCenter(uniquePositions[0]);
          map.current.setZoom(activeCenter ? zoomForRadius(radiusMi) : 10);
          return;
        }

        const bounds = new window.google.maps.LatLngBounds();
        markerPositions.forEach((position) => bounds.extend(position));
        map.current.fitBounds(bounds, 48);
        return;
      }

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

    const jobPositions = jobs
      .map((job) => ({ job, position: getPosition(job) }))
      .filter((item) => item.position);

    const addMarker = (job, pos) => {
      if (cancelled) return;
      const state = markerStateFor(job);
      const m = new window.google.maps.Marker({
        position: pos,
        map: map.current,
        title: job.title || "",
        icon: markerIconForState(window.google, state),
        opacity: job.isHidden ? 0.5 : 1,
        zIndex: MARKER_STYLES[state]?.zIndex || MARKER_STYLES.normal.zIndex,
      });
      m.addListener("click", () => {
        if (clickCbRef.current) clickCbRef.current(job);
      });
      markers.current.push(m);
      markerPositions.push(pos);
    };

    jobPositions.forEach(({ job, position }) => addMarker(job, position));
    applyViewport();

    return () => {
      cancelled = true;
    };
  }, [jobs, ready, showMap, searchCenter, radiusMi, hasActiveRadius]); // <- NO onMarkerClick here

  return (
    <div className="job-map-shell" style={{ display: showMap ? "block" : "none" }}>
      <div
        ref={mapEl}
        className="job-map-canvas"
        data-map-error={loadError || undefined}
      />
      {emptyMessage && <div className="map-empty-message">{emptyMessage}</div>}
    </div>
  );
};

export default JobMap;
