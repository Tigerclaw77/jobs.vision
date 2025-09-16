// src/components/JobSearch/JobModal.jsx
import React, { useEffect } from "react";
import { Star, CheckCircle } from "lucide-react";

export default function JobModal({
  isOpen,
  job,
  isFavorite,
  isApplied,
  appliedTooltip,
  onFavoriteClick,
  onApply,
  onClose,
  isAuthed,
}) {
  useEffect(() => {
    if (isOpen) document.body.classList.add("modal-open");
    else document.body.classList.remove("modal-open");
    return () => document.body.classList.remove("modal-open");
  }, [isOpen]);

  if (!isOpen || !job) return null;

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
            className={`status-chip favorite ${isFavorite ? "active" : ""}`}
            title={isFavorite ? "Remove from favorites" : "Save to favorites"}
            onClick={() => onFavoriteClick(job._id)}
          >
            <Star size={20} />
          </button>
          <div
            className={`status-chip applied ${isApplied ? "active" : ""}`}
            title={appliedTooltip || (isApplied ? "Applied" : "Apply for this job")}
          >
            <CheckCircle size={20} />
          </div>
        </div>

        <h3 className="modal-title">{job.title}</h3>
        {job.company && <p className="modal-company">{job.company}</p>}
        {job.location && <p className="modal-location">{job.location}</p>}
        <p className="modal-rolehours">
          {(job.role || "optometrist")}
          {job.hours ? ` • ${job.hours}` : ""}
        </p>

        {job.description && <p className="modal-desc">{job.description}</p>}

        <div className="modal-actions">
          {!isApplied && (
            <button
              className="btn-primary"
              onClick={() => onApply(job._id)}
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
