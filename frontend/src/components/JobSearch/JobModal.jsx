// src/components/JobSearch/JobModal.jsx
import React, { useEffect } from "react";
import { Star, CheckCircle, EyeOff, RotateCcw } from "lucide-react";
import {
  EMPLOYMENT_TYPE_LABELS,
  OPPORTUNITY_TYPE_LABELS,
  PRACTICE_TYPE_LABELS,
  ROLE_LABELS,
  WORK_ARRANGEMENT_LABELS,
  compensationSummary,
  labelsForValues,
  normalizeRole,
} from "../../utils/jobTaxonomy";

export default function JobModal({
  isOpen,
  job,
  isFavorite,
  isApplied,
  savedTooltip,
  appliedTooltip,
  hideTooltip,
  restoreTooltip,
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

  const role = normalizeRole(job.role) || job.role;
  const opportunityLabels =
    role === "optometrist"
      ? labelsForValues(OPPORTUNITY_TYPE_LABELS, job.opportunity_types || job.opportunity_type)
      : [];
  const jobDetails = [
    ["Opportunity Type", opportunityLabels.join(", ")],
    ["Practice Type", PRACTICE_TYPE_LABELS[job.practice_type] || ""],
    ["Employment Type", labelsForValues(EMPLOYMENT_TYPE_LABELS, job.employment_types || job.employment_type).join(", ")],
    ["Work Arrangement", labelsForValues(WORK_ARRANGEMENT_LABELS, job.work_arrangements || job.work_arrangement).join(", ")],
    ["Compensation", compensationSummary(job)],
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
          {isHidden && onRestore ? (
            <button
              type="button"
              className="status-chip hidden-action restore"
              title={restoreTooltip || "Restore job"}
              aria-label="Restore job"
              onClick={() => onRestore(job._id)}
            >
              <RotateCcw size={20} />
            </button>
          ) : onHide ? (
            <button
              type="button"
              className="status-chip hidden-action hide"
              title={hideTooltip || "Hide job"}
              aria-label="Hide job"
              onClick={() => onHide(job._id)}
            >
              <EyeOff size={20} />
            </button>
          ) : null}
        </div>

        <h3 className="modal-title">{job.title}</h3>
        {job.company && <p className="modal-company">{job.company}</p>}
        {job.location && <p className="modal-location">{job.location}</p>}
        <p className="modal-rolehours">
          {ROLE_LABELS[role] || job.role || "Optometrist"}
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
        </div>
      </div>
    </div>
  );
}
