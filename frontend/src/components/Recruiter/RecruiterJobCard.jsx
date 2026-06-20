import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight, Pause, Pencil, Play, RotateCcw, Trash2 } from "lucide-react";
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
import { jobPath } from "../../utils/jobSeo";

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

function textList(values) {
  const list = Array.isArray(values) ? values : String(values || "").split(",");
  return list.map((value) => String(value || "").trim()).filter(Boolean).join(", ");
}

function locationText(job = {}) {
  const city = String(job.city || "").trim();
  const state = String(job.state || job.state_code || "").trim().toUpperCase();
  const location = String(job.location || "").trim();
  const isMultiple = job.location_mode === "multiple" || job.location_precision === "multiple";
  const suffix = isMultiple ? " + nearby locations" : "";

  if (city && state) return `${city}, ${state}${suffix}`;
  if (location) {
    if (
      state &&
      !/remote/i.test(location) &&
      !new RegExp(`\\b${state.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(location)
    ) {
      return `${location}, ${state}${suffix}`;
    }
    return `${location}${suffix}`;
  }
  return city || state || "Not set";
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
  const isPaidDraft = job.status === "draft" && !job.is_archived && job.payment?.active === true;
  const statusLabel = isPaidDraft
    ? "Ready to publish"
    : STATUS_LABELS[job.status] || (job.is_archived ? "Removed" : job.status || "Unknown");
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
  const publicListingHref = id ? jobPath(job) : "/jobs";
  const titleText = job.title || "Untitled job";
  const isLive = job.status === "active" && !job.is_archived;
  const isPaused = job.status === "paused" && !job.is_archived;

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

  const handleRowClick = (event) => {
    if (event.target.closest?.("a, button, summary, details")) return;
    setExpanded((current) => !current);
  };

  const toggleExpanded = (event) => {
    event.stopPropagation();
    setExpanded((current) => !current);
  };

  const statusAction = (() => {
    if (isPaidDraft && onEdit) {
      return {
        label: "Publish",
        className: "primary",
        icon: Play,
        onClick: () => onEdit(job),
      };
    }
    if ((isLive || job.status === "pending_domain") && onPause) {
      return {
        label: "Pause",
        className: "secondary",
        icon: Pause,
        onClick: () => confirmAndRun(`Pause "${titleText}" and hide it from public search and the map?`, onPause),
      };
    }
    if (isPaused && onResume) {
      return {
        label: "Publish",
        className: "primary",
        icon: Play,
        onClick: () => confirmAndRun(`Publish "${titleText}" so candidates can find it again?`, onResume),
      };
    }
    return null;
  })();
  const StatusIcon = statusAction?.icon;
  const ExpandIcon = expanded ? ChevronDown : ChevronRight;

  return (
    <article className="recruiter-job-row" data-expanded={expanded ? "true" : "false"}>
      <div className="recruiter-job-row-main" onClick={handleRowClick}>
        <div className="recruiter-job-cell recruiter-job-title-cell">
          <div className="recruiter-job-title-line">
            <button
              type="button"
              className="recruiter-row-expand-toggle"
              aria-label={`${expanded ? "Collapse" : "Expand"} ${titleText}`}
              aria-expanded={expanded}
              onClick={toggleExpanded}
            >
              <ExpandIcon size={15} aria-hidden="true" />
            </button>
            <h3>
              {canViewPublicListing ? (
                <Link
                  to={publicListingHref}
                  className="recruiter-job-title-link"
                  onClick={(event) => event.stopPropagation()}
                >
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
          <span
            className={`recruiter-status-pill ${
              isPaidDraft ? "ready-to-publish" : String(job.status || "").replace(/_/g, "-")
            }`}
          >
            {statusLabel}
          </span>
        </div>
        <div className="recruiter-job-cell" data-label="Posted">
          {formatDate(postedAt)}
        </div>
        <div
          className="recruiter-job-actions"
          aria-label={`Actions for ${job.title || "job"}`}
          onClick={(event) => event.stopPropagation()}
        >
          {statusAction && (
            <button
              type="button"
              className={`recruiter-row-action ${statusAction.className}`}
              onClick={statusAction.onClick}
            >
              {StatusIcon && <StatusIcon size={14} aria-hidden="true" />}
              <span>{statusAction.label}</span>
            </button>
          )}
          {onEdit && !job.is_archived && (
            <button type="button" className="recruiter-row-action edit" onClick={() => onEdit(job)}>
              <Pencil size={14} aria-hidden="true" />
              <span>Edit</span>
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="recruiter-job-expanded">
          <dl>
            <DetailItem label="Opportunity Type" value={opportunity} />
            <DetailItem label="Practice Type" value={PRACTICE_TYPE_LABELS[job.practice_type]} />
            <DetailItem label="Additional Areas" value={textList(job.additional_locations)} />
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
          {(onArchive || onUnarchive) && (
            <div className="recruiter-job-expanded-actions">
              {onArchive && (
                <button
                  type="button"
                  className="danger"
                  onClick={() => confirmAndRun(`Remove "${titleText}" from your postings?`, onArchive)}
                >
                  <Trash2 size={14} aria-hidden="true" />
                  Remove
                </button>
              )}
              {onUnarchive && (
                <button
                  type="button"
                  onClick={() => confirmAndRun(`Restore "${titleText}" to your postings?`, onUnarchive)}
                >
                  <RotateCcw size={14} aria-hidden="true" />
                  Restore
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
};

export default React.memo(RecruiterJobCard);
