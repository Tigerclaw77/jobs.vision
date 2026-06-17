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
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  return `${month}-${day}-${year}`;
}

function formatOptionalDate(value) {
  if (!value) return "None";
  return formatDate(value);
}

function formatCount(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number.toLocaleString() : "0";
}

function formatRate(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number <= 0) return "0%";
  return `${number.toFixed(number % 1 === 0 ? 0 : 1)}%`;
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

function compactEmployment(job = {}) {
  const rawValues = job.employment_types || job.employment_type || job.type;
  const values = Array.isArray(rawValues) ? rawValues : [rawValues].filter(Boolean);
  if (!values.length) return "Not set";

  const compact = values
    .map((value) => {
      const normalized = String(value || "").trim().toLowerCase();
      const label = EMPLOYMENT_TYPE_LABELS[normalized] || String(value || "");
      const text = `${normalized} ${label}`.toLowerCase();
      if (text.includes("full")) return "FT";
      if (text.includes("part")) return "PT";
      if (text.includes("per diem") || text.includes("fill") || text.includes("prn")) return "PRN";
      return label || value;
    })
    .filter(Boolean);

  return compact.join(", ") || "Not set";
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
  const employment = compactEmployment(job);
  const workSetting = labels(job.work_arrangements || job.work_arrangement, WORK_ARRANGEMENT_LABELS);
  const opportunity =
    role === "optometrist"
      ? labels(job.opportunity_types || job.opportunity_type, OPPORTUNITY_TYPE_LABELS)
      : "";
  const postedAt = job.first_activated_at || job.firstActivatedAt || job.posted_at || job.created_at || job.createdAt;
  const startedAt = job.created_at || job.createdAt || job.posted_at;
  const analyticsViews = Number(job.analytics_views ?? job.view_count ?? job.views ?? 0);
  const applyClicks = Number(job.apply_clicks ?? job.applyClicks ?? job.applies ?? 0);
  const saves = Number(job.analytics_saves ?? job.saves_count ?? job.saves ?? 0);
  const applyRate = Number(job.apply_rate ?? job.applyRate ?? 0);
  const lastApplyClick = job.last_apply_click_at || job.lastApplyClickAt || null;
  const canViewPublicListing = job.status === "active" && !job.is_archived;
  const publicListingHref = id ? `/jobs?jobId=${encodeURIComponent(id)}` : "/jobs";
  const titleText = job.title || "Untitled job";
  const hasOverflowActions = onEdit || onPause || onResume || onArchive || onUnarchive;

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
            <h3>
              {canViewPublicListing ? (
                <Link to={publicListingHref} className="recruiter-job-title-link">
                  {titleText}
                </Link>
              ) : (
                <span className="recruiter-job-title-text">{titleText}</span>
              )}
            </h3>
            {badges.length > 0 && (
              <div className="job-listing-badges">
                {badges.map(([label, className]) => (
                  <span key={label} className={className}>
                    {label}
                  </span>
                ))}
              </div>
            )}
            {applyClicks > 0 && (
              <span className="recruiter-job-metric-badge">
                {formatCount(applyClicks)} apply click{applyClicks === 1 ? "" : "s"}
              </span>
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
        <div className="recruiter-job-cell recruiter-job-performance" data-label="Performance">
          <div className="recruiter-job-performance-stats">
            <span>Views {formatCount(analyticsViews)}</span>
            <span>Clicks {formatCount(applyClicks)}</span>
            <span>Rate {formatRate(applyRate)}</span>
            <span>Saves {formatCount(saves)}</span>
          </div>
          <small>Last click {formatOptionalDate(lastApplyClick)}</small>
        </div>

        <div className="recruiter-job-actions" aria-label={`Actions for ${job.title || "job"}`}>
          <button
            type="button"
            className="recruiter-details-toggle"
            aria-expanded={expanded}
            onClick={() => setExpanded((current) => !current)}
          >
            Details
          </button>
          {hasOverflowActions && (
            <details className="recruiter-overflow-menu">
              <summary aria-label={`More actions for ${titleText}`}>
                <span aria-hidden="true">⋮</span>
              </summary>
              <div className="recruiter-overflow-menu-list">
                {onEdit && (
                  <button type="button" onClick={() => onEdit(job)}>
                    Edit
                  </button>
                )}
                {onPause && (
                  <button
                    type="button"
                    onClick={() =>
                      confirmAndRun(`Hide "${titleText}" from public search and the map?`, onPause)
                    }
                  >
                    Hide
                  </button>
                )}
                {onResume && (
                  <button
                    type="button"
                    onClick={() =>
                      confirmAndRun(`Make "${titleText}" visible to candidates again?`, onResume)
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
                      confirmAndRun(`Remove "${titleText}" from your postings?`, onArchive)
                    }
                  >
                    Remove
                  </button>
                )}
                {onUnarchive && (
                  <button
                    type="button"
                    onClick={() => confirmAndRun(`Restore "${titleText}" to your postings?`, onUnarchive)}
                  >
                    Restore
                  </button>
                )}
              </div>
            </details>
          )}
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
            <DetailItem label="Views" value={formatCount(analyticsViews)} />
            <DetailItem label="Apply Clicks" value={formatCount(applyClicks)} />
            <DetailItem label="Apply Rate" value={formatRate(applyRate)} />
            <DetailItem label="Saves" value={formatCount(saves)} />
            <DetailItem label="Last Apply Click" value={formatOptionalDate(lastApplyClick)} />
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
