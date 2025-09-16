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

const JobMap = ({ jobs = [], onMarkerClick, showMap = true, apiKey }) => {
  const mapEl = useRef(null);
  const map = useRef(null);
  const geocoder = useRef(null);
  const markers = useRef([]);
  const geoCache = useRef(new Map());
  const [ready, setReady] = useState(false);

  // stable callback to avoid re-running marker effect
  const clickCbRef = useRef(onMarkerClick);
  useEffect(() => { clickCbRef.current = onMarkerClick; }, [onMarkerClick]);

  // load script once
  useEffect(() => {
    if (!showMap) return;
    if (window.google?.maps) { setReady(true); return; }
    const id = "googleMaps";
    const existing = document.getElementById(id);
    if (existing) {
      existing.addEventListener("load", () => setReady(true), { once: true });
      return;
    }
    const s = document.createElement("script");
    s.id = id; s.async = true; s.defer = true;
    s.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
    s.onload = () => setReady(true);
    document.body.appendChild(s);
  }, [apiKey, showMap]);

  // init map + geocoder
  useEffect(() => {
    if (!ready || !showMap || !mapEl.current || map.current) return;
    map.current = new window.google.maps.Map(mapEl.current, {
      center: { lat: 30.1659, lng: -95.4613 },
      zoom: 8,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      gestureHandling: "greedy",
    });
    geocoder.current = new window.google.maps.Geocoder();
  }, [ready, showMap]);

  // add markers (ONLY when jobs change or map becomes ready)
  useEffect(() => {
    if (!map.current || !showMap) return;

    // clear old markers
    markers.current.forEach((m) => m.setMap(null));
    markers.current = [];

    const bounds = new window.google.maps.LatLngBounds();
    let placed = 0;

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
      bounds.extend(pos);
      placed++;
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
          if (placed > 0) map.current.fitBounds(bounds);
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

    // fit for immediate markers
    if (placed > 0) {
      map.current.fitBounds(bounds);
    } else {
      map.current.setCenter({ lat: 30.1659, lng: -95.4613 });
      map.current.setZoom(8);
    }
  }, [jobs, ready, showMap]); // <- NO onMarkerClick here

  return (
    <div
      ref={mapEl}
      style={{ display: showMap ? "block" : "none", width: "100%", height: "100%" }}
    />
  );
};

export default JobMap;
