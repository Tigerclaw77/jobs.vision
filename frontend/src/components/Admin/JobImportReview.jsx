import React, { useEffect, useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Box,
  Button,
  Checkbox,
  Chip,
  Grid,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  approveJobImport,
  backfillJobImportClassifications,
  batchJobImportAction,
  bulkPublishJobImports,
  fetchJobImportClassificationBackfillStatus,
  fetchJobImportReviewSummary,
  fetchJobImports,
  rejectJobImport,
  runJobDiscovery,
  updateJobImport,
} from "../../utils/api";
import {
  LISTING_OPPORTUNITY_TYPE_OPTIONS,
  LISTING_TIER_OPTIONS,
  LOCATION_PRECISION_OPTIONS,
} from "../../utils/jobTaxonomy";
import "./JobImportReview.css";

const SOURCE_TYPES = ["career_page", "smartrecruiters", "greenhouse", "lever", "workday", "icims", "taleo", "unknown"];
const JOB_ROLES = [
  ["", "Auto from tags"],
  ["optometrist", "Optometrist"],
  ["optician", "Optician"],
  ["ophthalmic_technician", "Ophthalmic Technician"],
  ["optical_lab", "Optical Lab"],
  ["front_desk", "Front Desk"],
  ["practice_manager", "Practice Manager"],
  ["other", "Other"],
];
const EMPLOYMENT_TYPES = [
  ["", "Unspecified"],
  ["full_time", "Full-Time"],
  ["part_time", "Part-Time"],
  ["per_diem_fill_in", "Per Diem / Fill-In"],
];
const EMPLOYMENT_TYPE_LABELS = Object.fromEntries(EMPLOYMENT_TYPES);
const HIGH_CONFIDENCE_THRESHOLD = 95;
const EMPTY_SUMMARY = {
  totalImports: 0,
  pendingReview: 0,
  reviewQueue: 0,
  recommendedApprove: 0,
  recommendedReject: 0,
  needsReview: 0,
  humanReviewRequired: 0,
  evergreenJobs: 0,
  autoApproved: 0,
  autoRejected: 0,
  publishedLive: 0,
  removed: 0,
};
const EMPTY_BACKFILL_STATUS = {
  rowsRemaining: 0,
  recommendationNull: 0,
  primaryRoleNull: 0,
  classificationConfidenceScoreNull: 0,
  recommendations: [],
  roles: [],
};

function normalizedFromItem(item = {}) {
  const normalized = item.normalized_job || {};
  const classification = normalized.classificationSummary || {};
  return {
    title: normalized.title || item.normalized_title || item.raw_title || "",
    company: normalized.company || item.normalized_company || item.employer_name || "",
    location: normalized.location || item.normalized_location || item.raw_location || "",
    employmentType:
      normalized.employmentType || item.normalized_employment_type || "",
    compensation: normalized.compensation || item.normalized_compensation || "",
    description:
      normalized.description || item.normalized_description || item.raw_description || "",
    applyUrl: normalized.applyUrl || item.normalized_apply_url || item.apply_url || "",
    sourceUrl: normalized.sourceUrl || item.normalized_source_url || item.source_url || "",
    sourceType: normalized.sourceType || item.normalized_source_type || item.source_type || "unknown",
    industryTags: normalized.industryTags || item.industry_tags || [],
    roleTags: normalized.roleTags || item.role_tags || [],
    listingSource: normalized.listingSource || item.listing_source || "imported",
    listingTier: normalized.listingTier || item.listing_tier || "imported",
    listingOpportunityType:
      normalized.listingOpportunityType || item.listing_opportunity_type || "job",
    locationPrecision:
      normalized.locationPrecision || item.location_precision || (item.normalized_location || item.raw_location ? "city" : "unknown"),
    primaryRole: normalized.primaryRole || classification.primaryRole || item.primary_role || "",
    secondaryRole: normalized.secondaryRole || classification.secondaryRole || item.secondary_role || "",
    specialty: normalized.specialty || classification.specialty || item.specialty || "",
    practiceType:
      normalized.practiceType || classification.practiceType || item.classification_practice_type || "",
    compensationSummary:
      normalized.compensationSummary ||
      classification.compensationSummary ||
      item.compensation_summary ||
      normalized.compensation ||
      item.normalized_compensation ||
      "",
    jobsVisionRelevant:
      typeof normalized.jobsVisionRelevant === "boolean"
        ? normalized.jobsVisionRelevant
        : typeof classification.jobsVisionRelevant === "boolean"
          ? classification.jobsVisionRelevant
          : item.jobs_vision_relevant,
    recommendation:
      normalized.recommendation || classification.recommendation || item.recommendation || "",
    recommendationReason:
      normalized.recommendationReason ||
      classification.recommendationReason ||
      item.recommendation_reason ||
      "",
    classificationConfidenceScore:
      normalized.classificationConfidenceScore ||
      classification.confidenceScore ||
      item.classification_confidence_score ||
      null,
    roleBadge: normalized.roleBadge || classification.roleBadge || item.role_badge || "",
    autoDecisionApplied: Boolean(
      normalized.autoDecisionApplied ||
      classification.autoDecisionApplied ||
      item.auto_decision_applied
    ),
    autoDecision:
      normalized.autoDecision ||
      classification.autoDecision ||
      item.auto_decision ||
      "",
    reviewAction: normalized.reviewAction || item.review_action || "",
    reviewSource: normalized.reviewSource || item.review_source || "",
    role: "",
  };
}

function inferRoleBadge(edit = {}) {
  const title = `${edit.title || ""}`.toLowerCase();
  const text = `${edit.title || ""} ${edit.description || ""}`.toLowerCase();
  const titleHas = (pattern) => pattern.test(title);
  const textHas = (pattern) => pattern.test(text);

  if (
    titleHas(/\bophthalmologist\b/) ||
    titleHas(/\b(retina|cornea|corneal|glaucoma|cataract|oculoplastic)\s+surgeon\b/)
  ) return "OMD";
  if (
    titleHas(/\bregistered nurse\b/) ||
    titleHas(/\bnurse practitioner\b/) ||
    titleHas(/\bnursing assistant\b/) ||
    titleHas(/\bnurse\b/) ||
    titleHas(/\brn\b/) ||
    titleHas(/\blpn\b/) ||
    titleHas(/\blvn\b/) ||
    titleHas(/\bcna\b/) ||
    titleHas(/\bnp\b/)
  ) {
    const eyecareNursing =
      textHas(/\bophthalmic nurse\b/) ||
      textHas(/\bophthalmology nurse\b/) ||
      textHas(/\beye surgery\s+(rn|nurse)\b/) ||
      textHas(/\b(ophthalmology|ophthalmic|cataract|retina|glaucoma).{0,60}\b(rn|nurse)\b/) ||
      textHas(/\b(optometry|optometric|ophthalmology|ophthalmic|eye clinic|eye care|eyecare|cataract|retina|glaucoma).{0,80}\b(rn|nurse|nurse practitioner|np)\b/) ||
      textHas(/\b(rn|nurse|nurse practitioner|np).{0,80}\b(optometry|optometric|ophthalmology|ophthalmic|eye clinic|eye care|eyecare|cataract|retina|glaucoma)\b/);
    return eyecareNursing ? "UNKNOWN" : "OTHER";
  }
  if (titleHas(/\boptometrist\b/) || titleHas(/\bdoctor of optometry\b/)) return "OD";
  if (titleHas(/\boptician\b/)) return "OPTICIAN";
  if (
    titleHas(/\bophthalmic technician\b/) ||
    titleHas(/\bophthalmic assistant\b/) ||
    titleHas(/\bophthalmic medical assistant\b/) ||
    titleHas(/\boptometric technician\b/) ||
    titleHas(/\boptometric assistant\b/) ||
    titleHas(/\bscribe\b/)
  ) return "TECH";
  if (titleHas(/\bpractice manager\b/) || titleHas(/\boffice manager\b/) || titleHas(/\bclinic manager\b/)) return "MANAGER";
  if (
    titleHas(/\bfront desk\b/) ||
    titleHas(/\breceptionist\b/) ||
    titleHas(/\bpatient care coordinator\b/) ||
    titleHas(/\bpatient services representative\b/) ||
    titleHas(/\bpatient service representative\b/) ||
    titleHas(/\bpatient access representative\b/) ||
    titleHas(/\bpatient coordinator\b/) ||
    titleHas(/\bpatient care associate\b/) ||
    titleHas(/\bscheduling coordinator\b/)
  ) {
    const eyecareContext =
      textHas(/\bophthalmology\b/) ||
      textHas(/\bophthalmic\b/) ||
      textHas(/\boptometry\b/) ||
      textHas(/\boptical\b/) ||
      textHas(/\beye clinic\b/) ||
      textHas(/\beye\s?care\b/) ||
      textHas(/\beyecare\b/) ||
      textHas(/\bvision\b/);
    return eyecareContext ? "FRONT_DESK" : "OTHER";
  }
  if (titleHas(/\bmedical assistant\b/) || titleHas(/\bclinical assistant\b/) || titleHas(/\bpatient care technician\b/)) {
    const eyecareContext =
      textHas(/\bophthalmology\b/) ||
      textHas(/\bophthalmic\b/) ||
      textHas(/\boptometry\b/) ||
      textHas(/\boptical\b/) ||
      textHas(/\beye clinic\b/) ||
      textHas(/\beye\s?care\b/) ||
      textHas(/\beyecare\b/) ||
      textHas(/\bvision\b/);
    return eyecareContext ? "TECH" : "OTHER";
  }
  if (titleHas(/\boptical lab\b/) || titleHas(/\boptical sales\b/) || titleHas(/\beyewear consultant\b/)) return "OPTICAL";

  const omdRequirement = textHas(/\bboard certified ophthalmologist\b/) ||
    textHas(/\bophthalmology residency\b/) ||
    textHas(/\bfellowship[-\s]trained ophthalmologist\b/) ||
    textHas(/\bmd\/do\b/) ||
    textHas(/\bamerican board of ophthalmology\b/);
  const odRequirement = textHas(/\bdoctor of optometry\b/) ||
    textHas(/\boptometric license\b/) ||
    textHas(/\boptometry license\b/) ||
    textHas(/\blicensed optometrist\b/) ||
    textHas(/\bod license\b/);

  if (omdRequirement && !odRequirement) return "OMD";
  if (odRequirement && !omdRequirement) return "OD";
  if (omdRequirement && odRequirement) return "UNKNOWN";

  return "UNKNOWN";
}

function classificationFromItem(item = {}, edit = {}) {
  const badge = edit.roleBadge || item.role_badge || inferRoleBadge(edit);
  const jobsVisionRelevant =
    typeof edit.jobsVisionRelevant === "boolean"
      ? edit.jobsVisionRelevant
      : badge === "UNKNOWN" || badge === "OTHER"
        ? null
        : badge !== "OMD";
  const recommendation = edit.recommendation || (jobsVisionRelevant === null ? "review" : jobsVisionRelevant ? "approve" : "reject");
  const confidence = Number(edit.classificationConfidenceScore || item.confidence_score || 0);

  return {
    roleBadge: badge || "UNKNOWN",
    primaryRole: edit.primaryRole || (badge === "UNKNOWN" ? "Unknown" : badge),
    secondaryRole: edit.secondaryRole || "",
    specialty: edit.specialty || "",
    employmentType: EMPLOYMENT_TYPE_LABELS[edit.employmentType] || edit.employmentType || "",
    practiceType: edit.practiceType || "",
    compensationSummary: edit.compensationSummary || edit.compensation || "",
    jobsVisionRelevant,
    recommendation,
    recommendationReason:
      edit.recommendationReason ||
      (recommendation === "review"
        ? "Hiring target is ambiguous; review manually before approving."
        : recommendation === "reject"
        ? "Role appears outside the current jobs.vision review scope."
        : badge === "FRONT_DESK"
        ? "Eye care front-desk or patient-facing administrative role."
        : "Posting appears relevant to optometry or optical hiring."),
    confidence: Number.isFinite(confidence) ? confidence : 0,
  };
}

function statusLabel(status) {
  return String(status || "needs_review").replace(/_/g, " ");
}

function relevanceLabel(value) {
  if (value === true) return "YES";
  if (value === false) return "NO";
  return "NEEDS REVIEW";
}

function recommendationLabel(value) {
  const normalized = recommendationClass(value);
  return normalized === "review" ? "REVIEW REQUIRED" : normalized.toUpperCase();
}

function recommendationClass(value) {
  return String(value || "review").toLowerCase();
}

function hasDisplayValue(value) {
  if (Array.isArray(value)) return value.some(hasDisplayValue);
  if (value === null || value === undefined) return false;
  return String(value).trim().length > 0;
}

function confidenceFor(item = {}, edit = {}) {
  const classification = classificationFromItem(item, edit);
  return Number(classification.confidence || 0);
}

function isHighConfidenceApprove(item = {}, edit = {}) {
  const classification = classificationFromItem(item, edit);
  return (
    classification.recommendation === "approve" &&
    Number(classification.confidence || 0) >= HIGH_CONFIDENCE_THRESHOLD &&
    classification.roleBadge !== "UNKNOWN" &&
    classification.roleBadge !== "OTHER" &&
    classification.roleBadge !== "OMD" &&
    Boolean(edit.applyUrl || item.normalized_apply_url || item.apply_url)
  );
}

function isHighConfidenceReject(item = {}, edit = {}) {
  const classification = classificationFromItem(item, edit);
  return (
    classification.recommendation === "reject" &&
    Number(classification.confidence || 0) >= HIGH_CONFIDENCE_THRESHOLD &&
    classification.roleBadge !== "UNKNOWN"
  );
}

function isNeedsHumanReview(item = {}, edit = {}) {
  const classification = classificationFromItem(item, edit);
  return (
    classification.recommendation === "review" ||
    classification.roleBadge === "UNKNOWN" ||
    Number(classification.confidence || 0) < HIGH_CONFIDENCE_THRESHOLD
  );
}

function JobImportReview() {
  const [status, setStatus] = useState("needs_review");
  const [listingTierFilter, setListingTierFilter] = useState("all");
  const [listingOpportunityFilter, setListingOpportunityFilter] = useState("all");
  const [items, setItems] = useState([]);
  const [edits, setEdits] = useState({});
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [backfillStatus, setBackfillStatus] = useState(EMPTY_BACKFILL_STATUS);
  const [backfillResult, setBackfillResult] = useState(null);
  const [reviewFilter, setReviewFilter] = useState("pending");
  const [compactHighConfidence, setCompactHighConfidence] = useState(true);
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [runningDiscovery, setRunningDiscovery] = useState(false);
  const [runningBackfill, setRunningBackfill] = useState(false);
  const [bulkPublishing, setBulkPublishing] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkSummary, setBulkSummary] = useState(null);
  const [bulkDefaults, setBulkDefaults] = useState({
    listingTier: "imported",
    locationPrecision: "city",
  });
  const [sourceForm, setSourceForm] = useState({
    employerName: "",
    employerWebsiteUrl: "",
    careersUrl: "",
    industryKey: "eyecare",
    sourceType: "career_page",
  });

  async function loadImports(
    nextStatus = status,
    nextListingTier = listingTierFilter,
    nextListingOpportunity = listingOpportunityFilter
  ) {
    setLoading(true);
    setMessage("");
    try {
      const rows = await fetchJobImports({
        status: nextStatus,
        listingTier: nextListingTier,
        listingOpportunityType: nextListingOpportunity,
        limit: 200,
      });
      fetchJobImportReviewSummary()
        .then((nextSummary) => setSummary({ ...EMPTY_SUMMARY, ...nextSummary }))
        .catch(() => setSummary(EMPTY_SUMMARY));
      fetchJobImportClassificationBackfillStatus()
        .then((nextStatus) => setBackfillStatus({ ...EMPTY_BACKFILL_STATUS, ...nextStatus }))
        .catch(() => setBackfillStatus(EMPTY_BACKFILL_STATUS));
      setItems(rows);
      setSelectedIds((current) => {
        const visibleIds = new Set(rows.map((row) => row.id));
        return new Set([...current].filter((id) => visibleIds.has(id)));
      });
      setEdits(
        rows.reduce((acc, item) => {
          acc[item.id] = normalizedFromItem(item);
          return acc;
        }, {})
      );
    } catch (error) {
      setMessage(error?.response?.data?.error || "Failed to load job imports.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadImports(status, listingTierFilter, listingOpportunityFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, listingTierFilter, listingOpportunityFilter]);

  const pendingCount = useMemo(
    () => items.filter((item) => item.status === "needs_review").length,
    [items]
  );
  const visibleItems = useMemo(() => {
    return items.filter((item) => {
      const edit = edits[item.id] || normalizedFromItem(item);
      const classification = classificationFromItem(item, edit);
      if (reviewFilter === "all") return true;
      if (reviewFilter === "pending") return item.status === "needs_review" || item.status === "discovered";
      if (reviewFilter === "recommended_approve") return classification.recommendation === "approve";
      if (reviewFilter === "recommended_reject") return classification.recommendation === "reject";
      if (reviewFilter === "needs_review") return isNeedsHumanReview(item, edit);
      if (reviewFilter === "high_confidence") {
        return isHighConfidenceApprove(item, edit) || isHighConfidenceReject(item, edit);
      }
      if (reviewFilter === "low_confidence") return confidenceFor(item, edit) < HIGH_CONFIDENCE_THRESHOLD;
      return true;
    });
  }, [items, edits, reviewFilter]);
  const publishableItems = useMemo(
    () =>
      visibleItems.filter(
        (item) => item.status !== "published" && item.status !== "rejected" && item.status !== "evergreen"
      ),
    [visibleItems]
  );
  const selectedItems = useMemo(
    () =>
      visibleItems.filter(
        (item) =>
          selectedIds.has(item.id) &&
          item.status !== "published" &&
          item.status !== "rejected" &&
          item.status !== "evergreen"
      ),
    [visibleItems, selectedIds]
  );
  const allPublishableSelected =
    publishableItems.length > 0 && publishableItems.every((item) => selectedIds.has(item.id));
  const selectedCount = selectedItems.length;

  function updateSourceField(field, value) {
    setSourceForm((current) => ({ ...current, [field]: value }));
  }

  function updateEdit(id, field, value) {
    setEdits((current) => ({
      ...current,
      [id]: {
        ...(current[id] || {}),
        [field]: value,
      },
    }));
  }

  function updateBulkDefault(field, value) {
    setBulkDefaults((current) => ({ ...current, [field]: value }));
  }

  function toggleSelected(id, checked) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAllVisible(checked) {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const item of publishableItems) {
        if (checked) next.add(item.id);
        else next.delete(item.id);
      }
      return next;
    });
  }

  function toggleExpanded(id) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function refreshSummary() {
    try {
      const nextSummary = await fetchJobImportReviewSummary();
      setSummary({ ...EMPTY_SUMMARY, ...nextSummary });
    } catch {
      setSummary(EMPTY_SUMMARY);
    }
  }

  async function refreshBackfillStatus() {
    try {
      const nextStatus = await fetchJobImportClassificationBackfillStatus();
      setBackfillStatus({ ...EMPTY_BACKFILL_STATUS, ...nextStatus });
    } catch {
      setBackfillStatus(EMPTY_BACKFILL_STATUS);
    }
  }

  async function handleRunDiscovery(event) {
    event.preventDefault();
    setRunningDiscovery(true);
    setMessage("");
    try {
      const source = {
        ...sourceForm,
        careersUrl: sourceForm.careersUrl || null,
        industryKey: sourceForm.industryKey || null,
      };
      const result = await runJobDiscovery(source);
      setMessage(`Discovery complete: ${result.count || 0} review item(s) saved.`);
      setSourceForm((current) => ({ ...current, employerName: "", careersUrl: "" }));
      setStatus("needs_review");
      await loadImports("needs_review");
      await refreshSummary();
    } catch (error) {
      setMessage(error?.response?.data?.error || "Discovery failed.");
    } finally {
      setRunningDiscovery(false);
    }
  }

  async function handleBackfillClassifications({ force = false } = {}) {
    const remaining = Number(backfillStatus.rowsRemaining || 0);
    const confirmed = window.confirm(
      force
        ? "Reclassify all existing imports with the current classifier rules? This will replace populated classification fields."
        : `Backfill classifications for ${remaining || "all unclassified"} existing import row(s)? Existing populated classifications will be preserved.`
    );
    if (!confirmed) return;

    setRunningBackfill(true);
    setMessage("");
    setBackfillResult(null);
    try {
      const result = await backfillJobImportClassifications({ force, limit: 5000 });
      setBackfillResult(result);
      setMessage(
        `${force ? "Reclassification" : "Classification backfill"} complete: ${result.totalClassified || 0} classified, ${result.totalFailures || 0} failed, ${result.rowsRemaining || 0} remaining.`
      );
      await loadImports(status, listingTierFilter, listingOpportunityFilter);
      await refreshSummary();
      await refreshBackfillStatus();
    } catch (error) {
      setMessage(error?.response?.data?.error || "Classification backfill failed.");
    } finally {
      setRunningBackfill(false);
    }
  }

  async function handleSave(id) {
    setMessage("");
    try {
      const updated = await updateJobImport(id, edits[id]);
      setItems((current) => current.map((item) => (item.id === id ? updated : item)));
      setEdits((current) => ({ ...current, [id]: normalizedFromItem(updated) }));
      setMessage("Import edits saved.");
      await refreshSummary();
    } catch (error) {
      setMessage(error?.response?.data?.error || "Failed to save import.");
    }
  }

  async function handleApprove(id) {
    setMessage("");
    try {
      await approveJobImport(id, edits[id]);
      setMessage("Import published as a public job.");
      await loadImports(status);
      await refreshSummary();
    } catch (error) {
      setMessage(error?.response?.data?.error || "Failed to publish import.");
    }
  }

  async function handleBulkPublish() {
    if (!selectedItems.length) {
      setMessage("Select at least one import to publish.");
      return;
    }

    setBulkPublishing(true);
    setMessage("");
    setBulkSummary(null);
    try {
      const result = await bulkPublishJobImports({
        defaults: bulkDefaults,
        items: selectedItems.map((item) => ({
          id: item.id,
          job: edits[item.id] || normalizedFromItem(item),
        })),
      });
      setBulkSummary(result);
      setMessage(
        `Bulk publish complete: ${result.successCount || 0} succeeded, ${result.failureCount || 0} failed.`
      );
      setSelectedIds(new Set());
      await loadImports(status, listingTierFilter, listingOpportunityFilter);
      await refreshSummary();
    } catch (error) {
      const result = error?.response?.data;
      if (result?.results) {
        setBulkSummary(result);
        setMessage(
          `Bulk publish complete: ${result.successCount || 0} succeeded, ${result.failureCount || 0} failed.`
        );
        setSelectedIds(new Set());
        await loadImports(status, listingTierFilter, listingOpportunityFilter);
        await refreshSummary();
      } else {
        setMessage(error?.response?.data?.error || "Bulk publish failed.");
      }
    } finally {
      setBulkPublishing(false);
    }
  }

  async function handleReject(id) {
    const reason = window.prompt("Optional rejection reason", "");
    if (reason === null) return;
    setMessage("");
    try {
      await rejectJobImport(id, reason);
      setMessage("Import rejected.");
      await loadImports(status);
      await refreshSummary();
    } catch (error) {
      setMessage(error?.response?.data?.error || "Failed to reject import.");
    }
  }

  async function handleBatchAction(action) {
    const actionLabels = {
      publish_high_confidence_approve: "publish all high-confidence approve recommendations",
      reject_high_confidence_reject: "reject all high-confidence reject recommendations",
      reject_selected: `reject ${selectedCount} selected import${selectedCount === 1 ? "" : "s"}`,
    };
    if (action === "reject_selected" && !selectedCount) {
      setMessage("Select at least one import to reject.");
      return;
    }

    const confirmed = window.confirm(`Confirm ${actionLabels[action] || "batch action"}?`);
    if (!confirmed) return;

    const reason =
      action === "reject_selected"
        ? window.prompt("Optional rejection reason", "Batch rejected from import review.")
        : "";
    if (reason === null) return;

    setBulkPublishing(true);
    setMessage("");
    setBulkSummary(null);
    try {
      const result = await batchJobImportAction({
        action,
        ids: action === "reject_selected" ? selectedItems.map((item) => item.id) : [],
        defaults: bulkDefaults,
        reason,
      });
      setBulkSummary(result);
      setMessage(
        `Batch action complete: ${result.successCount || 0} succeeded, ${result.failureCount || 0} failed.`
      );
      setSelectedIds(new Set());
      await loadImports(status, listingTierFilter, listingOpportunityFilter);
      await refreshSummary();
    } catch (error) {
      const result = error?.response?.data;
      if (result?.results) {
        setBulkSummary(result);
        setMessage(
          `Batch action complete: ${result.successCount || 0} succeeded, ${result.failureCount || 0} failed.`
        );
        setSelectedIds(new Set());
        await loadImports(status, listingTierFilter, listingOpportunityFilter);
        await refreshSummary();
      } else {
        setMessage(error?.response?.data?.error || "Batch action failed.");
      }
    } finally {
      setBulkPublishing(false);
    }
  }

  const summaryCards = [
    ["Total imports", summary.totalImports],
    ["Recommended approve", summary.recommendedApprove],
    ["Recommended reject", summary.recommendedReject],
    ["Human review required", summary.humanReviewRequired ?? summary.needsReview],
    ["Evergreen jobs", summary.evergreenJobs],
    ["Auto-approved", summary.autoApproved],
    ["Auto-rejected", summary.autoRejected],
    ["Review queue", summary.reviewQueue ?? summary.pendingReview],
    ["Published/live", summary.publishedLive],
    ["Deleted/removed", summary.removed],
  ];
  const reviewFilterOptions = [
    ["all", "Show all"],
    ["pending", "Pending only"],
    ["recommended_approve", "Recommended approve"],
    ["recommended_reject", "Recommended reject"],
    ["needs_review", "Needs review"],
    ["high_confidence", "High confidence only"],
    ["low_confidence", "Low confidence only"],
  ];

  return (
    <Box className="job-import-review text-on-dim">
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", md: "center" }}
        gap={2}
        className="job-import-review__header"
      >
        <Box>
          <Typography variant="h4" component="h2">
            Job Import Review
          </Typography>
          <Typography variant="body2">
            Discover employer career-page postings and publish only after admin review.
          </Typography>
        </Box>
        <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
          <Button
            component={RouterLink}
            to="/admin/discovery-sources"
            variant="outlined"
            className="glass-button"
          >
            Discovery Sources
          </Button>
          <Stack direction="row" gap={1} alignItems="center">
            <Typography variant="body2">Status</Typography>
            <Select
              size="small"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="job-import-review__select"
            >
              <MenuItem value="needs_review">Needs Review</MenuItem>
              <MenuItem value="evergreen">Evergreen</MenuItem>
              <MenuItem value="rejected">Rejected</MenuItem>
              <MenuItem value="published">Published</MenuItem>
              <MenuItem value="all">All</MenuItem>
            </Select>
          </Stack>
          <Stack direction="row" gap={1} alignItems="center">
            <Typography variant="body2">Tier</Typography>
            <Select
              size="small"
              value={listingTierFilter}
              onChange={(event) => setListingTierFilter(event.target.value)}
              className="job-import-review__select"
            >
              <MenuItem value="all">All</MenuItem>
              {LISTING_TIER_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </Stack>
          <Stack direction="row" gap={1} alignItems="center">
            <Typography variant="body2">Type</Typography>
            <Select
              size="small"
              value={listingOpportunityFilter}
              onChange={(event) => setListingOpportunityFilter(event.target.value)}
              className="job-import-review__select"
            >
              <MenuItem value="all">All</MenuItem>
              {LISTING_OPPORTUNITY_TYPE_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </Stack>
        </Stack>
      </Stack>

      <Paper className="job-import-review__panel" component="form" onSubmit={handleRunDiscovery}>
        <Typography variant="h6">Run Discovery</Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={3}>
            <TextField
              label="Employer Name"
              value={sourceForm.employerName}
              onChange={(event) => updateSourceField("employerName", event.target.value)}
              fullWidth
              required
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              label="Employer Website URL"
              value={sourceForm.employerWebsiteUrl}
              onChange={(event) => updateSourceField("employerWebsiteUrl", event.target.value)}
              fullWidth
              required
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              label="Careers URL"
              value={sourceForm.careersUrl}
              onChange={(event) => updateSourceField("careersUrl", event.target.value)}
              fullWidth
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <Select
              value={sourceForm.sourceType}
              onChange={(event) => updateSourceField("sourceType", event.target.value)}
              fullWidth
            >
              {SOURCE_TYPES.map((type) => (
                <MenuItem key={type} value={type}>
                  {type}
                </MenuItem>
              ))}
            </Select>
          </Grid>
          <Grid item xs={12} md={1}>
            <Button type="submit" variant="contained" disabled={runningDiscovery} fullWidth>
              Run
            </Button>
          </Grid>
        </Grid>
      </Paper>

      <Paper className="job-import-review__control-panel">
        <div className="job-import-review__tallies">
          {summaryCards.map(([label, value]) => (
            <div className="job-import-review__tally" key={label}>
              <span>{label}</span>
              <strong>{Number(value || 0)}</strong>
            </div>
          ))}
        </div>

        <div className="job-import-review__quick-filters" aria-label="Import review quick filters">
          {reviewFilterOptions.map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={reviewFilter === value ? "active" : ""}
              onClick={() => {
                setReviewFilter(value);
                if (value === "all") setStatus("all");
                if (value === "pending") setStatus("needs_review");
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="job-import-review__backfill">
          <div>
            <Typography variant="subtitle2">Classification Backfill</Typography>
            <Typography variant="body2">
              {Number(backfillStatus.rowsRemaining || 0)} row(s) remaining.{" "}
              {Number(backfillStatus.recommendationNull || 0)} missing recommendation,{" "}
              {Number(backfillStatus.primaryRoleNull || 0)} missing role,{" "}
              {Number(backfillStatus.classificationConfidenceScoreNull || 0)} missing confidence.
            </Typography>
            {backfillResult ? (
              <div className="job-import-review__backfill-result">
                <span>Processed: {Number(backfillResult.totalScanned || 0)}</span>
                <span>Classified: {Number(backfillResult.totalClassified || 0)}</span>
                <span>Skipped: {Number(backfillResult.totalSkipped || 0)}</span>
                <span>Failed: {Number(backfillResult.totalFailures || 0)}</span>
              </div>
            ) : null}
            {backfillResult?.after ? (
              <div className="job-import-review__backfill-distribution">
                <span>
                  Recommendations:{" "}
                  {(backfillResult.after.recommendations || [])
                    .map((row) => `${row.recommendation}: ${row.count}`)
                    .join(", ") || "none"}
                </span>
                <span>
                  Roles:{" "}
                  {(backfillResult.after.roles || [])
                    .map((row) => `${row.role_badge}: ${row.count}`)
                    .join(", ") || "none"}
                </span>
              </div>
            ) : null}
          </div>
          <Stack direction={{ xs: "column", sm: "row" }} gap={1}>
            <Button
              variant="contained"
              onClick={() => handleBackfillClassifications({ force: false })}
              disabled={runningBackfill || Number(backfillStatus.rowsRemaining || 0) === 0}
            >
              {runningBackfill ? "Backfilling..." : "Backfill Classifications"}
            </Button>
            <Button
              variant="outlined"
              onClick={() => handleBackfillClassifications({ force: true })}
              disabled={runningBackfill}
            >
              {runningBackfill ? "Reclassifying..." : "Reclassify Existing Imports"}
            </Button>
          </Stack>
        </div>

        <div className="job-import-review__batch-actions">
          <Button
            variant="contained"
            onClick={() => handleBatchAction("publish_high_confidence_approve")}
            disabled={bulkPublishing}
          >
            Approve High-Confidence Approves
          </Button>
          <Button
            variant="outlined"
            color="error"
            onClick={() => handleBatchAction("reject_high_confidence_reject")}
            disabled={bulkPublishing}
          >
            Reject High-Confidence Rejects
          </Button>
          <Button
            variant="outlined"
            onClick={() => setCompactHighConfidence(true)}
          >
            Collapse High-Confidence
          </Button>
          <Button
            variant="outlined"
            onClick={() => {
              setCompactHighConfidence(true);
              setExpandedIds(new Set());
              setReviewFilter("needs_review");
            }}
          >
            Expand Needs-Review Only
          </Button>
        </div>
      </Paper>

      {message ? <div className="job-import-review__message">{message}</div> : null}

      <Typography variant="body2" className="job-import-review__count">
        {loading
          ? "Loading imports..."
          : `${visibleItems.length} visible item(s), ${pendingCount} in review queue`}
      </Typography>

      <Paper className="job-import-review__bulk">
        <Stack
          direction={{ xs: "column", lg: "row" }}
          gap={2}
          alignItems={{ xs: "stretch", lg: "center" }}
          justifyContent="space-between"
        >
          <Stack direction="row" gap={1.5} alignItems="center" flexWrap="wrap">
            <Checkbox
              checked={allPublishableSelected}
              indeterminate={selectedCount > 0 && !allPublishableSelected}
              onChange={(event) => toggleAllVisible(event.target.checked)}
              disabled={!publishableItems.length}
            />
            <Typography variant="body2">
              Preview count: <strong>{selectedCount}</strong>
            </Typography>
            {bulkSummary ? (
              <>
                <Typography variant="body2">
                  Publish count: <strong>{bulkSummary.publishCount || 0}</strong>
                </Typography>
                <Typography variant="body2">
                  Success: <strong>{bulkSummary.successCount || 0}</strong>
                </Typography>
                <Typography variant="body2">
                  Failure: <strong>{bulkSummary.failureCount || 0}</strong>
                </Typography>
              </>
            ) : null}
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} gap={1} alignItems="stretch">
            <Select
              size="small"
              value={bulkDefaults.listingTier}
              onChange={(event) => updateBulkDefault("listingTier", event.target.value)}
              className="job-import-review__select"
            >
              {LISTING_TIER_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  Tier: {option.label}
                </MenuItem>
              ))}
            </Select>
            <Select
              size="small"
              value={bulkDefaults.locationPrecision}
              onChange={(event) => updateBulkDefault("locationPrecision", event.target.value)}
              className="job-import-review__select"
            >
              {LOCATION_PRECISION_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  Precision: {option.label}
                </MenuItem>
              ))}
            </Select>
            <Button
              variant="contained"
              onClick={handleBulkPublish}
              disabled={!selectedCount || bulkPublishing}
            >
              {bulkPublishing ? "Publishing..." : "Bulk Publish Selected"}
            </Button>
            <Button
              variant="outlined"
              color="error"
              onClick={() => handleBatchAction("reject_selected")}
              disabled={!selectedCount || bulkPublishing}
            >
              Reject Selected
            </Button>
          </Stack>
        </Stack>

        {bulkSummary?.results?.some((result) => !result.ok) ? (
          <div className="job-import-review__bulk-errors">
            {bulkSummary.results
              .filter((result) => !result.ok)
              .slice(0, 5)
              .map((result) => (
                <p key={result.id || result.error}>
                  {result.id || "Unknown import"}: {result.error}
                </p>
              ))}
          </div>
        ) : null}
      </Paper>

      <Stack gap={2}>
        {visibleItems.map((item) => {
          const edit = edits[item.id] || normalizedFromItem(item);
          const classification = classificationFromItem(item, edit);
          const sourceUrl = edit.sourceUrl || item.source_url;
          const applyUrl = edit.applyUrl || item.apply_url;
          const isHighConfidenceDecision =
            isHighConfidenceApprove(item, edit) || isHighConfidenceReject(item, edit);
          const compact =
            compactHighConfidence &&
            isHighConfidenceDecision &&
            !expandedIds.has(item.id);
          const recommendation = recommendationClass(classification.recommendation);
          const classificationFields = [
            ["Role Category", classification.primaryRole || "Unknown", true],
            ["Secondary Role", classification.secondaryRole],
            ["Specialty", classification.specialty],
            ["Employment Type", classification.employmentType],
            ["Practice Type", classification.practiceType],
            ["Compensation", classification.compensationSummary],
            ["Confidence", `${Math.round(classification.confidence)}%`, true],
          ].filter(([, value, always]) => always || hasDisplayValue(value));
          const roleTags = (edit.roleTags || []).filter(hasDisplayValue);
          const industryTags = (edit.industryTags || []).filter(hasDisplayValue);
          const hasTags = roleTags.length > 0 || industryTags.length > 0;
          const hasDetailFields =
            hasDisplayValue(edit.applyUrl) ||
            hasDisplayValue(edit.sourceUrl) ||
            hasDisplayValue(edit.description) ||
            hasDisplayValue(edit.locationPrecision);

          return (
            <Paper
              className={`job-import-review__item ${compact ? "job-import-review__item--compact" : ""} ${
                recommendation === "review" ? "job-import-review__item--manual-review" : ""
              }`}
              key={item.id}
            >
              <Stack
                direction={{ xs: "column", md: "row" }}
                justifyContent="space-between"
                gap={1.5}
                alignItems={{ xs: "stretch", md: "flex-start" }}
              >
                <Box className="job-import-review__item-title">
                  <Checkbox
                    checked={selectedIds.has(item.id)}
                    onChange={(event) => toggleSelected(item.id, event.target.checked)}
                    disabled={item.status === "published"}
                  />
                  <span
                    className={`job-import-review__role-badge job-import-review__role-badge--${classification.roleBadge.toLowerCase()}`}
                  >
                    {classification.roleBadge}
                  </span>
                  <div>
                    <Typography variant="h6">{edit.title || "Untitled import"}</Typography>
                    <Typography variant="body2">
                      {edit.company || item.employer_name} {edit.location ? `- ${edit.location}` : ""}
                    </Typography>
                  </div>
                </Box>
                <Stack
                  direction="row"
                  gap={1}
                  flexWrap="wrap"
                  justifyContent={{ xs: "flex-start", md: "flex-end" }}
                >
                  <Chip
                    label={recommendationLabel(classification.recommendation)}
                    size="small"
                    className={`job-import-review__recommendation job-import-review__recommendation--${recommendation}`}
                  />
                  <Chip label={`${Math.round(classification.confidence)}% confidence`} size="small" />
                  <Chip label={statusLabel(item.status)} size="small" />
                  {item.auto_decision_applied ? (
                    <Chip label={`AUTO ${String(item.auto_decision || "").toUpperCase()}`} size="small" />
                  ) : null}
                  {isHighConfidenceDecision ? (
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => toggleExpanded(item.id)}
                    >
                      {compact ? "Expand" : "Collapse"}
                    </Button>
                  ) : null}
                </Stack>
              </Stack>

              {compact ? null : (
              <>
              <Box className="job-import-review__classification" aria-label="Classification summary">
                <div className="job-import-review__classification-header">
                  <Typography variant="overline">Classification</Typography>
                  <span className="job-import-review__eligibility">
                    Jobs.Vision Relevant:{" "}
                    <strong>{relevanceLabel(classification.jobsVisionRelevant)}</strong>
                  </span>
                </div>
                <div className="job-import-review__classification-grid">
                  {classificationFields.map(([label, value]) => (
                    <div key={label}>
                      <span>{label}</span>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>
                <div className="job-import-review__reason">
                  <span>Reason</span>
                  <strong>{classification.recommendationReason}</strong>
                </div>
              </Box>

              <Grid container spacing={2} className="job-import-review__fields">
                <Grid item xs={12} md={4}>
                  <TextField
                    label="Title"
                    value={edit.title}
                    onChange={(event) => updateEdit(item.id, "title", event.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    label="Company"
                    value={edit.company}
                    onChange={(event) => updateEdit(item.id, "company", event.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    label="Location"
                    value={edit.location}
                    onChange={(event) => updateEdit(item.id, "location", event.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <Select
                    value={edit.role}
                    onChange={(event) => updateEdit(item.id, "role", event.target.value)}
                    fullWidth
                  >
                    {JOB_ROLES.map(([value, label]) => (
                      <MenuItem key={value || "auto"} value={value}>
                        {label}
                      </MenuItem>
                    ))}
                  </Select>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Select
                    value={edit.employmentType || ""}
                    onChange={(event) => updateEdit(item.id, "employmentType", event.target.value)}
                    fullWidth
                  >
                    {EMPLOYMENT_TYPES.map(([value, label]) => (
                      <MenuItem key={value || "empty"} value={value}>
                        {label}
                      </MenuItem>
                    ))}
                  </Select>
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    label="Compensation"
                    value={edit.compensation}
                    onChange={(event) => updateEdit(item.id, "compensation", event.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <Select
                    value={edit.listingTier || "imported"}
                    onChange={(event) => updateEdit(item.id, "listingTier", event.target.value)}
                    fullWidth
                  >
                    {LISTING_TIER_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Select
                    value={edit.listingOpportunityType || "job"}
                    onChange={(event) =>
                      updateEdit(item.id, "listingOpportunityType", event.target.value)
                    }
                    fullWidth
                  >
                    {LISTING_OPPORTUNITY_TYPE_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </Grid>
              </Grid>

              <details className="job-import-review__details">
                <summary>Details</summary>
                {hasDetailFields ? (
                  <Grid container spacing={1.5} className="job-import-review__detail-fields">
                    {hasDisplayValue(edit.locationPrecision) ? (
                      <Grid item xs={12} md={4}>
                        <Select
                          value={edit.locationPrecision || "unknown"}
                          onChange={(event) =>
                            updateEdit(item.id, "locationPrecision", event.target.value)
                          }
                          fullWidth
                        >
                          {LOCATION_PRECISION_OPTIONS.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              Location Precision: {option.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </Grid>
                    ) : null}
                    {hasDisplayValue(edit.applyUrl) ? (
                      <Grid item xs={12} md={4}>
                        <TextField
                          label="Apply URL"
                          value={edit.applyUrl}
                          onChange={(event) => updateEdit(item.id, "applyUrl", event.target.value)}
                          fullWidth
                        />
                      </Grid>
                    ) : null}
                    {hasDisplayValue(edit.sourceUrl) ? (
                      <Grid item xs={12} md={4}>
                        <TextField
                          label="Source URL"
                          value={edit.sourceUrl}
                          onChange={(event) => updateEdit(item.id, "sourceUrl", event.target.value)}
                          fullWidth
                        />
                      </Grid>
                    ) : null}
                    {hasDisplayValue(edit.description) ? (
                      <Grid item xs={12}>
                        <TextField
                          label="Full Description"
                          value={edit.description}
                          onChange={(event) => updateEdit(item.id, "description", event.target.value)}
                          fullWidth
                          multiline
                          minRows={4}
                        />
                      </Grid>
                    ) : null}
                  </Grid>
                ) : (
                  <p className="job-import-review__empty-details">No secondary metadata supplied.</p>
                )}

                {hasTags ? (
                  <Stack direction="row" gap={1} flexWrap="wrap" className="job-import-review__tags">
                    {roleTags.map((tag) => (
                      <Chip
                        key={`role-${tag}`}
                        label={tag}
                        size="small"
                        className="job-import-review__tag job-import-review__tag--role"
                      />
                    ))}
                    {industryTags.map((tag) => (
                      <Chip
                        key={`industry-${tag}`}
                        label={tag}
                        size="small"
                        className="job-import-review__tag job-import-review__tag--industry"
                      />
                    ))}
                  </Stack>
                ) : null}

                <Stack direction="row" gap={1} flexWrap="wrap" className="job-import-review__details-actions">
                  {sourceUrl ? (
                    <Button href={sourceUrl} target="_blank" rel="noreferrer" variant="outlined">
                      Open Source
                    </Button>
                  ) : null}
                  {applyUrl ? (
                    <Button href={applyUrl} target="_blank" rel="noreferrer" variant="outlined">
                      Open Apply URL
                    </Button>
                  ) : null}
                </Stack>
              </details>

              <Stack direction="row" gap={1} flexWrap="wrap" className="job-import-review__actions">
                <Button onClick={() => handleSave(item.id)} variant="outlined">
                  Save Edits
                </Button>
                <Button
                  onClick={() => handleApprove(item.id)}
                  variant="contained"
                  disabled={item.status === "published"}
                >
                  Approve / Publish
                </Button>
                <Button
                  onClick={() => handleReject(item.id)}
                  variant="outlined"
                  color="error"
                  disabled={item.status === "published"}
                >
                  Reject
                </Button>
              </Stack>
              </>
              )}
            </Paper>
          );
        })}
      </Stack>
    </Box>
  );
}

export default JobImportReview;
