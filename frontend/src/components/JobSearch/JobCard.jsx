import React from "react";
import { Star, CheckCircle, EyeOff, RotateCcw } from "lucide-react";
import {
  EMPLOYMENT_TYPE_LABELS,
  OPPORTUNITY_TYPE_LABELS,
  ROLE_LABELS,
  WORK_ARRANGEMENT_LABELS,
  compensationSummary,
  labelsForValues,
  normalizeRole,
} from "../../utils/jobTaxonomy";

export default function JobCard({
  job,
  isFavorite,
  isApplied,
  onFavoriteClick,
  onApplyClick,
  onClick,
  savedTooltip,
  appliedTooltip,
  onHideClick,
  hideTooltip,
  isHidden = false,
  onRestoreClick,
  restoreTooltip,
}) {
  const role = normalizeRole(job.role) || job.role;
  const opportunityLabels =
    role === "optometrist"
      ? labelsForValues(OPPORTUNITY_TYPE_LABELS, job.opportunity_types || job.opportunity_type)
      : [];
  const meta = [
    ROLE_LABELS[role] || job.role,
    ...labelsForValues(EMPLOYMENT_TYPE_LABELS, job.employment_types || job.employment_type || job.type),
    ...labelsForValues(WORK_ARRANGEMENT_LABELS, job.work_arrangements || job.work_arrangement),
    ...opportunityLabels,
    job.hours ? `${job.hours} hrs/wk` : "",
    compensationSummary(job),
  ].filter(Boolean);

  return (
    <div
      className={`job-card ${isHidden ? "job-card-hidden" : ""}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
      <div className="jl-icon-col" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className={`jl-icon-btn jl-star ${isFavorite ? "active" : ""}`}
          title={savedTooltip || (isFavorite ? "Remove saved job" : "Save job")}
          aria-label={isFavorite ? "Remove saved job" : "Save job"}
          aria-pressed={Boolean(isFavorite)}
          onClick={() => onFavoriteClick(job._id)}
        >
          <Star size={18} />
        </button>
        <button
          type="button"
          className={`jl-icon-btn jl-check ${isApplied ? "active" : ""}`}
          title={appliedTooltip || (isApplied ? "Already applied" : "Apply to this job")}
          aria-label={isApplied ? "Already applied" : "Apply to this job"}
          aria-pressed={Boolean(isApplied)}
          onClick={() => {
            if (!isApplied) onApplyClick?.(job._id);
          }}
        >
          <CheckCircle size={18} />
        </button>
        {isHidden ? (
          <button
            type="button"
            className="jl-icon-btn jl-restore"
            title={restoreTooltip || "Restore job"}
            aria-label="Restore job"
            onClick={() => onRestoreClick?.(job._id)}
          >
            <RotateCcw size={18} />
          </button>
        ) : (
          <button
            type="button"
            className="jl-icon-btn jl-hide"
            title={hideTooltip || "Hide job"}
            aria-label="Hide job"
            onClick={() => onHideClick?.(job._id)}
          >
            <EyeOff size={18} />
          </button>
        )}
      </div>

      <div className="job-content">
        <h3 className="job-title">{job.title}</h3>
        {job.company && <p className="job-company">{job.company}</p>}
        {job.location && <p className="job-location">{job.location}</p>}
        {meta.length > 0 && <p className="job-meta">{meta.join(" | ")}</p>}
        {isHidden && (
          <button
            type="button"
            className="job-restore-action"
            onClick={(event) => {
              event.stopPropagation();
              onRestoreClick?.(job._id);
            }}
          >
            Restore
          </button>
        )}
      </div>
    </div>
  );
}
