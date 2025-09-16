import React, { useState, useEffect } from "react";
import {
  fetchRecruiterJobs,
  archiveJob,
  migrateRecruiterJobTemplates,
} from "../../utils/api";
import { useDispatch } from "react-redux";

import AddJob from "./AddJob";
import AccessGate from "../auth/AccessGate";
import JobTabs from "./JobTabs";

const RecruiterDashboard = () => {
  const dispatch = useDispatch();

  const [categorizedJobs, setCategorizedJobs] = useState({
    active: [],
    archived: [],
    featured: [],
    expired: [],
  });

  const [editingJob, setEditingJob] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const getRecruiterJobs = async () => {
    try {
      const jobs = await fetchRecruiterJobs();

      const active = jobs.filter((job) => job.status === "open" && !job.isExpired);
      const archived = jobs.filter((job) => job.status === "archived");
      const featured = jobs.filter((job) => job.featured === true);
      const expired = jobs.filter((job) => job.isExpired === true);

      setCategorizedJobs({ active, archived, featured, expired });
    } catch (error) {
      console.error("❌ Error fetching recruiter jobs:", error.message);
    }
  };

  const handleEdit = (job) => {
    setEditingJob(job);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleArchive = async (jobId) => {
    const confirm = window.confirm("Are you sure you want to archive this job?");
    if (!confirm) return;

    try {
      await archiveJob(jobId);
      getRecruiterJobs();
      alert("Job archived successfully!");
    } catch (error) {
      console.error("❌ Error archiving job:", error.message);
      alert("Failed to archive job.");
    }
  };

  const handleMigrateTemplates = async () => {
    try {
      await migrateRecruiterJobTemplates();
      alert("Job templates migrated successfully!");
      getRecruiterJobs();
    } catch (error) {
      console.error("❌ Error migrating job templates:", error.message);
      alert("Failed to migrate job templates");
    }
  };

  useEffect(() => {
    getRecruiterJobs();
  }, []);

  return (
    <AccessGate allowedRoles={["recruiter", "admin"]}>
      <div className="recruiter-dashboard-container">
        <h1>Recruiter Dashboard</h1>

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
        />

        <AccessGate allowedTiers={["premiumrecruiter", "admin"]}>
          <div style={{ marginTop: "30px" }}>
            <button onClick={handleMigrateTemplates}>Migrate Job Templates</button>
          </div>
        </AccessGate>
      </div>
    </AccessGate>
  );
};

export default RecruiterDashboard;
