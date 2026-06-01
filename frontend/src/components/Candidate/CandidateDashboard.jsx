import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import AccessGate from "../auth/AccessGate";
import JobModal from "../JobSearch/JobModal";
import {
  applyToJob,
  fetchFavoriteJobs,
  removeJobFromFavorites,
} from "../../utils/api.supabase";
import { fetchUserJobData } from "../../store/jobSlice";

const SAVE_SLOT_COUNT = 5;

function hasPremiumFeatures(user) {
  const candidate = user?.entitlements?.candidate;
  if (candidate?.features?.premiumInsights) return true;

  const values = [user?.tier, candidate?.tier, candidate?.plan]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());
  return values.some((value) => value === "premium" || value === "candidate_premium");
}

function hasUnlimitedSaves(user) {
  const candidate = user?.entitlements?.candidate;
  if (candidate?.features?.unlimitedSaves === true) return true;

  const values = [user?.tier, candidate?.tier, candidate?.plan]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());
  return values.some((value) =>
    ["plus", "premium", "candidate_plus", "candidate_premium"].includes(value)
  );
}

function getFavoriteJobId(favorite) {
  return String(favorite?.job_id || favorite?.jobs?.id || favorite?.id || favorite?._id || "");
}

function mapFavoriteJob(favorite) {
  const job = favorite?.jobs || favorite?.job || favorite || {};
  const id = String(job.id || favorite?.job_id || job._id || "");

  return {
    _id: id,
    id,
    title: job.title || "Saved Job",
    company: job.employer_name || job.company || job.venue_name || "Unknown Employer",
    location: job.location || [job.city, job.state].filter(Boolean).join(", ") || "Location not listed",
    role: job.role || "",
    hours: job.hours || "",
    type: job.type || "",
    opportunity_type: job.opportunity_type || "",
    practice_type: job.practice_type || "",
    employment_type: job.employment_type || "",
    salary: job.salary || "",
    description: job.description || "",
    status: job.status || "",
  };
}

const CandidateDashboard = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const {
    appliedJobs = [],
    favorites = [],
    recruiterJobs = [],
    hiddenJobs = [],
  } = useSelector((state) => state.jobs);
  const [favoriteRows, setFavoriteRows] = useState([]);
  const [favoritesLoading, setFavoritesLoading] = useState(true);
  const [favoritesError, setFavoritesError] = useState("");
  const [selectedJob, setSelectedJob] = useState(null);
  const [removingJobId, setRemovingJobId] = useState("");

  const premium = hasPremiumFeatures(user);
  const unlimitedSaves = hasUnlimitedSaves(user);
  const favoriteJobs = useMemo(() => favoriteRows.map(mapFavoriteJob), [favoriteRows]);
  const favoriteIds = useMemo(
    () => favoriteRows.map(getFavoriteJobId).filter(Boolean),
    [favoriteRows]
  );
  const savedJobCount =
    favoritesLoading && favoriteRows.length === 0 ? favorites.length : favoriteJobs.length;
  const freeSlotsUsed = Math.min(savedJobCount, SAVE_SLOT_COUNT);
  const freeSlotRows = Array.from({ length: SAVE_SLOT_COUNT }, (_, index) => {
    return favoriteJobs[index] || null;
  });
  const visibleRows = unlimitedSaves ? favoriteJobs : freeSlotRows;
  const appliedJobIds = useMemo(
    () => new Set((appliedJobs || []).map((jobId) => String(jobId))),
    [appliedJobs]
  );

  useEffect(() => {
    let mounted = true;

    async function loadFavorites() {
      setFavoritesLoading(true);
      setFavoritesError("");
      try {
        const rows = await fetchFavoriteJobs();
        if (mounted) setFavoriteRows(Array.isArray(rows) ? rows : []);
      } catch (error) {
        if (mounted) setFavoritesError(error?.message || "Unable to load saved jobs.");
      } finally {
        if (mounted) setFavoritesLoading(false);
      }
    }

    loadFavorites();
    return () => {
      mounted = false;
    };
  }, []);

  const syncFavoriteIds = (nextRows) => {
    dispatch(
      fetchUserJobData({
        savedJobs: nextRows.map(getFavoriteJobId).filter(Boolean),
        appliedJobs,
        recruiterJobs,
        hiddenJobs,
      })
    );
  };

  const removeFavorite = async (jobId) => {
    if (!jobId) return;
    setRemovingJobId(jobId);
    setFavoritesError("");
    try {
      await removeJobFromFavorites(jobId);
      setFavoriteRows((prev) => {
        const next = prev.filter((row) => getFavoriteJobId(row) !== String(jobId));
        syncFavoriteIds(next);
        return next;
      });
      if (selectedJob?._id === jobId) setSelectedJob(null);
    } catch (error) {
      setFavoritesError(error?.message || "Unable to remove saved job.");
    } finally {
      setRemovingJobId("");
    }
  };

  const handleApply = async (jobId) => {
    if (!jobId) return;
    try {
      await applyToJob(jobId);
      dispatch(
        fetchUserJobData({
          savedJobs: favoriteIds,
          appliedJobs: Array.from(new Set([...appliedJobs.map(String), String(jobId)])),
          recruiterJobs,
          hiddenJobs,
        })
      );
    } catch (error) {
      alert(error?.message || "Unable to apply to this job.");
    }
  };

  return (
    <AccessGate allowedRoles={["candidate"]}>
      <div className="dashboard-container">
        <h1>Welcome, {user?.profile?.firstName || user?.firstName || "Candidate"}</h1>

        <section className="dashboard-section">
          <h2>Job Application Summary</h2>
          <p>
            You have applied to <strong>{appliedJobs.length}</strong> job
            {appliedJobs.length !== 1 && "s"} so far.
          </p>

          <h3>Saved Jobs</h3>
          {savedJobCount > 0 ? (
            <p>
              You have saved <strong>{savedJobCount}</strong> job
              {savedJobCount !== 1 && "s"}.
            </p>
          ) : (
            <p>No jobs saved yet. Start browsing!</p>
          )}
        </section>

        <section className="dashboard-section saved-capacity-card">
          <h2>Saved Jobs Capacity</h2>

          {!unlimitedSaves && (
            <p className="save-slot-status">
              {freeSlotsUsed} / {SAVE_SLOT_COUNT} Slots Used
            </p>
          )}
          {unlimitedSaves && (
            <p className="save-slot-status">Unlimited Saves Enabled</p>
          )}

          {favoritesError && <p className="save-slot-error">{favoritesError}</p>}

          <div className="save-slot-list">
            {visibleRows.length === 0 && unlimitedSaves ? (
              <p className="save-slot-empty-note">No saved jobs yet. Start browsing!</p>
            ) : (
              visibleRows.map((job, index) =>
                job ? (
                  <div
                    key={job._id || index}
                    role="button"
                    tabIndex={0}
                    className="save-slot-row-button occupied"
                    onClick={() => setSelectedJob(job)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedJob(job);
                      }
                    }}
                  >
                    <span className="save-slot-job-text">
                      {job.company} - {job.location}
                    </span>
                    <button
                      type="button"
                      className="save-slot-remove"
                      aria-label={`Remove ${job.company}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        removeFavorite(job._id);
                      }}
                    >
                      {removingJobId === job._id ? "Removing..." : "Remove"}
                    </button>
                  </div>
                ) : (
                  <div key={`empty-${index}`} className="save-slot-row-button empty">
                    Available Save Slot
                  </div>
                )
              )
            )}
          </div>

          {favoritesLoading && <p className="save-slot-loading">Loading saved jobs...</p>}
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
            <h2>Upgrade Your Candidate Plan</h2>
            <div className="candidate-upgrade-options">
              <div>
                <h3>Plus</h3>
                <ul>
                  <li>Unlimited saves</li>
                  <li>Map search</li>
                  <li>Email alerts</li>
                </ul>
              </div>
              <div>
                <h3>Premium</h3>
                <ul>
                  <li>Everything in Plus</li>
                  <li>SMS alerts</li>
                  <li>Featured profile placement</li>
                </ul>
              </div>
            </div>
            <Link to="/jobs">Browse jobs</Link>
          </section>
        )}

        <JobModal
          isOpen={!!selectedJob}
          job={selectedJob}
          isFavorite={!!selectedJob}
          isApplied={selectedJob ? appliedJobIds.has(String(selectedJob._id)) : false}
          savedTooltip="Remove saved job"
          appliedTooltip={
            selectedJob && appliedJobIds.has(String(selectedJob._id))
              ? "Already applied"
              : "Apply to this job"
          }
          onFavoriteClick={removeFavorite}
          onApply={handleApply}
          onClose={() => setSelectedJob(null)}
          isAuthed={true}
        />
      </div>
    </AccessGate>
  );
};

export default CandidateDashboard;
