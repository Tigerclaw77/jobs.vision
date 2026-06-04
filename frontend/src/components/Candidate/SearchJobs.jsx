import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  addJobToFavorites,
  getUserJobInteractions,
} from "../../utils/api.supabase";
import {
  EMPLOYMENT_TYPE_LABELS,
  EMPLOYMENT_TYPE_OPTIONS,
  OPPORTUNITY_TYPE_LABELS,
  OPPORTUNITY_TYPE_OPTIONS,
  ROLE_LABELS,
  ROLE_OPTIONS,
  WORK_ARRANGEMENT_LABELS,
  WORK_ARRANGEMENT_OPTIONS,
  labelsForValues,
  normalizeMultiValue,
  normalizeRole,
} from "../../utils/jobTaxonomy";

function apiBaseUrl() {
  const raw = (process.env.REACT_APP_API_URL || "http://localhost:5000/api").replace(/\/+$/, "");
  return raw.endsWith("/api") ? raw : `${raw}/api`;
}

const employmentTypeValues = EMPLOYMENT_TYPE_OPTIONS.map(({ value }) => value);
const workArrangementValues = WORK_ARRANGEMENT_OPTIONS.map(({ value }) => value);
const opportunityTypeValues = OPPORTUNITY_TYPE_OPTIONS.map(({ value }) => value);

function CheckboxGroup({ legend, options, selected = [], onToggle }) {
  return (
    <fieldset style={styles.checkboxGroup}>
      <legend style={styles.checkboxLegend}>{legend}</legend>
      {options.map((option) => (
        <label key={option.value} style={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={selected.includes(option.value)}
            onChange={() => onToggle(option.value)}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </fieldset>
  );
}

function mapJob(row = {}) {
  const employmentTypes = normalizeMultiValue(
    row.employment_types || row.employment_type || row.type,
    employmentTypeValues
  );
  const workArrangements = normalizeMultiValue(
    row.work_arrangements || row.work_arrangement,
    workArrangementValues
  );
  const opportunityTypes = normalizeMultiValue(
    row.opportunity_types || row.opportunity_type,
    opportunityTypeValues
  );

  return {
    id: row.id || row._id,
    title: row.title || "",
    company: row.employer_name || row.company || row.venue_name || "",
    description: row.description || "",
    hours: row.hours || row.type || "",
    role: normalizeRole(row.role),
    type: employmentTypes[0] || "",
    employment_types: employmentTypes,
    work_arrangement: workArrangements[0] || "",
    work_arrangements: workArrangements,
    opportunity_types: opportunityTypes,
    location: row.location || [row.city, row.state].filter(Boolean).join(", "),
  };
}

const SearchJobs = () => {
  const [jobs, setJobs] = useState([]);
  const [filters, setFilters] = useState({
    roles: [],
    hours: "",
    employmentTypes: [],
    workArrangements: [],
    opportunityTypes: [],
    company: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [savedJobs, setSavedJobs] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("savedJobs")) || [];
    } catch {
      return [];
    }
  });

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await axios.get(`${apiBaseUrl()}/jobs`, {
        params: { limit: 100 },
      });
      setJobs((response.data || []).map(mapJob));
    } catch (err) {
      setError("Error fetching jobs. Please try again.");
      console.error("Error fetching jobs:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    const loadSavedJobs = async () => {
      try {
        const interactions = await getUserJobInteractions();
        const favoriteIds = new Set((interactions.favorites || []).map(String));
        setSavedJobs((prev) => prev.filter((job) => favoriteIds.has(String(job.id))));
      } catch {
        // Keep local fallback state if the user is not signed in yet.
      }
    };
    loadSavedJobs();
  }, []);

  const filteredJobs = useMemo(() => {
    const roleIncludesOptometrist = filters.roles.includes("optometrist");
    return jobs.filter((job) => {
      const roleOk = filters.roles.length === 0 || filters.roles.includes(job.role);
      const hoursOk =
        !filters.hours ||
        (Number.isFinite(Number(job.hours)) && Number(job.hours) >= Number(filters.hours));
      const typeOk =
        filters.employmentTypes.length === 0 ||
        job.employment_types.some((value) => filters.employmentTypes.includes(value));
      const workArrangementOk =
        filters.workArrangements.length === 0 ||
        job.work_arrangements.some((value) => filters.workArrangements.includes(value));
      const opportunityOk =
        !roleIncludesOptometrist ||
        filters.opportunityTypes.length === 0 ||
        job.opportunity_types.some((value) => filters.opportunityTypes.includes(value));
      const companyOk =
        !filters.company ||
        job.company.toLowerCase().includes(filters.company.toLowerCase());
      return roleOk && hoursOk && typeOk && workArrangementOk && opportunityOk && companyOk;
    });
  }, [jobs, filters]);

  const toggleFilter = (key, value) => {
    setFilters((prev) => {
      const current = Array.isArray(prev[key]) ? prev[key] : [];
      const nextValues = current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value];
      if (key === "roles") {
        return {
          ...prev,
          roles: nextValues,
          opportunityTypes: nextValues.includes("optometrist") ? prev.opportunityTypes : [],
        };
      }
      return {
        ...prev,
        [key]: nextValues,
      };
    });
  };
  const showOpportunityTypes = filters.roles.includes("optometrist");

  const handleSaveJob = async (job) => {
    try {
      const result = await addJobToFavorites(job.id);
      const updatedSavedJobs = result.added
        ? [...savedJobs.filter((saved) => saved.id !== job.id), job]
        : savedJobs.filter((saved) => saved.id !== job.id);
      setSavedJobs(updatedSavedJobs);
      localStorage.setItem("savedJobs", JSON.stringify(updatedSavedJobs));
      alert(result.added ? "Job saved successfully!" : "Job removed from saved jobs.");
    } catch (err) {
      alert(err?.message || "Unable to save this job.");
    }
  };

  const handleShareJob = (job) => {
    alert(`Share functionality for "${job.title}" coming soon!`);
  };

  return (
    <div style={styles.container}>
      <h2>Search Jobs</h2>

      <div style={styles.filterContainer}>
        <CheckboxGroup
          legend="Roles"
          options={ROLE_OPTIONS}
          selected={filters.roles}
          onToggle={(value) => toggleFilter("roles", value)}
        />

        <input
          type="number"
          min="0"
          placeholder="Minimum hours/week"
          value={filters.hours}
          onChange={(e) => setFilters({ ...filters, hours: e.target.value })}
        />

        <CheckboxGroup
          legend="Employment Type"
          options={EMPLOYMENT_TYPE_OPTIONS}
          selected={filters.employmentTypes}
          onToggle={(value) => toggleFilter("employmentTypes", value)}
        />

        <CheckboxGroup
          legend="Work Arrangement"
          options={WORK_ARRANGEMENT_OPTIONS}
          selected={filters.workArrangements}
          onToggle={(value) => toggleFilter("workArrangements", value)}
        />

        {showOpportunityTypes && (
          <CheckboxGroup
            legend="Opportunity Type"
            options={OPPORTUNITY_TYPE_OPTIONS}
            selected={filters.opportunityTypes}
            onToggle={(value) => toggleFilter("opportunityTypes", value)}
          />
        )}

        <input
          placeholder="Company"
          value={filters.company}
          onChange={(e) => setFilters({ ...filters, company: e.target.value })}
        />

        <button onClick={fetchJobs} style={styles.button}>Refresh</button>
      </div>

      {loading && <p>Loading jobs...</p>}
      {error && <p style={styles.error}>{error}</p>}

      <div>
        {filteredJobs.length === 0 && !loading ? <p>No jobs found.</p> : (
          filteredJobs.map((job) => (
            <div key={job.id} style={styles.jobCard}>
              <h3>{job.title} at {job.company || "Unknown employer"}</h3>
              {job.location && <p><strong>Location:</strong> {job.location}</p>}
              <p><strong>Description:</strong> {job.description}</p>
              <p><strong>Hours:</strong> {job.hours || "Not listed"}</p>
              <p><strong>Role:</strong> {ROLE_LABELS[job.role] || "Not listed"}</p>
              <p><strong>Employment:</strong> {labelsForValues(EMPLOYMENT_TYPE_LABELS, job.employment_types).join(", ") || "Not listed"}</p>
              <p><strong>Work Arrangement:</strong> {labelsForValues(WORK_ARRANGEMENT_LABELS, job.work_arrangements).join(", ") || "Not listed"}</p>
              {job.role === "optometrist" && (
                <p><strong>Opportunity:</strong> {labelsForValues(OPPORTUNITY_TYPE_LABELS, job.opportunity_types).join(", ") || "Not listed"}</p>
              )}

              <button style={styles.saveButton} onClick={() => handleSaveJob(job)}>Save Job</button>
              <button style={styles.shareButton} onClick={() => handleShareJob(job)}>Share Job</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const styles = {
  container: {
    width: "80%",
    margin: "20px auto",
    textAlign: "center",
  },
  filterContainer: {
    display: "flex",
    gap: "10px",
    justifyContent: "center",
    marginBottom: "15px",
    flexWrap: "wrap",
  },
  button: {
    padding: "10px",
    backgroundColor: "#005a78",
    color: "white",
    border: "none",
    cursor: "pointer",
    borderRadius: "5px",
  },
  jobCard: {
    border: "1px solid #ccc",
    padding: "10px",
    marginBottom: "10px",
    borderRadius: "5px",
    textAlign: "left",
  },
  saveButton: {
    backgroundColor: "#28a745",
    color: "white",
    padding: "8px 10px",
    border: "none",
    cursor: "pointer",
    marginRight: "10px",
    borderRadius: "5px",
  },
  shareButton: {
    backgroundColor: "#007bff",
    color: "white",
    padding: "8px 10px",
    border: "none",
    cursor: "pointer",
    borderRadius: "5px",
  },
  error: {
    color: "red",
  },
  checkboxGroup: {
    border: "1px solid #ccc",
    borderRadius: "5px",
    padding: "8px 10px",
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    alignItems: "center",
  },
  checkboxLegend: {
    padding: "0 6px",
    fontWeight: 600,
  },
  checkboxLabel: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    cursor: "pointer",
  },
};

export default SearchJobs;
