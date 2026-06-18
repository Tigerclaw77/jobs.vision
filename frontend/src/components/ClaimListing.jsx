import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { claimJobListing, fetchPublicJob } from "../utils/api.supabase";
import { useAuth } from "./auth/AuthProvider";
import "./ClaimListing.css";

const EMPLOYER_CLAIM_ROLES = new Set([
  "recruiter",
  "employer",
  "practice_owner",
  "hiring_manager",
  "admin",
]);

export default function ClaimListing() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth();
  const returnTo = `${location.pathname}${location.search || ""}`;
  const userRole = String(
    auth.role ||
      auth.profile?.role ||
      auth.account?.profile?.role ||
      auth.account?.role ||
      ""
  ).toLowerCase();
  const isAuthenticated = Boolean(auth.session);
  const canSubmit = isAuthenticated && EMPLOYER_CLAIM_ROLES.has(userRole);

  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    requester_name: "",
    company_name: "",
    company_website: "",
    message: "",
  });

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setMessage("");
      try {
        const row = await fetchPublicJob(jobId);
        if (mounted) {
          setJob(row);
          setForm((current) => ({
            ...current,
            company_name: row.company || "",
          }));
        }
      } catch (error) {
        if (mounted) setMessage(error?.message || "Unable to load this listing.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [jobId]);

  useEffect(() => {
    if (auth.loading) return;
    if (!isAuthenticated) {
      navigate(`/login?next=${encodeURIComponent(returnTo)}`, { replace: true });
    }
  }, [auth.loading, isAuthenticated, navigate, returnTo]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setMessage("");
    try {
      await claimJobListing(jobId, form);
      setMessage("Claim submitted. An admin will review it.");
      setJob((current) => (current ? { ...current, claim_status: "pending" } : current));
    } catch (error) {
      setMessage(error?.message || "We couldn't submit this claim. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const alreadyClaimed = job?.claim_status === "claimed" || Boolean(job?.claimed_by_user_id);
  const claimPending = job?.claim_status === "pending";

  if (auth.loading) {
    return (
      <main className="claim-listing-page text-on-dim">
        <section className="claim-listing-panel">
          <button type="button" className="claim-back" onClick={() => navigate("/jobs")}>
            Back to Jobs
          </button>
          <p className="claim-message">Checking your account...</p>
        </section>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="claim-listing-page text-on-dim">
        <section className="claim-listing-panel">
          <button type="button" className="claim-back" onClick={() => navigate("/jobs")}>
            Back to Jobs
          </button>
          <p className="claim-message">Redirecting to sign in...</p>
        </section>
      </main>
    );
  }

  if (!canSubmit) {
    return (
      <main className="claim-listing-page text-on-dim">
        <section className="claim-listing-panel">
          <button type="button" className="claim-back" onClick={() => navigate("/jobs")}>
            Back to Jobs
          </button>
          <h1>Listing management unavailable</h1>
          <p className="claim-intro">
            Listing management is available only to employer-capable accounts.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="claim-listing-page text-on-dim">
      <section className="claim-listing-panel">
        <button type="button" className="claim-back" onClick={() => navigate("/jobs")}>
          Back to Jobs
        </button>

        <p className="claim-eyebrow">Employer Listing Claim</p>
        <h1>Claim this Listing</h1>
        <p className="claim-intro">
          Public listings help candidates discover real opportunities from employer career pages.
          Claiming a listing lets your team verify ownership and manage it directly on jobs.vision.
        </p>

        {loading ? <p className="claim-message">Loading listing...</p> : null}
        {message ? <p className="claim-message">{message}</p> : null}

        {job ? (
          <div className="claim-job-summary">
            <h2>{job.title}</h2>
            <p>{job.company || "Unknown employer"}</p>
            {job.location ? <p>{job.location}</p> : null}
            <span>{alreadyClaimed ? "Claimed" : claimPending ? "Claim Pending" : "Unclaimed"}</span>
          </div>
        ) : null}

        <div className="claim-grid">
          <div>
            <h3>Public Listing</h3>
            <ul>
              <li>Discovered from an employer careers page.</li>
              <li>May include only public information already available online.</li>
              <li>Can remain visible but is not employer-managed yet.</li>
            </ul>
          </div>
          <div>
            <h3>Employer Managed</h3>
            <ul>
              <li>Update listing details directly.</li>
              <li>Improve candidate trust with a managed listing badge.</li>
              <li>Keep location, compensation, and apply details current.</li>
            </ul>
          </div>
        </div>

        {alreadyClaimed || claimPending ? null : (
          <form className="claim-form" onSubmit={handleSubmit}>
            <label>
              Your Name
              <input
                value={form.requester_name}
                onChange={(event) => updateField("requester_name", event.target.value)}
              />
            </label>
            <label>
              Company Name
              <input
                value={form.company_name}
                onChange={(event) => updateField("company_name", event.target.value)}
              />
            </label>
            <label>
              Company Website
              <input
                value={form.company_website}
                onChange={(event) => updateField("company_website", event.target.value)}
              />
            </label>
            <label>
              Message to Admin
              <textarea
                value={form.message}
                rows={4}
                onChange={(event) => updateField("message", event.target.value)}
                placeholder="Briefly explain your relationship to this employer or listing."
              />
            </label>
            <button type="submit" disabled={submitting || !job}>
              {submitting ? "Submitting..." : "Submit Claim Request"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
