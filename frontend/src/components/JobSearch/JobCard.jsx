import React from "react";
import { Star, CheckCircle, EyeOff, RotateCcw } from "lucide-react";

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
        {(job.role || job.hours) && (
          <p className="job-meta">
            {job.role || ""}{job.role && job.hours ? " • " : ""}{job.hours || ""}
          </p>
        )}
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
