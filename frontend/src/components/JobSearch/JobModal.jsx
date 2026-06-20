// src/components/JobSearch/JobModal.jsx
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Star, CheckCircle, EyeOff, RotateCcw } from "lucide-react";
import { reportListingIssue } from "../../utils/api";
import {
  BENEFIT_FLAG_LABELS,
  CLINICAL_FOCUS_LABELS,
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

function externalApplyUrlFor(job = {}) {
  return job.external_apply_url || job.apply_url || job.applyUrl || "";
}

function applyEmailFor(job = {}) {
  return job.application_email || job.applicationEmail || "";
}

function displayLocation(job = {}) {
  const base = String(job.location || [job.city, job.state].filter(Boolean).join(", ")).trim();
  if (!base) return "";
  const isMultiple = job.location_mode === "multiple" || job.location_precision === "multiple";
  return isMultiple ? `${base} + nearby locations` : base;
}

function textList(values) {
  const list = Array.isArray(values) ? values : String(values || "").split(",");
  return list.map((value) => String(value || "").trim()).filter(Boolean).join(", ");
}

const REPORT_REASONS = [
  ["expired", "Expired"],
  ["broken_apply_link", "Broken Apply Link"],
  ["incorrect_location", "Incorrect Location"],
  ["incorrect_employer", "Incorrect Employer"],
  ["duplicate_listing", "Duplicate Listing"],
  ["other", "Other"],
];

export default function JobModal({
  isOpen,
  job,
  isFavorite,
  isApplied,
  savedTooltip,
  appliedTooltip,
  hideTooltip,
  restoreTooltip,
  onFavoriteClick,
  onApply,
  onHide,
  onRestore,
  onClaim,
  claimTooltip,
  isClaiming = false,
  isHidden = false,
  onClose,
  isAuthed,
  onListingView,
  onOutboundApply,
  detailHref,
}) {
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportReason, setReportReason] = useState("expired");
  const [reportComment, setReportComment] = useState("");
  const [reportMessage, setReportMessage] = useState("");
  const [isReporting, setIsReporting] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);

  useEffect(() => {
    if (isOpen) document.body.classList.add("modal-open");
    else document.body.classList.remove("modal-open");
    return () => document.body.classList.remove("modal-open");
  }, [isOpen]);

  useEffect(() => {
    const jobId = job?._id || job?.id;
    if (isOpen && jobId) onListingView?.(jobId);
  }, [isOpen, job?._id, job?.id, onListingView]);

  useEffect(() => {
    if (!isOpen) return;
    setShowReportForm(false);
    setReportReason("expired");
    setReportComment("");
    setReportMessage("");
    setIsReporting(false);
    setShowEmailDialog(false);
    setEmailCopied(false);
  }, [isOpen, job?._id, job?.id]);

  if (!isOpen || !job) return null;

  const role = normalizeRole(job.role) || job.role;
  const modalLocation = displayLocation(job);
  const opportunityLabels =
    role === "optometrist"
      ? labelsForValues(OPPORTUNITY_TYPE_LABELS, job.opportunity_types || job.opportunity_type)
      : [];
  const compensationLine = compensationSummary(job);
  const employmentLine = labelsForValues(
    EMPLOYMENT_TYPE_LABELS,
    job.employment_types || job.employment_type || job.type
  ).join(", ");
  const clinicalFocusLabels = labelsForValues(CLINICAL_FOCUS_LABELS, job.clinical_focuses);
  const practiceTypeLabels = labelsForValues(PRACTICE_TYPE_LABELS, job.practice_types);
  const benefitFlagLabels = labelsForValues(BENEFIT_FLAG_LABELS, job.benefit_flags);
  const structuredSections = [
    ["Clinical Focus", clinicalFocusLabels],
    ["Practice Type", practiceTypeLabels],
    ["Benefits & Incentives", benefitFlagLabels],
  ].filter(([, values]) => values.length > 0);
  const jobDetails = [
    ["Role", ROLE_LABELS[role] || job.role || ""],
    ["Opportunity Type", opportunityLabels.join(", ")],
    ["Practice Type", practiceTypeLabels.length ? "" : PRACTICE_TYPE_LABELS[job.practice_type] || ""],
    ["Additional Areas", textList(job.additional_locations)],
    ["Work Arrangement", labelsForValues(WORK_ARRANGEMENT_LABELS, job.work_arrangements || job.work_arrangement).join(", ")],
    ["Saturday Schedule", SATURDAY_SCHEDULE_LABELS[job.saturday_schedule] || ""],
    ["Sign-on Bonus", job.sign_on_bonus || ""],
    ["Relocation Assistance", job.relocation_assistance ? "Available" : ""],
    ["CE Allowance", job.ce_allowance || ""],
    ["Student Loan Assistance", job.student_loan_assistance ? "Available" : ""],
    ["Benefits", job.benefits || ""],
  ].filter(([, value]) => value);
  const listingTier =
    job.listing_tier ||
    (job.featured ? "featured" : job.source === "discovery" ? "imported" : "");
  const externalApplyUrl = externalApplyUrlFor(job);
  const applyEmail = applyEmailFor(job);
  const emailApplyUrl = applyEmail
    ? `mailto:${applyEmail}?subject=${encodeURIComponent(`Application for ${job.title || "job"}`)}`
    : "";
  const listingOpportunityType = job.listing_opportunity_type || "job";
  const claimStatus = job.claim_status || "unclaimed";
  const isImportedListing = job.listing_source === "imported" || listingTier === "imported";
  const outboundDestinationType = externalApplyUrl
    ? job.listing_source === "employer_submitted"
      ? "recruiter_website"
      : "external_url"
    : emailApplyUrl
    ? "recruiter_email"
    : null;
  const isClaimedListing = claimStatus === "claimed" || Boolean(job.claimed_by_user_id);
  const showClaimAction = Boolean(onClaim && isImportedListing && !isClaimedListing);
  const publicDetailHref = detailHref || jobPath(job);
  const badges = [
    listingTier === "featured" && {
      key: "featured",
      className: "job-listing-badge featured",
      label: LISTING_TIER_LABELS.featured,
    },
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
    onClaim && isClaimedListing && {
      key: "claimed",
      className: "job-listing-badge claimed",
      label: "Claimed",
    },
  ].filter(Boolean);

  async function handleReportSubmit(event) {
    event.preventDefault();
    const reportJobId = job?._id || job?.id;
    if (!reportJobId) return;
    setIsReporting(true);
    setReportMessage("");
    try {
      await reportListingIssue(reportJobId, {
        reason: reportReason,
        comment: reportComment,
      });
      setReportMessage("Report submitted. Thank you.");
      setReportComment("");
      setShowReportForm(false);
    } catch (error) {
      setReportMessage(error?.response?.data?.error || "Failed to submit report.");
    } finally {
      setIsReporting(false);
    }
  }

  function handleOutboundApply() {
    const jobId = job?._id || job?.id;
    if (!jobId || !outboundDestinationType) return;
    onOutboundApply?.(jobId, {
      destinationType: outboundDestinationType,
      destination: externalApplyUrl || applyEmail,
    });
  }

  function handleEmailApplyClick() {
    handleOutboundApply();
    setEmailCopied(false);
    setShowEmailDialog(true);
  }

  async function handleCopyEmailAddress() {
    if (!applyEmail) return;
    try {
      await navigator.clipboard.writeText(applyEmail);
      setEmailCopied(true);
      return;
    } catch (error) {
      const textarea = document.createElement("textarea");
      textarea.value = applyEmail;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setEmailCopied(true);
    }
  }

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
            type="button"
            className={`status-chip favorite ${isFavorite ? "active" : ""}`}
            title={savedTooltip || (isFavorite ? "Remove saved job" : "Save job")}
            aria-label={isFavorite ? "Remove saved job" : "Save job"}
            aria-pressed={Boolean(isFavorite)}
            onClick={() => onFavoriteClick(job._id)}
          >
            <Star size={20} />
          </button>
          <button
            type="button"
            className={`status-chip applied ${isApplied ? "active" : ""}`}
            title={appliedTooltip || (isApplied ? "Mark as not applied" : "Mark as applied")}
            aria-label={isApplied ? "Mark as not applied" : "Mark as applied"}
            aria-pressed={Boolean(isApplied)}
            onClick={() => onApply(job._id)}
          >
            <CheckCircle size={20} />
          </button>
          {isHidden && onRestore ? (
            <button
              type="button"
              className="status-chip hidden-action restore"
              title={restoreTooltip || "Restore job"}
              aria-label="Restore job"
              onClick={() => onRestore(job._id)}
            >
              <RotateCcw size={20} />
            </button>
          ) : onHide ? (
            <button
              type="button"
              className="status-chip hidden-action hide"
              title={hideTooltip || "Hide job"}
              aria-label="Hide job"
              onClick={() => onHide(job._id)}
            >
              <EyeOff size={20} />
            </button>
          ) : null}
        </div>

        <h3 className="modal-title">{job.title}</h3>
        {badges.length > 0 && (
          <div className="job-listing-badges modal-listing-badges">
            {badges.map((badge) => (
              <span key={badge.key} className={badge.className} title={badge.title || badge.label}>
                {badge.label}
              </span>
            ))}
          </div>
        )}
        {job.company && <p className="modal-company">{job.company}</p>}
        {modalLocation && <p className="modal-location">{modalLocation}</p>}
        {employmentLine && <p className="modal-employment">{employmentLine}</p>}
        {compensationLine && <p className="modal-compensation">{compensationLine}</p>}

        {job.description && (
          <section className="modal-description-block" aria-label="Job description">
            <h4>Description</h4>
            <div className="modal-description-scroll" tabIndex={0}>
              <p className="modal-desc">{job.description}</p>
            </div>
          </section>
        )}

        {jobDetails.length > 0 && (
          <div className="modal-job-details">
            {jobDetails.map(([label, value]) => (
              <p key={label}>
                <strong>{label}:</strong> {value}
              </p>
            ))}
          </div>
        )}

        {structuredSections.length > 0 && (
          <div className="modal-structured-details" aria-label="Structured job attributes">
            {structuredSections.map(([label, values]) => (
              <section key={label} className="modal-structured-section">
                <h4>{label}</h4>
                <div className="modal-attribute-list">
                  {values.map((value) => (
                    <span key={value} className="modal-attribute-pill">
                      {value}
                    </span>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <div className="modal-report">
          <button
            type="button"
            className="modal-report-toggle"
            onClick={() => setShowReportForm((current) => !current)}
          >
            Report Listing Issue
          </button>
          {showReportForm ? (
            <form className="modal-report-form" onSubmit={handleReportSubmit}>
              <label>
                Issue
                <select
                  value={reportReason}
                  onChange={(event) => setReportReason(event.target.value)}
                >
                  {REPORT_REASONS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Comment
                <textarea
                  value={reportComment}
                  onChange={(event) => setReportComment(event.target.value)}
                  maxLength={1000}
                  placeholder="Optional"
                />
              </label>
              <div className="modal-report-actions">
                <button className="btn-secondary" type="submit" disabled={isReporting}>
                  {isReporting ? "Submitting..." : "Submit Report"}
                </button>
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={() => setShowReportForm(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : null}
          {reportMessage ? <p className="modal-report-message">{reportMessage}</p> : null}
        </div>

        <div className="modal-actions">
          {showClaimAction && (
            <button
              className="btn-secondary"
              onClick={() => onClaim(job._id)}
              title={claimTooltip || "Claim this Listing"}
              disabled={isClaiming || claimStatus === "pending"}
            >
              {claimStatus === "pending"
                ? "Claim Pending"
                : isClaiming
                ? "Submitting..."
                : "Claim this Listing"}
            </button>
          )}
          {externalApplyUrl && (
            <a
              className="btn-primary"
              href={externalApplyUrl}
              target="_blank"
              rel="noreferrer"
              title="Apply on employer site"
              onClick={handleOutboundApply}
            >
              Apply on Employer Site
            </a>
          )}
          {!externalApplyUrl && emailApplyUrl && (
            <button
              type="button"
              className="btn-primary"
              title="Email employer"
              onClick={handleEmailApplyClick}
            >
              Email Employer
            </button>
          )}
          {!externalApplyUrl && !emailApplyUrl && !isApplied && (
            <button
              className="btn-primary"
              onClick={() => onApply(job._id)}
              title="Apply to this job"
            >
              {isAuthed ? "Mark as Applied" : "Sign in to Mark Applied"}
            </button>
          )}
          <Link className="btn-secondary" to={publicDetailHref}>
            View Full Listing
          </Link>
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
        {showEmailDialog && applyEmail ? (
          <div
            className="email-apply-dialog-backdrop"
            role="presentation"
            onClick={() => setShowEmailDialog(false)}
          >
            <div
              className="email-apply-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="email-employer-title"
              onClick={(event) => event.stopPropagation()}
            >
              <h4 id="email-employer-title">Email Employer</h4>
              <p className="email-apply-address">{applyEmail}</p>
              <div className="email-apply-actions">
                <button type="button" className="btn-primary" onClick={handleCopyEmailAddress}>
                  {emailCopied ? "Copied" : "Copy Email Address"}
                </button>
                <a className="btn-secondary" href={emailApplyUrl}>
                  Open Email App
                </a>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
