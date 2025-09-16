import React from "react";
import { Star, CheckCircle } from "lucide-react";

export default function JobCard({
  job,
  isFavorite,
  isApplied,
  onFavoriteClick,
  onClick,
  appliedTooltip,
}) {
  return (
    <div className="job-card" onClick={onClick} role="button" tabIndex={0}>
      <div className="jl-icon-col" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className={`jl-icon-btn jl-star ${isFavorite ? "active" : ""}`}
          title={isFavorite ? "Remove from favorites" : "Save to favorites"}
          aria-label="Toggle favorite"
          onClick={() => onFavoriteClick(job._id)}
        >
          <Star size={18} />
        </button>
        <div
          className="jl-icon-btn jl-check"
          title={appliedTooltip || (isApplied ? "Applied" : "Apply for this job")}
          aria-label="Applied status"
        >
          <CheckCircle size={18} />
        </div>
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
      </div>
    </div>
  );
}
