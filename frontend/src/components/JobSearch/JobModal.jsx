// src/components/JobSearch/JobModal.jsx
import React, { useEffect } from "react";
import { Star, CheckCircle } from "lucide-react";

const JOB_DETAIL_LABELS = {
  opportunity_type: {
    associate_position: "Associate Position",
    lease_opportunity: "Lease Opportunity",
    ownership_track: "Ownership Track",
    buy_in_opportunity: "Buy-In Opportunity",
  },
  practice_type: {
    private_practice: "Private Practice",
    corporate: "Corporate",
    od_md: "OD/MD",
  },
  employment_type: {
    full_time: "Full-Time",
    part_time: "Part-Time",
    remote: "Remote",
  },
};

function labelFor(field, value) {
  if (!value) return "";
  return JOB_DETAIL_LABELS[field]?.[value] || String(value).replace(/_/g, " ");
}

export default function JobModal({
  isOpen,
  job,
  isFavorite,
  isApplied,
  savedTooltip,
  appliedTooltip,
  onFavoriteClick,
  onApply,
  onHide,
  onClose,
  isAuthed,
}) {
  useEffect(() => {
    if (isOpen) document.body.classList.add("modal-open");
    else document.body.classList.remove("modal-open");
    return () => document.body.classList.remove("modal-open");
  }, [isOpen]);

  if (!isOpen || !job) return null;

  const jobDetails = [
    ["Opportunity Type", labelFor("opportunity_type", job.opportunity_type)],
    ["Practice Type", labelFor("practice_type", job.practice_type)],
    ["Employment Type", labelFor("employment_type", job.employment_type)],
  ].filter(([, value]) => value);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="job-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >

        <div className="status-icons">
          <button
            type="button"
            className={`status-chip favorite ${isFavorite ? "active" : ""}`}
            title={savedTooltip || (isFavorite ? "Remove saved job" : "Save job")}
            aria-label={isFavorite ? "Remove saved job" : "Save job"}
            aria-pressed={Boolean(isFavorite)}
            onClick={() => onFavoriteClick(job._id)}
          >
            <Star size={20} />
          </button>
          <button
            type="button"
            className={`status-chip applied ${isApplied ? "active" : ""}`}
            title={appliedTooltip || (isApplied ? "Already applied" : "Apply to this job")}
            aria-label={isApplied ? "Already applied" : "Apply to this job"}
            aria-pressed={Boolean(isApplied)}
            onClick={() => {
              if (!isApplied) onApply(job._id);
            }}
          >
            <CheckCircle size={20} />
          </button>
        </div>

        <h3 className="modal-title">{job.title}</h3>
        {job.company && <p className="modal-company">{job.company}</p>}
        {job.location && <p className="modal-location">{job.location}</p>}
        <p className="modal-rolehours">
          {(job.role || "optometrist")}
          {job.hours ? ` • ${job.hours}` : ""}
        </p>

        {jobDetails.length > 0 && (
          <div className="modal-job-details">
            {jobDetails.map(([label, value]) => (
              <p key={label}>
                <strong>{label}:</strong> {value}
              </p>
            ))}
          </div>
        )}

        {job.description && <p className="modal-desc">{job.description}</p>}

        <div className="modal-actions">
          {!isApplied && (
            <button
              className="btn-primary"
              onClick={() => onApply(job._id)}
              title="Apply to this job"
            >
              {isAuthed ? "Apply Now" : "Sign in to Apply"}
            </button>
          )}
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
          <button
            type="button"
            className="btn-secondary btn-hide-job"
            onClick={() => onHide?.(job._id)}
          >
            Hide Job
          </button>
        </div>
      </div>
    </div>
  );
}
