import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  COMPENSATION_TYPE_LABELS,
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

function labels(values, map) {
  return labelsForValues(map, values).join(", ");
}

function locationText(job = {}) {
  if (job.location) return job.location;
  const cityState = [job.city, job.state].filter(Boolean).join(", ");
  return cityState || "Not set";
}

function applyMethod(job = {}) {
  if (job.external_apply_url) return "Apply URL";
  if (job.application_email) return "Apply email";
  return "Add apply method";
}

function DetailItem({ label, value }) {
  if (!value) return null;
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

const RecruiterJobCard = ({ job, onEdit, onPause, onResume, onArchive, onUnarchive }) => {
  const [expanded, setExpanded] = useState(false);
  const id = job.id || job._id;
  const role = normalizeRole(job.role) || job.role;
  const roleLabel = ROLE_LABELS[role] || job.role || "Job";
  const statusLabel = STATUS_LABELS[job.status] || (job.is_archived ? "Removed" : job.status || "Unknown");
  const employment = labels(job.employment_types || job.employment_type, EMPLOYMENT_TYPE_LABELS) || "Not set";
  const workSetting = labels(job.work_arrangements || job.work_arrangement, WORK_ARRANGEMENT_LABELS);
  const opportunity =
    role === "optometrist"
      ? labels(job.opportunity_types || job.opportunity_type, OPPORTUNITY_TYPE_LABELS)
      : "";
  const postedAt = job.first_activated_at || job.firstActivatedAt || job.posted_at || job.created_at || job.createdAt;
  const startedAt = job.created_at || job.createdAt || job.posted_at;
  const applicants = job.applies || job.applicants_count || job.application_count || 0;
  const canViewPublicListing = job.status === "active" && !job.is_archived;
  const publicSearchHref = `/jobs?q=${encodeURIComponent(job.title || "")}`;

  const badges = useMemo(() => {
    const listingTier =
      job.listing_tier ||
      (job.featured ? "featured" : job.source === "discovery" ? "imported" : "");
    const listingOpportunityType = job.listing_opportunity_type || "job";
    return [
      listingTier === "imported" && ["Imported", "job-listing-badge imported"],
      listingTier === "featured" && [LISTING_TIER_LABELS.featured, "job-listing-badge featured"],
      listingTier === "sponsor" && [LISTING_TIER_LABELS.sponsor, "job-listing-badge sponsor"],
      listingOpportunityType !== "job" && [
        LISTING_OPPORTUNITY_TYPE_LABELS[listingOpportunityType] || listingOpportunityType,
        `job-listing-badge opportunity ${listingOpportunityType}`,
      ],
    ].filter(Boolean);
  }, [job.featured, job.listing_opportunity_type, job.listing_tier, job.source]);

  const confirmAndRun = async (message, action, payload = id) => {
    if (!action) return;
    const confirmed = window.confirm(message);
    if (confirmed) await action(payload);
  };

  return (
    <article className="recruiter-job-row">
      <div className="recruiter-job-row-main">
        <div className="recruiter-job-cell recruiter-job-title-cell">
          <div className="recruiter-job-title-line">
            <h3>{job.title || "Untitled job"}</h3>
            {badges.length > 0 && (
              <div className="job-listing-badges">
                {badges.map(([label, className]) => (
                  <span key={label} className={className}>
                    {label}
                  </span>
                ))}
              </div>
            )}
          </div>
          <small>{job.company || job.employer_name || job.practice_name || ""}</small>
        </div>

        <div className="recruiter-job-cell" data-label="Role">
          {roleLabel}
        </div>
        <div className="recruiter-job-cell" data-label="Location">
          {locationText(job)}
        </div>
        <div className="recruiter-job-cell" data-label="Type">
          {employment}
        </div>
        <div className="recruiter-job-cell" data-label="Status">
          <span className={`recruiter-status-pill ${String(job.status || "").replace(/_/g, "-")}`}>
            {statusLabel}
          </span>
        </div>
        <div className="recruiter-job-cell" data-label="Posted">
          {formatDate(postedAt)}
        </div>
        <div className="recruiter-job-cell" data-label="Applicants">
          {applicants}
        </div>

        <div className="recruiter-job-actions" aria-label={`Actions for ${job.title || "job"}`}>
          {canViewPublicListing && (
            <Link to={publicSearchHref} className="recruiter-row-action-link">
              View
            </Link>
          )}
          <button type="button" onClick={() => onEdit?.(job)}>
            Edit
          </button>
          {onPause && (
            <button
              type="button"
              onClick={() =>
                confirmAndRun(`Hide "${job.title}" from public search and the map?`, onPause)
              }
            >
              Hide
            </button>
          )}
          {onResume && (
            <button
              type="button"
              onClick={() =>
                confirmAndRun(`Make "${job.title}" visible to candidates again?`, onResume)
              }
            >
              Make Live
            </button>
          )}
          {onArchive && (
            <button
              type="button"
              className="danger"
              onClick={() =>
                confirmAndRun(`Remove "${job.title}" from your postings?`, onArchive)
              }
            >
              Remove
            </button>
          )}
          {onUnarchive && (
            <button
              type="button"
              onClick={() => confirmAndRun(`Restore "${job.title}" to your postings?`, onUnarchive)}
            >
              Restore
            </button>
          )}
          <button
            type="button"
            className="recruiter-details-toggle"
            aria-expanded={expanded}
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? "Hide Details" : "Details"}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="recruiter-job-expanded">
          <dl>
            <DetailItem label="Opportunity Type" value={opportunity} />
            <DetailItem label="Practice Type" value={PRACTICE_TYPE_LABELS[job.practice_type]} />
            <DetailItem label="Saturday Schedule" value={SATURDAY_SCHEDULE_LABELS[job.saturday_schedule]} />
            <DetailItem label="Work Setting" value={workSetting} />
            <DetailItem label="Compensation Type" value={COMPENSATION_TYPE_LABELS[job.compensation_type]} />
            <DetailItem label="Compensation" value={compensationSummary(job)} />
            <DetailItem label="Apply Method" value={applyMethod(job)} />
            <DetailItem label="Started" value={formatDate(startedAt)} />
            <DetailItem label="Went Live" value={formatDate(job.first_activated_at || job.firstActivatedAt)} />
            <DetailItem label="Views" value={job.views || 0} />
            <DetailItem label="Saves" value={job.saves || 0} />
            <DetailItem label="Sign-on Bonus" value={job.sign_on_bonus} />
            <DetailItem label="CE Allowance" value={job.ce_allowance} />
            <DetailItem label="Benefits" value={job.benefits} />
            <DetailItem label="Relocation" value={job.relocation_assistance ? "Available" : ""} />
            <DetailItem label="Student Loan" value={job.student_loan_assistance ? "Available" : ""} />
          </dl>
        </div>
      )}
    </article>
  );
};

export default React.memo(RecruiterJobCard);
