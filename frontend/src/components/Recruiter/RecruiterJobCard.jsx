import React from "react";

const RecruiterJobCard = ({ job, onEdit, onArchive, onUnarchive }) => {
  const handleEdit = () => {
    if (onEdit) onEdit(job);
  };

  const handleArchive = async () => {
    if (onArchive) {
      const confirmed = window.confirm(`Archive job "${job.title}"?`);
      if (confirmed) {
        await onArchive(job.id || job._id);
      }
    }
  };

  const handleUnarchive = async () => {
    if (onUnarchive) {
      const confirmed = window.confirm(`Unarchive job "${job.title}"?`);
      if (confirmed) {
        await onUnarchive(job.id || job._id);
      }
    }
  };

  return (
    <div className="job-card recruiter-card">
      <div className="job-header">
        <h3>{job.title}</h3>
        <p>{job.description}</p>
      </div>

      {/* ✅ Job Metrics */}
      <div className="job-metrics">
        <span>👁️ {job.views || 0} views</span>
        <span>💾 {job.saves || 0} saves</span>
        <span>📥 {job.applies || 0} applies</span>
      </div>

      {/* ✅ Recruiter Actions */}
      <div className="job-actions">
        <button onClick={handleEdit}>Edit</button>
        {onArchive && (
          <button onClick={handleArchive} className="danger">Archive</button>
        )}
        {onUnarchive && (
          <button onClick={handleUnarchive}>Unarchive</button>
        )}
      </div>
    </div>
  );
};

export default RecruiterJobCard;
