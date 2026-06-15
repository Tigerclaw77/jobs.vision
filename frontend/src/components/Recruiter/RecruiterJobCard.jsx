import React from "react";
import {
  EMPLOYMENT_TYPE_LABELS,
  LISTING_OPPORTUNITY_TYPE_LABELS,
  LISTING_TIER_LABELS,
  OPPORTUNITY_TYPE_LABELS,
  PRACTICE_TYPE_LABELS,
  ROLE_LABELS,
  SATURDAY_SCHEDULE_LABELS,
  WORK_ARRANGEMENT_LABELS,
  compensationSummary,
  labelsForValues,
  normalizeRole,
} from "../../utils/jobTaxonomy";

const STATUS_LABELS = {
  draft: "Draft",
  active: "Active",
  paused: "Paused",
  pending_domain: "Pending Verification",
  expired: "Expired",
  archived: "Archived",
};

function formatDate(value) {
  if (!value) return "Not yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not yet";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const RecruiterJobCard = ({ job, onEdit, onPause, onResume, onArchive, onUnarchive }) => {
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

  const handlePause = async () => {
    if (onPause) {
      const confirmed = window.confirm(`Pause job "${job.title}"? It will be removed from public search and map.`);
      if (confirmed) {
        await onPause(job.id || job._id);
      }
    }
  };

  const handleResume = async () => {
    if (onResume) {
      const confirmed = window.confirm(`Resume job "${job.title}"? It will become public again if eligible.`);
      if (confirmed) {
        await onResume(job.id || job._id);
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
    ["Saturday Schedule", SATURDAY_SCHEDULE_LABELS[job.saturday_schedule] || ""],
    ["Compensation", compensationSummary(job)],
    ["Sign-on Bonus", job.sign_on_bonus || ""],
    ["CE Allowance", job.ce_allowance || ""],
    ["Benefits", job.benefits || ""],
    ["Relocation", job.relocation_assistance ? "Available" : ""],
    ["Student Loan", job.student_loan_assistance ? "Available" : ""],
  ].filter(([, value]) => value);
  const listingTier =
    job.listing_tier ||
    (job.featured ? "featured" : job.source === "discovery" ? "imported" : "");
  const listingOpportunityType = job.listing_opportunity_type || "job";
  const badges = [
    job.status === "draft" && ["Draft", "job-listing-badge draft"],
    job.status === "active" && ["Active", "job-listing-badge active"],
    job.status === "paused" && ["Paused", "job-listing-badge paused"],
    job.status === "pending_domain" && ["Pending Verification", "job-listing-badge review"],
    listingTier === "imported" && ["Imported", "job-listing-badge imported"],
    listingTier === "featured" && [LISTING_TIER_LABELS.featured, "job-listing-badge featured"],
    listingTier === "sponsor" && [LISTING_TIER_LABELS.sponsor, "job-listing-badge sponsor"],
    listingOpportunityType !== "job" && [
      LISTING_OPPORTUNITY_TYPE_LABELS[listingOpportunityType] || listingOpportunityType,
      `job-listing-badge opportunity ${listingOpportunityType}`,
    ],
  ].filter(Boolean);
  const applyDestination = job.external_apply_url
    ? "Apply URL set"
    : job.application_email
    ? "Apply email set"
    : "Apply destination missing";
  const statusLabel = STATUS_LABELS[job.status] || (job.is_archived ? "Archived" : job.status || "Unknown");
  const createdDate = formatDate(job.created_at || job.createdAt || job.posted_at);
  const publishedDate = formatDate(job.first_activated_at || job.firstActivatedAt);

  return (
    <div className="job-card recruiter-card">
      <div className="job-header">
        {badges.length > 0 && (
          <div className="job-listing-badges">
            {badges.map(([label, className]) => (
              <span key={label} className={className}>
                {label}
              </span>
            ))}
          </div>
        )}
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
        <span>Status: {statusLabel}</span>
        <span>{job.views || 0} views</span>
        <span>{job.saves || 0} saves</span>
        <span>{job.applies || 0} internal applies</span>
        <span>Created: {createdDate}</span>
        <span>Published: {publishedDate}</span>
        <span>{applyDestination}</span>
      </div>

      {/* ✅ Recruiter Actions */}
      <div className="job-actions">
        <button onClick={handleEdit}>Edit</button>
        {onPause && (
          <button onClick={handlePause}>Pause</button>
        )}
        {onResume && (
          <button onClick={handleResume}>Resume</button>
        )}
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
