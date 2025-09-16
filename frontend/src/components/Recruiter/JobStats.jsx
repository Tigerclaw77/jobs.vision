import React, { useState, useEffect } from "react";
import api from "../utils/api";

const JobStats = () => {
  const [jobStats, setJobStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchJobStats();
  }, []);

  const fetchJobStats = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("http://localhost:5000/jobs/saved-count", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      setJobStats(response.data);
    } catch (error) {
      setError("Error fetching job stats.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <h2>Job Save Stats</h2>

      {loading && <p>Loading...</p>}
      {error && <p style={styles.error}>{error}</p>}
      {jobStats.length === 0 && !loading && <p>No jobs posted yet.</p>}

      <ul style={styles.jobList}>
        {jobStats.map((job) => (
          <li key={job.jobTitle} style={styles.jobItem}>
            <h3>{job.jobTitle} at {job.company}</h3>
            <p><strong>Saved by:</strong> {job.savedCount} candidates</p>
          </li>
        ))}
      </ul>
    </div>
  );
};

const styles = {
  container: { width: "80%", margin: "20px auto", textAlign: "center" },
  jobList: { listStyle: "none", padding: 0 },
  jobItem: { border: "1px solid #ccc", padding: "10px", marginBottom: "10px", borderRadius: "5px" },
  error: { color: "red" },
};

export default JobStats;
