import React from "react";
import { Star, CheckCircle, EyeOff, RotateCcw } from "lucide-react";
import {
  LISTING_OPPORTUNITY_TYPE_LABELS,
  LISTING_TIER_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  ROLE_LABELS,
  compensationSummary,
  normalizeRole,
  normalizeMultiValue,
} from "../../utils/jobTaxonomy";

function valuesFrom(job, arrayKey, singleKey, fallbackKey) {
  return normalizeMultiValue(job?.[arrayKey] || job?.[singleKey] || job?.[fallbackKey]);
}

function displayRole(role, fallbackTitle = "") {
  if (role === "other" && fallbackTitle) return String(fallbackTitle).trim();
  const label = ROLE_LABELS[role] || fallbackTitle || "Job";
  return String(label).trim();
}

function uniquePostingIdentity(job = {}, role = "") {
  const title = String(job.title || "").trim();
  const company = String(job.company || job.employer_name || "").trim();
  const roleTitle = displayRole(role);
  if (title && title.toLowerCase() !== roleTitle.toLowerCase()) return title;
  return company || title || roleTitle;
}

function roleEmploymentLine(job = {}, role = "") {
  const roleTitle = displayRole(role, job.title);
  const employmentValues = valuesFrom(job, "employment_types", "employment_type", "type");

  if (employmentValues.includes("per_diem_fill_in")) {
    const label = role === "optometrist" ? "Locum Tenens" : "Per Diem";
    return `${roleTitle} · ${label}`;
  }

  const employmentLabels = [];
  const isFullTime = employmentValues.includes("full_time");
  const isPartTime = employmentValues.includes("part_time");
  if (isFullTime && isPartTime) employmentLabels.push("Full-Time / Part-Time");
  else if (isFullTime) employmentLabels.push(EMPLOYMENT_TYPE_LABELS.full_time);
  else if (isPartTime) employmentLabels.push(EMPLOYMENT_TYPE_LABELS.part_time);

  return [roleTitle, ...employmentLabels].filter(Boolean).join(" · ");
}

function compactCompensation(job = {}) {
  const structured = compensationSummary(job);
  const raw = String(structured || job.salary || "").trim();
  if (!raw) return { primary: "", secondary: "" };

  const normalized = raw.replace(/\s+/g, " ").replace(/[–—]/g, "-");
  const moneyPattern = "\\$\\s?\\d{2,4}(?:,\\d{3})?(?:\\.\\d{2})?";
  const range = normalized.match(new RegExp(`(${moneyPattern})\\s*(?:-|to)\\s*(\\$?\\s?\\d{2,4}(?:,\\d{3})?(?:\\.\\d{2})?)`, "i"));
  const daily = normalized.match(/\$\s?\d{2,4}(?:,\d{3})?(?:\.\d{2})?\s*(?:\/\s?day|per day)/i);
  const singleAnnual = normalized.match(/\$\s?\d{2,4},\d{3}(?:\.\d{2})?/i);
  const singleHourly = normalized.match(/\$\s?\d{2,3}(?:\.\d{2})?\s*(?:\/\s?hr|per hour|hourly)/i);
  const hasHourly = /\/\s?hr|per hour|hourly/i.test(normalized);
  const cleanMoney = (value = "") => {
    const compact = value.replace(/\s+/g, "");
    return compact.startsWith("$") ? compact : `$${compact}`;
  };

  let primary = "";
  if (daily) {
    primary = daily[0].replace(/\s*per day/i, "/day").replace(/\s+/g, "");
  } else if (range) {
    primary = `${cleanMoney(range[1])} - ${cleanMoney(range[2])}`;
    if (hasHourly) primary += "/hr";
  } else if (singleHourly) {
    primary = singleHourly[0].replace(/\s*per hour/i, "/hr").replace(/\s+/g, "");
  } else if (singleAnnual) {
    primary = singleAnnual[0].replace(/\s+/g, "");
  } else {
    const isShortNote = normalized.length <= 36;
    const looksLikeBenefits = /paid ce|insurance|retirement|pto|relocation|benefits|assistance/i.test(normalized);
    primary = isShortNote && !looksLikeBenefits ? normalized : "";
  }

  if (primary && /\bproduction\b/i.test(normalized) && !/production/i.test(primary)) {
    primary += " + production";
  } else if (primary && /commission/i.test(normalized) && !/commission/i.test(primary)) {
    primary += " + commission";
  } else if (primary && /\bbonus\b/i.test(normalized) && !/bonus/i.test(primary)) {
    primary += " + bonus";
  }

  return { primary, secondary: "" };
}

function displayLocation(job = {}) {
  const base = String(job.location || [job.city, job.state].filter(Boolean).join(", ")).trim();
  if (!base) return "";
  const isMultiple = job.location_mode === "multiple" || job.location_precision === "multiple";
  return isMultiple ? `${base} + nearby locations` : base;
}

export default function JobCard({
  job,
  isFavorite,
  isApplied,
  onFavoriteClick,
  onApplyClick,
  onClick,
  savedTooltip,
  appliedTooltip,
  onHideClick,
  hideTooltip,
  isHidden = false,
  onRestoreClick,
  restoreTooltip,
  onClaimClick,
  claimTooltip,
  isClaiming = false,
  onAdminRemoveClick,
}) {
  const role = normalizeRole(job.role) || job.role;
  const cardTitle = uniquePostingIdentity(job, role);
  const cardRoleLine = roleEmploymentLine(job, role);
  const cardCompensation = compactCompensation(job);
  const cardLocation = displayLocation(job);
  const listingTier =
    job.listing_tier ||
    (job.featured ? "featured" : job.source === "discovery" ? "imported" : "");
  const listingOpportunityType = job.listing_opportunity_type || "job";
  const claimStatus = job.claim_status || "unclaimed";
  const isImportedListing = job.listing_source === "imported" || listingTier === "imported";
  const isClaimedListing = claimStatus === "claimed" || Boolean(job.claimed_by_user_id);
  const showClaimAction = Boolean(onClaimClick && isImportedListing && !isClaimedListing);
  const badges = [
    listingTier === "sponsor" && {
      key: "sponsor",
      className: "job-listing-badge sponsor",
      label: LISTING_TIER_LABELS.sponsor,
    },
    listingOpportunityType !== "job" && {
      key: listingOpportunityType,
      className: `job-listing-badge opportunity ${listingOpportunityType}`,
      label: LISTING_OPPORTUNITY_TYPE_LABELS[listingOpportunityType] || listingOpportunityType,
    },
    isClaimedListing && {
      key: "claimed",
      className: "job-listing-badge claimed",
      label: "Claimed",
    },
  ].filter(Boolean);
  const cardClasses = [
    "job-card",
    listingTier === "featured" ? "job-card-featured" : "",
    isHidden ? "job-card-hidden" : "",
  ].filter(Boolean).join(" ");

  return (
    <div
      className={cardClasses}
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
      <div className="jl-icon-col" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className={`jl-icon-btn jl-star ${isFavorite ? "active" : ""}`}
          title={savedTooltip || (isFavorite ? "Remove saved job" : "Save job")}
          aria-label={isFavorite ? "Remove saved job" : "Save job"}
          aria-pressed={Boolean(isFavorite)}
          onClick={() => onFavoriteClick(job._id)}
        >
          <Star size={18} />
        </button>
        <button
          type="button"
          className={`jl-icon-btn jl-check ${isApplied ? "active" : ""}`}
          title={appliedTooltip || (isApplied ? "Mark as not applied" : "Mark as applied")}
          aria-label={isApplied ? "Mark as not applied" : "Mark as applied"}
          aria-pressed={Boolean(isApplied)}
          onClick={() => onApplyClick?.(job._id)}
        >
          <CheckCircle size={18} />
        </button>
        {isHidden ? (
          <button
            type="button"
            className="jl-icon-btn jl-restore"
            title={restoreTooltip || "Restore job"}
            aria-label="Restore job"
            onClick={() => onRestoreClick?.(job._id)}
          >
            <RotateCcw size={18} />
          </button>
        ) : (
          <button
            type="button"
            className="jl-icon-btn jl-hide"
            title={hideTooltip || "Hide job"}
            aria-label="Hide job"
            onClick={() => onHideClick?.(job._id)}
          >
            <EyeOff size={18} />
          </button>
        )}
      </div>

      <div className="job-content">
        {badges.length > 0 && (
          <div className="job-listing-badges">
            {badges.map((badge) => (
              <span key={badge.key} className={badge.className} title={badge.title || badge.label}>
                {badge.label}
              </span>
            ))}
          </div>
        )}
        <h3 className="job-title">{cardTitle}</h3>
        {cardRoleLine && <p className="job-role-line">{cardRoleLine}</p>}
        {cardLocation && <p className="job-location">{cardLocation}</p>}
        {cardCompensation.primary && (
          <p className="job-compensation">
            <span>{cardCompensation.primary}</span>
            {cardCompensation.secondary && <small>{cardCompensation.secondary}</small>}
          </p>
        )}
        {(showClaimAction || onAdminRemoveClick) && (
          <div className="job-secondary-actions">
            {showClaimAction && (
              <button
                type="button"
                className="job-claim-action"
                title={claimTooltip || "Claim this listing"}
                disabled={isClaiming || claimStatus === "pending"}
                onClick={(event) => {
                  event.stopPropagation();
                  onClaimClick?.(job._id);
                }}
              >
                {claimStatus === "pending"
                  ? "Claim pending"
                  : isClaiming
                  ? "Submitting..."
                  : "Claim this listing"}
              </button>
            )}
            {onAdminRemoveClick && (
              <button
                type="button"
                className="job-admin-remove-action"
                title="Remove from public results"
                onClick={(event) => {
                  event.stopPropagation();
                  onAdminRemoveClick(job._id || job.id);
                }}
              >
                Remove
              </button>
            )}
          </div>
        )}
        {isHidden && (
          <button
            type="button"
            className="job-restore-action"
            onClick={(event) => {
              event.stopPropagation();
              onRestoreClick?.(job._id);
            }}
          >
            Restore
          </button>
        )}
      </div>
    </div>
  );
}
