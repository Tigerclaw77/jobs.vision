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
      const m = new window.google.maps.Marker({
        position: pos,
        map: map.current,
        title: job.title || "",
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
