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
}) {
  const [locLoading, setLocLoading] = useState(false);
  const set = (patch) => onFilterChange({ ...filters, ...patch });

  const useMyLocation = () => {
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
            title="Use my location"
            onClick={useMyLocation}
            disabled={locLoading}
          >
            <Navigation size={16} />
          </button>
        </div>

        <div className="field field-radius">
          <label>Radius</label>
          <select
            value={filters.radiusMi ?? 25}
            onChange={(e) => set({ radiusMi: Number(e.target.value) })}
          >
            {RADIUS_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        {/* Role + Hours */}
        <div className="field field-role">
          <label>Role</label>
          <select
            value={filters.role || ""}
            onChange={(e) => set({ role: e.target.value })}
          >
            <option value="">All roles</option>
            <option value="optometrist">Optometrist</option>
            <option value="technician">Technician</option>
            <option value="assistant">Vision Assistant</option>
            <option value="front desk">Front Desk</option>
            <option value="ophthalmologist">Ophthalmologist</option>
          </select>
        </div>

        <div className="field field-hours">
          <label>Hours</label>
          <select
            value={filters.hours || ""}
            onChange={(e) => set({ hours: e.target.value })}
          >
            <option value="">All hours</option>
            <option value="full-time">Full-time</option>
            <option value="part-time">Part-time</option>
            <option value="prn">PRN</option>
          </select>
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
