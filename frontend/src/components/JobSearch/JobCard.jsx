import React from "react";
import { Star, CheckCircle, EyeOff, RotateCcw } from "lucide-react";

const CARD_LABELS = {
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
  opportunity_type: {
    associate_w2: "Associate (W-2)",
    associate_1099: "Associate (1099)",
    corporate_employment: "Corporate Employment",
    corporate_lease: "Corporate Lease",
    partnership_opportunity: "Partnership Opportunity",
    practice_acquisition: "Practice Acquisition",
  },
};

function labelFor(field, value) {
  if (!value) return "";
  return CARD_LABELS[field]?.[value] || String(value).replace(/_/g, " ");
}

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
  const meta = [
    job.role,
    labelFor("employment_type", job.employment_type || job.type),
    labelFor("work_arrangement", job.work_arrangement),
    labelFor("opportunity_type", job.opportunity_type),
    job.hours ? `${job.hours} hrs/wk` : "",
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
