// // import React, { useState, useEffect } from "react";
// // import axios from "axios";

// // const SearchJobs = () => {
// //   const [jobs, setJobs] = useState([]);

// //   useEffect(() => {
// //     const fetchJobs = async () => {
// //       try {
// //         const response = await axios.get("http://localhost:5000/jobs");
// //         setJobs(response.data);
// //       } catch (error) {
// //         console.error("Error fetching jobs:", error);
// //       }
// //     };
// //     fetchJobs();
// //   }, []);

// //   return (
// //     <div>
// //       <h2>Search Jobs</h2>
// //       {jobs.map((job) => (
// //         <div key={job._id}>
// //           <h3>{job.title}</h3>
// //           <p>{job.description}</p>
// //         </div>
// //       ))}
// //     </div>
// //   );
// // };

// // export default SearchJobs;

import React, { useState, useEffect } from "react";
import axios from "axios";

const SearchJobs = () => {
  const [jobs, setJobs] = useState([]);
  const [filters, setFilters] = useState({
    jobRole: "",
    hours: "",
    practiceMode: "",
    corporation: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [savedJobs, setSavedJobs] = useState(() => {
    return JSON.parse(localStorage.getItem("savedJobs")) || [];
  });

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await axios.get("http://localhost:5000/jobs", { params: filters });
      setJobs(response.data);
    } catch (error) {
      setError("Error fetching jobs. Please try again.");
      console.error("Error fetching jobs:", error);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Save Job Function
  const handleSaveJob = (job) => {
    const updatedSavedJobs = [...savedJobs, job];
    setSavedJobs(updatedSavedJobs);
    localStorage.setItem("savedJobs", JSON.stringify(updatedSavedJobs)); // ✅ Temporary Storage (Replace with API later)
    alert("Job saved successfully!");
  };

  // ✅ Share Job Placeholder (Expand later)
  const handleShareJob = (job) => {
    alert(`Share functionality for "${job.title}" coming soon!`);
  };

  return (
    <div style={styles.container}>
      <h2>Search Jobs</h2>

      {/* ✅ Job Filters */}
      <div style={styles.filterContainer}>
        <select onChange={(e) => setFilters({ ...filters, jobRole: e.target.value })}>
          <option value="">Select Job Role</option>
          <option value="Optometrist">Optometrist</option>
          <option value="Optician">Optician</option>
          <option value="Ophthalmologist">Ophthalmologist</option>
        </select>

        <select onChange={(e) => setFilters({ ...filters, hours: e.target.value })}>
          <option value="">Select Hours</option>
          <option value="full-time">Full-Time</option>
          <option value="part-time">Part-Time</option>
          <option value="per diem">Per Diem</option>
        </select>

        <select onChange={(e) => setFilters({ ...filters, practiceMode: e.target.value })}>
          <option value="">Select Practice Mode</option>
          <option value="employed">Employed</option>
          <option value="contract">Contract</option>
          <option value="lease">Lease</option>
          <option value="associate">Associate</option>
        </select>

        <select onChange={(e) => setFilters({ ...filters, corporation: e.target.value })}>
          <option value="">Select Corporation</option>
          <option value="Luxottica">Luxottica</option>
          <option value="Walmart">Walmart</option>
        </select>

        <button onClick={fetchJobs} style={styles.button}>Search</button>
      </div>

      {/* ✅ Show Loading State */}
      {loading && <p>Loading jobs...</p>}

      {/* ✅ Show Error Message */}
      {error && <p style={styles.error}>{error}</p>}

      {/* ✅ Display Jobs */}
      <div>
        {jobs.length === 0 && !loading ? <p>No jobs found.</p> : (
          jobs.map((job) => (
            <div key={job._id} style={styles.jobCard}>
              <h3>{job.title} at {job.company}</h3>
              <p><strong>Description:</strong> {job.description}</p>
              <p><strong>Hours:</strong> {job.hours}</p>
              <p><strong>Job Role:</strong> {job.jobRole}</p>
              <p><strong>Practice Mode:</strong> {job.practiceMode}</p>

              {/* ✅ Save & Share Job Buttons */}
              <button style={styles.saveButton} onClick={() => handleSaveJob(job)}>Save Job</button>
              <button style={styles.shareButton} onClick={() => handleShareJob(job)}>Share Job</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// ✅ Inline Styles
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
