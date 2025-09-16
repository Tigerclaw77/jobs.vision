import React from "react";
import { useSelector } from "react-redux";
import AccessGate from "../auth/AccessGate";
import RequireVerifiedEmail from "../auth/RequireVerifiedEmail";

const CandidateDashboard = () => {
  const { user } = useSelector((state) => state.auth);
  const { appliedJobs = [], favorites = [], tier = 0 } = useSelector((state) => state.jobs);

  return (
    <AccessGate allowedRoles={["candidate"]}>
      <div className="dashboard-container">
        <h1>Welcome, {user?.profile?.firstName || "Candidate"} 👋</h1>

        {/* Require Verified Email */}
        <RequireVerifiedEmail>
          <section className="dashboard-section">
            <h2>🎯 Job Application Summary</h2>
            <p>
              You’ve applied to <strong>{appliedJobs.length}</strong> job
              {appliedJobs.length !== 1 && "s"} so far.
            </p>

            <h3>📌 Saved Jobs</h3>
            {favorites.length > 0 ? (
              <ul>
                {favorites.map((jobId) => (
                  <li key={jobId}>{jobId}</li>
                ))}
              </ul>
            ) : (
              <p>No jobs saved yet. Start browsing!</p>
            )}
          </section>

          {/* Premium Feature Block */}
          <AccessGate allowedTiers={[3]}>
            <section className="dashboard-section premium-highlight">
              <h2>🌟 Premium Insights</h2>
              <p>You can now access advanced filters and resume feedback tools.</p>
              <button>Go to Premium Tools</button>
            </section>
          </AccessGate>

          {/* Free Tier Upgrade Prompt */}
          {tier === 0 && (
            <section className="upgrade-banner">
              <p>
                Upgrade to <strong>Premium</strong> to unlock job analytics, resume feedback,
                and featured visibility.
              </p>
              <button>Upgrade Now</button>
            </section>
          )}
        </RequireVerifiedEmail>
      </div>
    </AccessGate>
  );
};

export default CandidateDashboard;
