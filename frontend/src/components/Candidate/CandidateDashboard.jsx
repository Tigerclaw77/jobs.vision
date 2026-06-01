import React from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import AccessGate from "../auth/AccessGate";
import RequireVerifiedEmail from "../auth/RequireVerifiedEmail";

function isPremiumTier(tier) {
  const value = String(tier || "").toLowerCase();
  return ["1", "2", "3", "premium", "candidate_basic", "candidate_premium"].includes(value);
}

const CandidateDashboard = () => {
  const { user } = useSelector((state) => state.auth);
  const { appliedJobs = [], favorites = [] } = useSelector((state) => state.jobs);
  const premium = isPremiumTier(user?.tier);

  return (
    <AccessGate allowedRoles={["candidate"]}>
      <div className="dashboard-container">
        <h1>Welcome, {user?.profile?.firstName || user?.firstName || "Candidate"}</h1>

        <RequireVerifiedEmail>
          <section className="dashboard-section">
            <h2>Job Application Summary</h2>
            <p>
              You have applied to <strong>{appliedJobs.length}</strong> job
              {appliedJobs.length !== 1 && "s"} so far.
            </p>

            <h3>Saved Jobs</h3>
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

          {premium && (
            <section className="dashboard-section premium-highlight">
              <h2>Premium Insights</h2>
              <p>You can now access advanced filters and resume feedback tools.</p>
              <Link to="/jobs">Browse jobs</Link>
            </section>
          )}

          {!premium && (
            <section className="upgrade-banner">
              <p>
                Upgrade to <strong>Premium</strong> to unlock job analytics, resume feedback,
                and featured visibility.
              </p>
              <Link to="/jobs">Browse jobs</Link>
            </section>
          )}
        </RequireVerifiedEmail>
      </div>
    </AccessGate>
  );
};

export default CandidateDashboard;
