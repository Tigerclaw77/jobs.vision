import React, { useEffect, useRef, useState } from "react";
import { Lock, Navigation, SlidersHorizontal } from "lucide-react";
import {
  BENEFIT_FLAG_OPTIONS,
  CLINICAL_FOCUS_OPTIONS,
  EMPLOYMENT_TYPE_OPTIONS,
  BRAND_FILTER_OPTIONS,
  OPPORTUNITY_TYPE_OPTIONS,
  PRACTICE_TYPE_OPTIONS,
  ROLE_OPTIONS,
  SATURDAY_SCHEDULE_OPTIONS,
  WORK_ARRANGEMENT_OPTIONS,
  normalizeRole,
} from "../../utils/jobTaxonomy";

const RADIUS_OPTIONS = [
  { value: 10, label: "10 mi" },
  { value: 25, label: "25 mi" },
  { value: 50, label: "50 mi" },
  { value: 100, label: "100 mi" },
  { value: 250, label: "250 mi" },
];

const cleanLocationInput = (value = "") => String(value).replace(/\s+/g, " ").trim();
const collapseLocationInput = (value = "") => String(value).replace(/\s+/g, " ");

function FilterChecks({ legend, options, selected = [], onToggle, disabled = false }) {
  const values = Array.isArray(selected) ? selected : [];

  return (
    <fieldset className={`field field-checks ${disabled ? "field-checks-disabled" : ""}`} disabled={disabled}>
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

function selectedSummary(label) {
  return label;
}

function CheckboxDropdown({ label, options, selected = [], onToggle }) {
  const values = Array.isArray(selected) ? selected : [];
  const dropdownRef = useRef(null);

  useEffect(() => {
    const closeDropdown = () => {
      if (dropdownRef.current?.open) {
        dropdownRef.current.open = false;
      }
    };
    const handlePointerDown = (event) => {
      if (dropdownRef.current?.open && !dropdownRef.current.contains(event.target)) {
        closeDropdown();
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && dropdownRef.current?.open) {
        closeDropdown();
        dropdownRef.current.querySelector("summary")?.focus();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <details className="field field-role filter-dropdown" ref={dropdownRef}>
      <summary className="filter-dropdown-summary">
        <span>{selectedSummary(label)}</span>
      </summary>
      <div className="filter-dropdown-menu" role="group" aria-label={label}>
        {options.map((option) => (
          <label key={option.value} className="filter-dropdown-option">
            <input
              type="checkbox"
              checked={values.includes(option.value)}
              onChange={() => onToggle(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </details>
  );
}

export default function JobFilter({
  filters,
  onFilterChange,
  onClear,
  quickTags = [],
  onRemoveQuickTag,
  canUseMapSearch = true,
  canUseAdvancedOdFilters = false,
  isStateLocationSearch = false,
  geocodeStatus = "idle",
  geocodeMessage = "",
}) {
  const [locLoading, setLocLoading] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [structuredOpen, setStructuredOpen] = useState(false);
  const set = (patch) => onFilterChange({ ...filters, ...patch });
  const hasLocation =
    Boolean(String(filters.location || "").trim()) ||
    (Number.isFinite(Number(filters.lat)) && Number.isFinite(Number(filters.lng)));
  const canUseRadius = hasLocation && !isStateLocationSearch;
  const selectedRoles = Array.isArray(filters.roles)
    ? filters.roles.map((role) => normalizeRole(role) || role).filter(Boolean)
    : [];
  const odFiltersEnabled =
    canUseAdvancedOdFilters && selectedRoles.includes("optometrist");
  const hasStructuredFilters =
    (filters.clinicalFocuses || []).length > 0 ||
    (filters.practiceTypes || []).length > 0 ||
    (filters.benefitFlags || []).length > 0;

  useEffect(() => {
    if (hasStructuredFilters) {
      setStructuredOpen(true);
    }
  }, [hasStructuredFilters]);

  const toggleMulti = (key, value) => {
    const current = Array.isArray(filters[key]) ? filters[key] : [];
    const nextValues = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value];

    if (key === "roles") {
      const normalizedRoles = nextValues
        .map((role) => normalizeRole(role) || role)
        .filter(Boolean);
      set({
        roles: normalizedRoles,
      });
      return;
    }

    if (key === "includeBrand") {
      set({
        includeBrand: nextValues,
        excludeBrand: (filters.excludeBrand || []).filter((item) => item !== value),
      });
      return;
    }

    if (key === "excludeBrand") {
      set({
        excludeBrand: nextValues,
        includeBrand: (filters.includeBrand || []).filter((item) => item !== value),
      });
      return;
    }

    set({
      [key]: nextValues,
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
            placeholder="City, State, ZIP"
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
              isStateLocationSearch
                ? "State searches include all matching jobs in the state"
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

        <div className="filter-role-hidden-row">
          <CheckboxDropdown
            label="Role(s)"
            options={ROLE_OPTIONS}
            selected={filters.roles}
            onToggle={(value) => toggleMulti("roles", value)}
          />

          <div className="field field-show-hidden">
            <label className="show-hidden-toggle">
              <input
                type="checkbox"
                checked={Boolean(filters.showHiddenJobs)}
                onChange={(e) => set({ showHiddenJobs: e.target.checked })}
              />
              <span>Show Hidden Jobs</span>
            </label>
          </div>
        </div>

        <div className="filter-brand-row">
          <CheckboxDropdown
            label="Include Brand"
            options={BRAND_FILTER_OPTIONS}
            selected={filters.includeBrand}
            onToggle={(value) => toggleMulti("includeBrand", value)}
          />
          <CheckboxDropdown
            label="Exclude Brand"
            options={BRAND_FILTER_OPTIONS}
            selected={filters.excludeBrand}
            onToggle={(value) => toggleMulti("excludeBrand", value)}
          />
        </div>

        <FilterChecks
          legend="Employment Type"
          options={EMPLOYMENT_TYPE_OPTIONS}
          selected={filters.employmentTypes}
          onToggle={(value) => toggleMulti("employmentTypes", value)}
        />

        <FilterChecks
          legend="Work Setting"
          options={WORK_ARRANGEMENT_OPTIONS}
          selected={filters.workArrangements}
          onToggle={(value) => toggleMulti("workArrangements", value)}
        />

        <div className="advanced-filter-shell structured-filter-shell">
          <button
            className="advanced-toggle structured-toggle"
            type="button"
            aria-expanded={structuredOpen}
            onClick={() => setStructuredOpen((open) => !open)}
          >
            <span className="advanced-toggle-title">
              <SlidersHorizontal size={15} aria-hidden="true" />
              <span>More Filters</span>
            </span>
            <span aria-hidden="true">{structuredOpen ? "-" : "+"}</span>
          </button>

          {structuredOpen && (
            <div className="advanced-filter-content structured-filter-content">
              <FilterChecks
                legend="Clinical Focus"
                options={CLINICAL_FOCUS_OPTIONS}
                selected={filters.clinicalFocuses}
                onToggle={(value) => toggleMulti("clinicalFocuses", value)}
              />
              <FilterChecks
                legend="Practice Type"
                options={PRACTICE_TYPE_OPTIONS}
                selected={filters.practiceTypes}
                onToggle={(value) => toggleMulti("practiceTypes", value)}
              />
              <FilterChecks
                legend="Benefits & Incentives"
                options={BENEFIT_FLAG_OPTIONS}
                selected={filters.benefitFlags}
                onToggle={(value) => toggleMulti("benefitFlags", value)}
              />
            </div>
          )}
        </div>

        <div
          className={`advanced-filter-shell ${
            canUseAdvancedOdFilters ? "advanced-filter-unlocked" : "advanced-filter-locked"
          }`}
        >
          {canUseAdvancedOdFilters ? (
            <>
          <button
            className="advanced-toggle"
            type="button"
            aria-expanded={advancedOpen}
            onClick={() => setAdvancedOpen((open) => !open)}
          >
            <span className="advanced-toggle-title">
              <SlidersHorizontal size={15} aria-hidden="true" />
              <span>Advanced OD Filters</span>
            </span>
            <span aria-hidden="true">{advancedOpen ? "−" : "+"}</span>
          </button>

          {advancedOpen && (
            <div className={`advanced-filter-content ${!odFiltersEnabled ? "advanced-filter-content-disabled" : ""}`}>
              {!odFiltersEnabled && (
                <p className="advanced-filter-helper">
                  Select Optometrist to enable OD-specific filters.
                </p>
              )}
              <FilterChecks
                legend="Opportunity Type"
                options={OPPORTUNITY_TYPE_OPTIONS}
                selected={filters.opportunityTypes}
                onToggle={(value) => toggleMulti("opportunityTypes", value)}
                disabled={!odFiltersEnabled}
              />
              <FilterChecks
                legend="Saturday Schedule"
                options={SATURDAY_SCHEDULE_OPTIONS}
                selected={filters.saturdaySchedules}
                onToggle={(value) => toggleMulti("saturdaySchedules", value)}
                disabled={!odFiltersEnabled}
              />
            </div>
          )}
            </>
          ) : (
            <div className="advanced-locked-message" aria-label="Advanced OD Filters">
              <span className="advanced-locked-title">
                <Lock size={15} aria-hidden="true" />
                <span>Advanced OD Filters</span>
              </span>
              <span className="advanced-locked-subtitle">Available with Candidate Plus</span>
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
