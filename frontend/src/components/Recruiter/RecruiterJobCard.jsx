import React from "react";
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

  const role = normalizeRole(job.role) || job.role;
  const opportunityLabels =
    role === "optometrist"
      ? labelsForValues(OPPORTUNITY_TYPE_LABELS, job.opportunity_types || job.opportunity_type)
      : [];
  const details = [
    ["Role", ROLE_LABELS[role] || job.role],
    ["Opportunity", opportunityLabels.join(", ")],
    ["Practice", PRACTICE_TYPE_LABELS[job.practice_type] || ""],
    ["Employment", labelsForValues(EMPLOYMENT_TYPE_LABELS, job.employment_types || job.employment_type).join(", ")],
    ["Work Arrangement", labelsForValues(WORK_ARRANGEMENT_LABELS, job.work_arrangements || job.work_arrangement).join(", ")],
    ["Compensation", compensationSummary(job)],
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
