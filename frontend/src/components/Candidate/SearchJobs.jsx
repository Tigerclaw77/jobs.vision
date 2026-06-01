import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";

function apiBaseUrl() {
  const raw = (process.env.REACT_APP_API_URL || "http://localhost:5000/api").replace(/\/+$/, "");
  return raw.endsWith("/api") ? raw : `${raw}/api`;
}

function mapJob(row = {}) {
  return {
    id: row.id || row._id,
    title: row.title || "",
    company: row.employer_name || row.company || row.venue_name || "",
    description: row.description || "",
    hours: row.hours || row.type || "",
    role: row.role || "",
    type: row.type || "",
    location: row.location || [row.city, row.state].filter(Boolean).join(", "),
  };
}

const SearchJobs = () => {
  const [jobs, setJobs] = useState([]);
  const [filters, setFilters] = useState({
    role: "",
    hours: "",
    type: "",
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

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const roleOk = !filters.role || job.role === filters.role;
      const hoursOk =
        !filters.hours ||
        (Number.isFinite(Number(job.hours)) && Number(job.hours) >= Number(filters.hours));
      const typeOk = !filters.type || job.type === filters.type;
      const companyOk =
        !filters.company ||
        job.company.toLowerCase().includes(filters.company.toLowerCase());
      return roleOk && hoursOk && typeOk && companyOk;
    });
  }, [jobs, filters]);

  const handleSaveJob = (job) => {
    const updatedSavedJobs = [...savedJobs.filter((saved) => saved.id !== job.id), job];
    setSavedJobs(updatedSavedJobs);
    localStorage.setItem("savedJobs", JSON.stringify(updatedSavedJobs));
    alert("Job saved successfully!");
  };

  const handleShareJob = (job) => {
    alert(`Share functionality for "${job.title}" coming soon!`);
  };

  return (
    <div style={styles.container}>
      <h2>Search Jobs</h2>

      <div style={styles.filterContainer}>
        <select onChange={(e) => setFilters({ ...filters, role: e.target.value })}>
          <option value="">Select Job Role</option>
          <option value="optometrist">Optometrist</option>
          <option value="optician">Optician</option>
          <option value="ophthalmologist">Ophthalmologist</option>
          <option value="tech">Tech / Assistant</option>
          <option value="manager">Manager</option>
          <option value="front_desk">Front Desk</option>
        </select>

        <input
          type="number"
          min="0"
          placeholder="Minimum hours/week"
          value={filters.hours}
          onChange={(e) => setFilters({ ...filters, hours: e.target.value })}
        />

        <select onChange={(e) => setFilters({ ...filters, type: e.target.value })}>
          <option value="">Select Type</option>
          <option value="full_time">Full-time</option>
          <option value="part_time">Part-time</option>
          <option value="contract">Contract</option>
          <option value="temp">Temporary</option>
          <option value="internship">Internship</option>
        </select>

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
              <p><strong>Role:</strong> {job.role || "Not listed"}</p>
              <p><strong>Type:</strong> {job.type || "Not listed"}</p>

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
};

export default SearchJobs;
