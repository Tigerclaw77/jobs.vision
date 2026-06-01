import React, { useCallback, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  fetchRecruiterJobs,
  archiveJob,
  unarchiveJob,
} from "../../utils/api";

import AddJob from "./AddJob";
import AccessGate from "../auth/AccessGate";
import JobTabs from "./JobTabs";

const RecruiterDashboard = () => {
  const [categorizedJobs, setCategorizedJobs] = useState({
    active: [],
    pending: [],
    archived: [],
    featured: [],
    expired: [],
  });

  const [editingJob, setEditingJob] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const getRecruiterJobs = useCallback(async () => {
    try {
      const jobs = await fetchRecruiterJobs();

      const active = jobs.filter((job) => job.status === "active" && !job.is_archived && !job.isExpired);
      const pending = jobs.filter((job) => job.status === "pending_domain" && !job.is_archived);
      const archived = jobs.filter((job) => job.status === "archived" || job.is_archived);
      const featured = jobs.filter((job) => job.featured === true);
      const expired = jobs.filter((job) => job.isExpired === true);

      setCategorizedJobs({ active, pending, archived, featured, expired });
    } catch (error) {
      console.error("❌ Error fetching recruiter jobs:", error.message);
    }
  }, []);

  const handleEdit = (job) => {
    setEditingJob(job);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleArchive = async (jobId) => {
    try {
      await archiveJob(jobId);
      getRecruiterJobs();
      alert("Job archived successfully!");
    } catch (error) {
      console.error("❌ Error archiving job:", error.message);
      alert("Failed to archive job.");
    }
  };

  const handleUnarchive = async (jobId) => {
    try {
      await unarchiveJob(jobId);
      getRecruiterJobs();
      alert("Job unarchived successfully!");
    } catch (error) {
      console.error("Error unarchiving job:", error.message);
      alert("Failed to unarchive job.");
    }
  };

  useEffect(() => {
    getRecruiterJobs();
  }, [getRecruiterJobs]);

  return (
    <AccessGate allowedRoles={["recruiter", "admin"]}>
      <div className="recruiter-dashboard-container">
        <h1>Recruiter Dashboard</h1>

        <div style={styles.links}>
          <Link to="/recruiter/domains">Domain Verification</Link>
          <Link to="/recruiter/applications">Applications</Link>
        </div>

        {!showForm ? (
          <button onClick={() => setShowForm(true)}>➕ Add New Job</button>
        ) : (
          <>
            <AddJob
              jobToEdit={editingJob}
              onSuccess={() => {
                setShowForm(false);
                setEditingJob(null);
                getRecruiterJobs();
              }}
            />
            <button onClick={() => { setShowForm(false); setEditingJob(null); }}>
              Cancel
            </button>
          </>
        )}

        <JobTabs
          jobsByStatus={categorizedJobs}
          onEdit={handleEdit}
          onArchive={handleArchive}
          onUnarchive={handleUnarchive}
        />

      </div>
    </AccessGate>
  );
};

export default RecruiterDashboard;

const styles = {
  links: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 16,
  },
};
