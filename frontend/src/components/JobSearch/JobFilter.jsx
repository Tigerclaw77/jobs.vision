import React, { useState } from "react";
import { Navigation } from "lucide-react";

const RADIUS_OPTIONS = [
  { value: 10, label: "10 mi" },
  { value: 25, label: "25 mi" },
  { value: 50, label: "50 mi" },
  { value: 100, label: "100 mi" },
];

export default function JobFilter({
  filters,
  onFilterChange,
  onClear,
  quickTags = [],
  onRemoveQuickTag,
  canUseMapSearch = true,
}) {
  const [locLoading, setLocLoading] = useState(false);
  const set = (patch) => onFilterChange({ ...filters, ...patch });
  const hasLocation =
    Boolean(String(filters.location || "").trim()) ||
    (Number.isFinite(Number(filters.lat)) && Number.isFinite(Number(filters.lng)));
  const canUseRadius = canUseMapSearch && hasLocation;

  const useMyLocation = () => {
    if (!canUseMapSearch) {
      alert("Map search is available with Candidate Plus or Premium.");
      return;
    }
    if (!navigator.geolocation) return alert("Geolocation not supported.");
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const { latitude: lat, longitude: lng } = coords;
        set({ lat, lng, location: "Near me" });
        setLocLoading(false);
      },
      () => {
        alert("Couldn’t fetch your location.");
        setLocLoading(false);
      }
    );
  };

  return (
    <div className="job-filter">
      <div className="filter-grid">
        {/* Search */}
        <div className="field field-search">
          <label>Search</label>
          <input
            type="text"
            placeholder="Title, company, keywords…"
            value={filters.q || ""}
            onChange={(e) => set({ q: e.target.value })}
          />
        </div>

        {/* Quick tags (auto row) */}
        {quickTags.length > 0 && (
          <div className="quick-tags" aria-label="Active filters">
            {quickTags.map((t) => (
              <span key={`${t.type}:${t.value}`} className="quick-tag">
                <span className="qt-label">{t.label}</span>
                <button
                  type="button"
                  className="qt-x"
                  aria-label={`Remove ${t.label}`}
                  title="Remove"
                  onClick={() => onRemoveQuickTag?.(t)}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Location + Radius */}
        <div className="field field-location location-input">
          <label>Location</label>
          <input
            type="text"
            placeholder="City, ST"
            value={filters.location || ""}
            onChange={(e) =>
              set({ location: e.target.value, lat: null, lng: null })
            }
          />
          <button
            className="geo-btn"
            type="button"
            title={canUseMapSearch ? "Use my location" : "Map search requires Plus or Premium"}
            onClick={useMyLocation}
            disabled={locLoading || !canUseMapSearch}
          >
            <Navigation size={16} />
          </button>
        </div>

        <div className="field field-radius">
          <label>Radius</label>
          <select
            value={canUseRadius ? filters.radiusMi ?? 25 : ""}
            onChange={(e) => set({ radiusMi: Number(e.target.value) })}
            disabled={!canUseRadius}
            title={
              !canUseMapSearch
                ? "Map search requires Plus or Premium"
                : hasLocation
                ? "Search radius"
                : "Enter a location to use radius"
            }
          >
            {!canUseRadius && <option value="">Any distance</option>}
            {RADIUS_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        {/* Role + Type */}
        <div className="field field-role">
          <label>Role</label>
          <select
            value={filters.role || ""}
            onChange={(e) => set({ role: e.target.value })}
          >
            <option value="">All roles</option>
            <option value="optometrist">Optometrist</option>
            <option value="optician">Optician</option>
            <option value="ophthalmic technician">Ophthalmic Technician</option>
            <option value="practice manager">Practice Manager</option>
          </select>
        </div>

        <div className="field field-type">
          <label>Type</label>
          <select
            value={filters.type || ""}
            onChange={(e) => set({ type: e.target.value })}
          >
            <option value="">All types</option>
            <option value="full_time">Full-time</option>
            <option value="part_time">Part-time</option>
            <option value="contract">Contract</option>
            <option value="temp">Temporary</option>
            <option value="internship">Internship</option>
          </select>
        </div>

        <div className="field field-hours">
          <label>Min hours/week</label>
          <input
            type="number"
            min="0"
            placeholder="Any"
            value={filters.hours || ""}
            onChange={(e) => set({ hours: e.target.value })}
          />
        </div>

        {/* Reset */}
        <div className="reset-cell">
          <button className="clear-filters" type="button" onClick={onClear}>
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
