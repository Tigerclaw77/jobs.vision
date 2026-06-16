import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  archiveJob,
  fetchUserProfile,
  fetchRecruiterJobs,
  pauseJob,
  resumeJob,
  unarchiveJob,
} from "../../utils/api";

import AddJob from "./AddJob";
import AccessGate from "../auth/AccessGate";
import { useEffectiveAuth } from "../auth/useEffectiveAuth";
import JobTabs from "./JobTabs";
import ProfileCompletionModule from "../Profile/ProfileCompletionModule";
import { recruiterCompletionSummary, shapeProfileForm } from "../Profile/profileUtils";
import "../../styles/Profile.css";

const POSTING_LABELS = {
  staff: "Staff Position",
  manager: "Manager Position",
  doctor: "Doctor Position",
};

const PAID_POSTING_STATUS_LABELS = {
  active: "Active",
  trialing: "Trialing",
  past_due: "Past Due",
  canceled: "Canceled",
  inactive: "Inactive",
};

function formatCurrentPosting(entitlement, user) {
  const tier = entitlement?.tier || user?.tier || "";
  if (tier && POSTING_LABELS[tier]) return POSTING_LABELS[tier];
  if (entitlement?.plan) {
    return String(entitlement.plan).replace(/^recruiter_/, "").replace(/_/g, " ");
  }
  return "No active paid posting";
}

const RecruiterDashboard = () => {
  const { user: reduxUser, userRole: reduxUserRole } = useSelector((state) => state.auth);
  const {
    user: effectiveUser,
    role: effectiveRole,
  } = useEffectiveAuth();
  const user = effectiveUser ?? reduxUser;
  const userRole = effectiveRole || reduxUserRole;
  const profileFallbackUser = useMemo(
    () => ({
      firstName: user?.firstName || user?.first_name || "",
      lastName: user?.lastName || user?.last_name || "",
      email: user?.email || "",
      company: user?.company || "",
    }),
    [
      user?.firstName,
      user?.first_name,
      user?.lastName,
      user?.last_name,
      user?.email,
      user?.company,
    ]
  );
  const [categorizedJobs, setCategorizedJobs] = useState({
    active: [],
    pending: [],
    draft: [],
    paused: [],
    archived: [],
    featured: [],
    expired: [],
  });
  const [profileCompletion, setProfileCompletion] = useState(null);
  const [editingJob, setEditingJob] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [dashboardError, setDashboardError] = useState("");

  const categorizeJobs = useCallback((jobs = []) => {
    const active = jobs.filter(
      (job) => job.status === "active" && !job.is_archived && !job.isExpired
    );
    const pending = jobs.filter(
      (job) => job.status === "pending_domain" && !job.is_archived
    );
    const draft = jobs.filter((job) => job.status === "draft" && !job.is_archived);
    const paused = jobs.filter((job) => job.status === "paused" && !job.is_archived);
    const archived = jobs.filter((job) => job.status === "archived" || job.is_archived);
    const featured = jobs.filter((job) => job.featured === true);
    const expired = jobs.filter((job) => job.isExpired === true);

    setCategorizedJobs({ draft, active, paused, expired, archived, pending, featured });
  }, []);

  const getRecruiterDashboard = useCallback(async () => {
    setDashboardError("");

    const [jobsResult, profileResult] = await Promise.allSettled([
      fetchRecruiterJobs(),
      fetchUserProfile(),
    ]);

    if (jobsResult.status === "fulfilled") {
      categorizeJobs(jobsResult.value || []);
    } else {
      console.error("Error fetching recruiter jobs:", jobsResult.reason?.message || jobsResult.reason);
      setDashboardError("Could not load recruiter jobs.");
      categorizeJobs([]);
    }

    if (profileResult.status === "fulfilled") {
      const apiCompletion = profileResult.value?.profileCompletion;
      if (apiCompletion?.score !== undefined && apiCompletion?.score !== null) {
        setProfileCompletion(apiCompletion);
      } else {
        setProfileCompletion(
          recruiterCompletionSummary(shapeProfileForm(profileResult.value?.profile, profileFallbackUser))
        );
      }
    } else {
      setProfileCompletion(null);
    }

  }, [categorizeJobs, profileFallbackUser]);

  const recruiterEntitlement = user?.entitlements?.recruiter || null;
  const isAdmin = String(userRole || user?.userRole || "").toLowerCase() === "admin";
  const subscriptionActive = isAdmin || recruiterEntitlement?.active === true;
  const maxActiveJobs = isAdmin ? null : recruiterEntitlement?.maxActiveJobs ?? 0;
  const slotJobsUsed = categorizedJobs.active.length + categorizedJobs.pending.length;
  const remainingSlots =
    maxActiveJobs === null ? null : Math.max(0, Number(maxActiveJobs || 0) - slotJobsUsed);
  const atSlotCapacity =
    subscriptionActive && maxActiveJobs !== null && remainingSlots === 0;
  const canPublishJob =
    isAdmin || (subscriptionActive && (maxActiveJobs === null || remainingSlots > 0));
  const currentPosting = isAdmin ? "Admin Posting View" : formatCurrentPosting(recruiterEntitlement, user);
  const paidPostingStatus = isAdmin
    ? "Active"
    : PAID_POSTING_STATUS_LABELS[String(recruiterEntitlement?.status || "inactive").toLowerCase()] ||
      recruiterEntitlement?.status ||
      "Inactive";
  const nextAction = !subscriptionActive
    ? "Create the posting first. Checkout appears when it is ready."
    : "Manage your listings.";

  const handleAddJobClick = useCallback(() => {
    setEditingJob(null);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleEdit = useCallback((job) => {
    setEditingJob(job);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleArchive = useCallback(async (jobId) => {
    try {
      await archiveJob(jobId);
      await getRecruiterDashboard();
      alert("Posting removed.");
    } catch (error) {
      console.error("Error archiving job:", error.message);
      alert("Failed to remove posting.");
    }
  }, [getRecruiterDashboard]);

  const handlePause = useCallback(async (jobId) => {
    try {
      await pauseJob(jobId);
      await getRecruiterDashboard();
      alert("Posting hidden. It is no longer visible in public search or map.");
    } catch (error) {
      console.error("Error pausing job:", error.message);
      alert("Failed to hide posting.");
    }
  }, [getRecruiterDashboard]);

  const handleResume = useCallback(async (jobId) => {
    try {
      await resumeJob(jobId);
      await getRecruiterDashboard();
      alert("Posting is live again.");
    } catch (error) {
      console.error("Error resuming job:", error.message);
      alert(error?.response?.data?.error || "Failed to make posting live.");
    }
  }, [getRecruiterDashboard]);

  const handleUnarchive = useCallback(async (jobId) => {
    try {
      await unarchiveJob(jobId);
      await getRecruiterDashboard();
      alert("Posting restored.");
    } catch (error) {
      console.error("Error unarchiving job:", error.message);
      alert("Failed to restore posting.");
    }
  }, [getRecruiterDashboard]);

  useEffect(() => {
    getRecruiterDashboard();
  }, [getRecruiterDashboard]);

  return (
    <AccessGate allowedRoles={["recruiter", "admin"]}>
      <div className="dashboard-container recruiter-dashboard-container">
        <div className="recruiter-dashboard-header">
          <div>
            <h1>My Jobs</h1>
            <p className="dashboard-subtitle">{nextAction}</p>
          </div>
        </div>

        {dashboardError && <p className="dashboard-error">{dashboardError}</p>}

        <section className="recruiter-listings-section" aria-label="My jobs">
          {!showForm ? (
            <div className="recruiter-action-row">
              <button
                type="button"
                onClick={handleAddJobClick}
              >
                Post New Job
              </button>
            </div>
          ) : (
            <>
              <AddJob
                jobToEdit={editingJob}
                canPublish={canPublishJob}
                planRequired={!subscriptionActive && !isAdmin}
                slotLimitReached={atSlotCapacity && !isAdmin}
                recruiterTier={recruiterEntitlement?.tier || user?.tier || ""}
                isAdmin={isAdmin}
                onSuccess={() => {
                  setShowForm(false);
                  setEditingJob(null);
                  getRecruiterDashboard();
                }}
              />
              <button
                type="button"
                className="recruiter-cancel-form-button"
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
            onPause={handlePause}
            onResume={handleResume}
            onArchive={handleArchive}
            onUnarchive={handleUnarchive}
          />
        </section>

        <details className="recruiter-secondary-panel" aria-label="Recruiter account tools">
          <summary>Account tools</summary>
          <div className="recruiter-secondary-content">
            <div className="recruiter-current-posting">
              <span>Current Posting</span>
              <strong>{currentPosting}</strong>
              <p>{subscriptionActive ? `${paidPostingStatus} Paid Posting` : "No active paid posting yet."}</p>
            </div>

            {profileCompletion && (
              <div className="recruiter-profile-completion-banner">
                <ProfileCompletionModule
                  completion={profileCompletion}
                  compact
                  includeOptional={false}
                  titleLabel="Business Details"
                  completeLabel="Business Details Ready"
                  readyText="Business details are ready"
                />
                <Link to="/recruiter/profile" className="profile-completion-banner-link">
                  Edit business details
                </Link>
              </div>
            )}

            <div className="recruiter-dashboard-links">
              <Link to="/recruiter/applications">Applicants</Link>
              <Link to="/recruiter/profile">Business Details</Link>
              <Link to="/recruiter/domains">Employer Verification</Link>
            </div>
          </div>
        </details>
      </div>
    </AccessGate>
  );
};

export default RecruiterDashboard;
