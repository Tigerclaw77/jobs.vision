// src/components/JobSearch/JobModal.jsx
import React, { useEffect } from "react";
import { Star, CheckCircle } from "lucide-react";

const JOB_DETAIL_LABELS = {
  opportunity_type: {
    associate_w2: "Associate (W-2)",
    associate_1099: "Associate (1099)",
    corporate_employment: "Corporate Employment",
    corporate_lease: "Corporate Lease",
    partnership_opportunity: "Partnership Opportunity",
    practice_acquisition: "Practice Acquisition",
  },
  practice_type: {
    private_practice: "Private Practice",
    corporate: "Corporate",
    od_md: "OD/MD",
  },
  employment_type: {
    full_time: "Full-Time",
    part_time: "Part-Time",
    per_diem_fill_in: "Per Diem / Fill-In",
  },
  work_arrangement: {
    on_site: "On-Site",
    hybrid: "Hybrid",
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
  onRestore,
  isHidden = false,
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
    ["Work Arrangement", labelFor("work_arrangement", job.work_arrangement)],
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
          {isHidden && onRestore ? (
            <button
              type="button"
              className="btn-secondary btn-restore-job"
              onClick={() => onRestore(job._id)}
            >
              Restore Job
            </button>
          ) : onHide ? (
            <button
              type="button"
              className="btn-secondary btn-hide-job"
              onClick={() => onHide(job._id)}
            >
              Hide Job
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
