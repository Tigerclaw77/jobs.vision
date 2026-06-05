import React, { useState, useEffect } from "react";
import api from "../utils/api";

const RecommendedJobs = () => {
  const [recommendedJobs, setRecommendedJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchRecommendedJobs();
  }, []);

  const fetchRecommendedJobs = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("http://localhost:5000/recommend-jobs", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      setRecommendedJobs(response.data);
    } catch (error) {
      setError("Error fetching job recommendations.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <h2>Recommended Jobs</h2>

      {loading && <p>Loading recommendations...</p>}
      {error && <p style={styles.error}>{error}</p>}
      {recommendedJobs.length === 0 && !loading && <p>No recommendations yet.</p>}

      <ul style={styles.jobList}>
        {recommendedJobs.map((job) => (
          <li key={job._id} style={styles.jobItem}>
            <h3>{job.title} at {job.company}</h3>
            <p><strong>Job Role:</strong> {job.jobRole}</p>
            <p><strong>Practice Mode:</strong> {job.practiceMode}</p>
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

export default RecommendedJobs;
