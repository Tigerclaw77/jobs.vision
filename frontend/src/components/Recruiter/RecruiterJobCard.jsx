import React from "react";

const LABELS = {
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
  return LABELS[field]?.[value] || String(value).replace(/_/g, " ");
}

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

  const details = [
    ["Opportunity", labelFor("opportunity_type", job.opportunity_type)],
    ["Practice", labelFor("practice_type", job.practice_type)],
    ["Employment", labelFor("employment_type", job.employment_type)],
  ].filter(([, value]) => value);

  return (
    <div className="job-card recruiter-card">
      <div className="job-header">
        <h3>{job.title}</h3>
        <p>{job.description}</p>
      </div>

      {/* ✅ Job Metrics */}
      {details.length > 0 && (
        <div className="job-details">
          {details.map(([label, value]) => (
            <span key={label}>
              <strong>{label}:</strong> {value}
            </span>
          ))}
        </div>
      )}

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
