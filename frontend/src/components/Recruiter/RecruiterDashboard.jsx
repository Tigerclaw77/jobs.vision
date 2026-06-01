import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  archiveJob,
  fetchRecruiterApplications,
  fetchRecruiterJobs,
  unarchiveJob,
} from "../../utils/api";

import AddJob from "./AddJob";
import AccessGate from "../auth/AccessGate";
import JobTabs from "./JobTabs";

const PLAN_LABELS = {
  staff: "Staff",
  manager: "Manager",
  doctor: "Doctor",
};

const STATUS_LABELS = {
  active: "Active",
  trialing: "Trialing",
  past_due: "Past Due",
  canceled: "Canceled",
  inactive: "Inactive",
};

function formatPlanName(entitlement, user) {
  const tier = entitlement?.tier || user?.tier || "";
  if (tier && PLAN_LABELS[tier]) return `${PLAN_LABELS[tier]} Plan`;
  if (entitlement?.plan) {
    return String(entitlement.plan).replace(/^recruiter_/, "").replace(/_/g, " ");
  }
  return "No Active Plan";
}

function formatSlotLimit(maxActiveJobs) {
  if (maxActiveJobs === null) return "Unlimited";
  const numeric = Number(maxActiveJobs || 0);
  return Number.isFinite(numeric) ? String(numeric) : "0";
}

const RecruiterDashboard = () => {
  const { user, userRole } = useSelector((state) => state.auth);
  const [categorizedJobs, setCategorizedJobs] = useState({
    active: [],
    pending: [],
    archived: [],
    featured: [],
    expired: [],
  });
  const [applications, setApplications] = useState([]);
  const [editingJob, setEditingJob] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState("");

  const categorizeJobs = useCallback((jobs = []) => {
    const active = jobs.filter(
      (job) => job.status === "active" && !job.is_archived && !job.isExpired
    );
    const pending = jobs.filter(
      (job) => job.status === "pending_domain" && !job.is_archived
    );
    const archived = jobs.filter((job) => job.status === "archived" || job.is_archived);
    const featured = jobs.filter((job) => job.featured === true);
    const expired = jobs.filter((job) => job.isExpired === true);

    setCategorizedJobs({ active, pending, archived, featured, expired });
  }, []);

  const getRecruiterDashboard = useCallback(async () => {
    setLoading(true);
    setDashboardError("");

    const [jobsResult, applicationsResult] = await Promise.allSettled([
      fetchRecruiterJobs(),
      fetchRecruiterApplications(),
    ]);

    if (jobsResult.status === "fulfilled") {
      categorizeJobs(jobsResult.value || []);
    } else {
      console.error("Error fetching recruiter jobs:", jobsResult.reason?.message || jobsResult.reason);
      setDashboardError("Could not load recruiter jobs.");
      categorizeJobs([]);
    }

    if (applicationsResult.status === "fulfilled") {
      setApplications(applicationsResult.value || []);
    } else {
      console.error(
        "Error fetching recruiter applications:",
        applicationsResult.reason?.message || applicationsResult.reason
      );
      setDashboardError((current) =>
        current ? `${current} Could not load applications.` : "Could not load applications."
      );
      setApplications([]);
    }

    setLoading(false);
  }, [categorizeJobs]);

  const recruiterEntitlement = user?.entitlements?.recruiter || null;
  const isAdmin = String(userRole || user?.userRole || "").toLowerCase() === "admin";
  const subscriptionActive = isAdmin || recruiterEntitlement?.active === true;
  const maxActiveJobs = isAdmin ? null : recruiterEntitlement?.maxActiveJobs ?? 0;
  const slotJobsUsed = categorizedJobs.active.length + categorizedJobs.pending.length;
  const remainingSlots =
    maxActiveJobs === null ? null : Math.max(0, Number(maxActiveJobs || 0) - slotJobsUsed);
  const atSlotCapacity =
    subscriptionActive && maxActiveJobs !== null && remainingSlots === 0;
  const canCreateJob =
    isAdmin || (subscriptionActive && (maxActiveJobs === null || remainingSlots > 0));
  const planName = isAdmin ? "Admin Access" : formatPlanName(recruiterEntitlement, user);
  const statusLabel = isAdmin
    ? "Active"
    : STATUS_LABELS[String(recruiterEntitlement?.status || "inactive").toLowerCase()] ||
      recruiterEntitlement?.status ||
      "Inactive";
  const slotLimit = formatSlotLimit(maxActiveJobs);
  const slotSummary =
    maxActiveJobs === null ? `${slotJobsUsed} used` : `${slotJobsUsed} / ${slotLimit} used`;
  const nextAction = !subscriptionActive
    ? "Choose a recruiter plan before posting jobs."
    : atSlotCapacity
    ? "Archive a live job or upgrade before creating another one."
    : maxActiveJobs === null
    ? "You can create jobs without a slot limit."
    : `${remainingSlots} job slot${remainingSlots === 1 ? "" : "s"} available.`;

  const handleAddJobClick = () => {
    if (!canCreateJob) return;
    setEditingJob(null);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleEdit = (job) => {
    setEditingJob(job);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleArchive = async (jobId) => {
    try {
      await archiveJob(jobId);
      await getRecruiterDashboard();
      alert("Job archived successfully!");
    } catch (error) {
      console.error("Error archiving job:", error.message);
      alert("Failed to archive job.");
    }
  };

  const handleUnarchive = async (jobId) => {
    try {
      await unarchiveJob(jobId);
      await getRecruiterDashboard();
      alert("Job unarchived successfully!");
    } catch (error) {
      console.error("Error unarchiving job:", error.message);
      alert("Failed to unarchive job.");
    }
  };

  useEffect(() => {
    getRecruiterDashboard();
  }, [getRecruiterDashboard]);

  return (
    <AccessGate allowedRoles={["recruiter", "admin"]}>
      <div className="dashboard-container recruiter-dashboard-container">
        <div className="recruiter-dashboard-header">
          <div>
            <h1>Recruiter Dashboard</h1>
            <p className="dashboard-subtitle">{nextAction}</p>
          </div>

          <div className="recruiter-dashboard-links">
            <Link to="/recruiter/domains">Domain Verification</Link>
            <Link to="/recruiter/applications">Applications</Link>
          </div>
        </div>

        {dashboardError && <p className="dashboard-error">{dashboardError}</p>}

        <section className="recruiter-summary-grid" aria-label="Recruiter account summary">
          <div className="recruiter-summary-card">
            <span className="summary-label">Active Jobs</span>
            <strong>{loading ? "-" : categorizedJobs.active.length}</strong>
            <p>Live jobs visible to candidates.</p>
          </div>

          <div className="recruiter-summary-card">
            <span className="summary-label">Job Slots Used</span>
            <strong>{loading ? "-" : slotSummary}</strong>
            <p>Active and pending verification jobs count toward slots.</p>
          </div>

          <div className="recruiter-summary-card">
            <span className="summary-label">Current Plan</span>
            <strong>{planName}</strong>
            <p>
              {statusLabel} - {slotLimit} job slot{slotLimit === "1" ? "" : "s"}.
            </p>
          </div>

          <div className="recruiter-summary-card">
            <span className="summary-label">Applications Received</span>
            <strong>{loading ? "-" : applications.length}</strong>
            <p>
              <Link to="/recruiter/applications">Review applicants</Link>
            </p>
          </div>
        </section>

        {atSlotCapacity && !isAdmin && (
          <div className="upgrade-banner recruiter-capacity-banner">
            <p>
              <strong>You are using all available job slots.</strong>
            </p>
            <p>
              Archive an active or pending job to free a slot, or upgrade for more capacity.
              Manager includes 5 active slots and Doctor includes 10.
            </p>
            <Link to="/">View recruiter plans</Link>
          </div>
        )}

        {!subscriptionActive && !isAdmin && (
          <div className="upgrade-banner recruiter-capacity-banner">
            <p>
              <strong>No active recruiter plan is attached to this account.</strong>
            </p>
            <p>Choose a recruiter plan before creating a public job post.</p>
            <Link to="/">View recruiter plans</Link>
          </div>
        )}

        {!showForm ? (
          <div className="recruiter-action-row">
            <button
              type="button"
              onClick={handleAddJobClick}
              disabled={!canCreateJob}
              aria-describedby="recruiter-slot-state"
            >
              Add New Job
            </button>
            <span id="recruiter-slot-state">{nextAction}</span>
          </div>
        ) : (
          <>
            <AddJob
              jobToEdit={editingJob}
              onSuccess={() => {
                setShowForm(false);
                setEditingJob(null);
                getRecruiterDashboard();
              }}
            />
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingJob(null);
              }}
            >
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
