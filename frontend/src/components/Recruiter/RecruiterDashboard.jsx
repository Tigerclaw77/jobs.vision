import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  archiveJob,
  fetchUserProfile,
  fetchRecruiterApplications,
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
  const [applications, setApplications] = useState([]);
  const [profileCompletion, setProfileCompletion] = useState(null);
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
    const draft = jobs.filter((job) => job.status === "draft" && !job.is_archived);
    const paused = jobs.filter((job) => job.status === "paused" && !job.is_archived);
    const archived = jobs.filter((job) => job.status === "archived" || job.is_archived);
    const featured = jobs.filter((job) => job.featured === true);
    const expired = jobs.filter((job) => job.isExpired === true);

    setCategorizedJobs({ draft, active, paused, expired, archived, pending, featured });
  }, []);

  const getRecruiterDashboard = useCallback(async () => {
    setLoading(true);
    setDashboardError("");

    const [jobsResult, applicationsResult, profileResult] = await Promise.allSettled([
      fetchRecruiterJobs(),
      fetchRecruiterApplications(),
      fetchUserProfile(),
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
        current ? `${current} Could not load applicants.` : "Could not load applicants."
      );
      setApplications([]);
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

    setLoading(false);
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
    ? "Write the job now. Checkout starts when the posting is ready."
    : atSlotCapacity
    ? "Remove a live job or review capacity options before publishing another one."
    : maxActiveJobs === null
    ? "You can create jobs without a slot limit."
    : `${remainingSlots} job slot${remainingSlots === 1 ? "" : "s"} available.`;

  const handleAddJobClick = () => {
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
      alert("Posting removed.");
    } catch (error) {
      console.error("Error archiving job:", error.message);
      alert("Failed to remove posting.");
    }
  };

  const handlePause = async (jobId) => {
    try {
      await pauseJob(jobId);
      await getRecruiterDashboard();
      alert("Posting hidden. It is no longer visible in public search or map.");
    } catch (error) {
      console.error("Error pausing job:", error.message);
      alert("Failed to hide posting.");
    }
  };

  const handleResume = async (jobId) => {
    try {
      await resumeJob(jobId);
      await getRecruiterDashboard();
      alert("Posting is live again.");
    } catch (error) {
      console.error("Error resuming job:", error.message);
      alert(error?.response?.data?.error || "Failed to make posting live.");
    }
  };

  const handleUnarchive = async (jobId) => {
    try {
      await unarchiveJob(jobId);
      await getRecruiterDashboard();
      alert("Posting restored.");
    } catch (error) {
      console.error("Error unarchiving job:", error.message);
      alert("Failed to restore posting.");
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
                aria-describedby="recruiter-slot-state"
              >
                Post New Job
              </button>
              <span id="recruiter-slot-state">{nextAction}</span>
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

        <section className="recruiter-summary-grid" aria-label="Recruiter account summary">
          <div className="recruiter-summary-card">
            <span className="summary-label">Live Jobs</span>
            <strong>{loading ? "-" : categorizedJobs.active.length}</strong>
            <p>Published jobs visible to candidates.</p>
          </div>

          <div className="recruiter-summary-card">
            <span className="summary-label">Live Posting Limit</span>
            <strong>{loading ? "-" : slotSummary}</strong>
            <p>Live and pending jobs count toward your posting limit. Unfinished jobs do not.</p>
          </div>

          <div className="recruiter-summary-card">
            <span className="summary-label">Posting Access</span>
            <strong>{planName}</strong>
            <p>
              {statusLabel} - {slotLimit} job slot{slotLimit === "1" ? "" : "s"}.
            </p>
          </div>

          <div className="recruiter-summary-card">
            <span className="summary-label">Applicants</span>
            <strong>{loading ? "-" : applications.length}</strong>
            <p>
              <Link to="/recruiter/applications">View applicants</Link>
            </p>
          </div>
        </section>

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

        {atSlotCapacity && !isAdmin && (
          <div className="upgrade-banner recruiter-capacity-banner">
            <p>
              <strong>You are using all available job slots.</strong>
            </p>
            <p>
              Remove a live or pending job to free a posting, or review capacity options.
              Manager includes 5 active slots and Doctor includes 10.
            </p>
            <Link to="/pricing">Review capacity options</Link>
          </div>
        )}

        {!subscriptionActive && !isAdmin && (
          <div className="upgrade-banner recruiter-capacity-banner">
            <p>
              <strong>No paid posting is active yet.</strong>
            </p>
            <p>You can write the job first. Checkout appears when the posting is ready.</p>
          </div>
        )}

        <section className="recruiter-secondary-panel" aria-label="Recruiter account tools">
          <h2>Settings</h2>
          <div className="recruiter-dashboard-links">
            <Link to="/recruiter/domains">Employer Verification</Link>
            <Link to="/recruiter/applications">Applicants</Link>
            <Link to="/recruiter/profile">Business Details</Link>
          </div>
        </section>
      </div>
    </AccessGate>
  );
};

export default RecruiterDashboard;
