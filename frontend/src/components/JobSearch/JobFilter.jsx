import React, { useState } from "react";
import { Navigation } from "lucide-react";

const EMPLOYMENT_TYPE_OPTIONS = [
  { value: "full_time", label: "Full-Time" },
  { value: "part_time", label: "Part-Time" },
  { value: "remote", label: "Remote" },
];

const OPPORTUNITY_TYPE_OPTIONS = [
  { value: "associate_position", label: "Associate Position" },
  { value: "lease_opportunity", label: "Lease Opportunity" },
  { value: "ownership_track", label: "Ownership Track" },
];

const PRACTICE_TYPE_OPTIONS = [
  { value: "private_practice", label: "Private Practice" },
  { value: "corporate", label: "Corporate" },
  { value: "od_md", label: "OD/MD" },
];

const RADIUS_OPTIONS = [
  { value: 10, label: "10 mi" },
  { value: 25, label: "25 mi" },
  { value: 50, label: "50 mi" },
  { value: 100, label: "100 mi" },
];

const cleanLocationInput = (value = "") => String(value).replace(/\s+/g, " ").trim();
const collapseLocationInput = (value = "") => String(value).replace(/\s+/g, " ");

function FilterChecks({ legend, options, selected = [], onToggle }) {
  const values = Array.isArray(selected) ? selected : [];

  return (
    <fieldset className="field field-checks">
      <legend>{legend}</legend>
      <div className="filter-check-group">
        {options.map((option) => (
          <label key={option.value} className="filter-check">
            <input
              type="checkbox"
              checked={values.includes(option.value)}
              onChange={() => onToggle(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default function JobFilter({
  filters,
  onFilterChange,
  onClear,
  quickTags = [],
  onRemoveQuickTag,
  canUseMapSearch = true,
  geocodeStatus = "idle",
  geocodeMessage = "",
}) {
  const [locLoading, setLocLoading] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const set = (patch) => onFilterChange({ ...filters, ...patch });
  const hasLocation =
    Boolean(String(filters.location || "").trim()) ||
    (Number.isFinite(Number(filters.lat)) && Number.isFinite(Number(filters.lng)));
  const canUseRadius = canUseMapSearch && hasLocation;

  const toggleMulti = (key, value) => {
    const current = Array.isArray(filters[key]) ? filters[key] : [];
    set({
      [key]: current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    });
  };

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
              set({ location: collapseLocationInput(e.target.value), lat: null, lng: null })
            }
            onBlur={(e) => {
              const cleaned = cleanLocationInput(e.target.value);
              if (cleaned !== filters.location) {
                set({ location: cleaned });
              }
            }}
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

        {canUseMapSearch && geocodeMessage && (
          <div
            className={`location-status location-status-${geocodeStatus}`}
            role="status"
            aria-live="polite"
          >
            {geocodeMessage}
          </div>
        )}

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

        <FilterChecks
          legend="Employment Type"
          options={EMPLOYMENT_TYPE_OPTIONS}
          selected={filters.employmentTypes}
          onToggle={(value) => toggleMulti("employmentTypes", value)}
        />

        <div className="advanced-filter-shell">
          <button
            className="advanced-toggle"
            type="button"
            aria-expanded={advancedOpen}
            onClick={() => setAdvancedOpen((open) => !open)}
          >
            <span>Advanced OD Filters</span>
            <span aria-hidden="true">{advancedOpen ? "−" : "+"}</span>
          </button>

          {advancedOpen && (
            <div className="advanced-filter-content">
              <FilterChecks
                legend="Opportunity Type"
                options={OPPORTUNITY_TYPE_OPTIONS}
                selected={filters.opportunityTypes}
                onToggle={(value) => toggleMulti("opportunityTypes", value)}
              />
              <FilterChecks
                legend="Practice Type"
                options={PRACTICE_TYPE_OPTIONS}
                selected={filters.practiceTypes}
                onToggle={(value) => toggleMulti("practiceTypes", value)}
              />
            </div>
          )}
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
