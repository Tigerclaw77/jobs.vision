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
  draft: "Unfinished",
  active: "Live",
  paused: "Hidden",
  pending_domain: "Pending",
  expired: "Expired",
  archived: "Removed",
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
      const confirmed = window.confirm(`Remove "${job.title}" from your active postings?`);
      if (confirmed) {
        await onArchive(job.id || job._id);
      }
    }
  };

  const handlePause = async () => {
    if (onPause) {
      const confirmed = window.confirm(`Hide "${job.title}" from public search and the map?`);
      if (confirmed) {
        await onPause(job.id || job._id);
      }
    }
  };

  const handleResume = async () => {
    if (onResume) {
      const confirmed = window.confirm(`Make "${job.title}" visible to candidates again?`);
      if (confirmed) {
        await onResume(job.id || job._id);
      }
    }
  };

  const handleUnarchive = async () => {
    if (onUnarchive) {
      const confirmed = window.confirm(`Restore "${job.title}" to your postings?`);
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
    ["Opportunity Type", opportunityLabels.join(", ")],
    ["Practice Type", PRACTICE_TYPE_LABELS[job.practice_type] || ""],
    ["Employment", labelsForValues(EMPLOYMENT_TYPE_LABELS, job.employment_types || job.employment_type).join(", ")],
    ["Work Setting", labelsForValues(WORK_ARRANGEMENT_LABELS, job.work_arrangements || job.work_arrangement).join(", ")],
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
    job.status === "draft" && ["Unfinished", "job-listing-badge draft"],
    job.status === "active" && ["Live", "job-listing-badge active"],
    job.status === "paused" && ["Hidden", "job-listing-badge paused"],
    job.status === "pending_domain" && ["Pending", "job-listing-badge review"],
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
    : "Add an apply method";
  const statusLabel = STATUS_LABELS[job.status] || (job.is_archived ? "Removed" : job.status || "Unknown");
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
        <span>{job.applies || 0} applicants</span>
        <span>Started: {createdDate}</span>
        <span>Went live: {publishedDate}</span>
        <span>{applyDestination}</span>
      </div>

      {/* ✅ Recruiter Actions */}
      <div className="job-actions">
        <button onClick={handleEdit}>Edit</button>
        {onPause && (
          <button onClick={handlePause}>Hide</button>
        )}
        {onResume && (
          <button onClick={handleResume}>Make Live</button>
        )}
        {onArchive && (
          <button onClick={handleArchive} className="danger">Remove</button>
        )}
        {onUnarchive && (
          <button onClick={handleUnarchive}>Restore</button>
        )}
      </div>
    </div>
  );
};

export default RecruiterJobCard;
