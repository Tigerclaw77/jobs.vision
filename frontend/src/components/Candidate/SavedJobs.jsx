import React from "react";
import { useSelector } from "react-redux";

const SavedJobs = () => {
  const { favorites } = useSelector((state) => state.jobs);

  return (
    <div style={styles.container}>
      <h2>My Saved Jobs</h2>

      {favorites.length === 0 ? (
        <p>No saved jobs yet.</p>
      ) : (
        <ul style={styles.jobList}>
          {favorites.map((job) => (
            <li key={job._id} style={styles.jobItem}>
              <h3>{job.title} at {job.company}</h3>
              <p><strong>Hours:</strong> {job.hours}</p>
              <p><strong>Role:</strong> {job.jobRole}</p>
              <p><strong>Practice Mode:</strong> {job.practiceMode}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const styles = {
  container: { width: "80%", margin: "20px auto", textAlign: "center" },
  jobList: { listStyle: "none", padding: 0 },
  jobItem: {
    border: "1px solid #ccc",
    padding: "10px",
    marginBottom: "10px",
    borderRadius: "5px",
  },
};

export default SavedJobs;
