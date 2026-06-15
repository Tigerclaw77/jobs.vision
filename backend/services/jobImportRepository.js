const { one, query } = require("./db");
const { classifyJobForReview } = require("../../src/lib/job-discovery/classifier");
const { inferEmployerAttribution } = require("./employerAttribution");

function toTextArray(values = []) {
  if (!Array.isArray(values)) return [];
  return values.map(String).filter(Boolean);
}

const LISTING_OPPORTUNITY_TYPES = new Set(["job", "practice_sale", "partnership", "lease"]);
const LISTING_TIERS = new Set(["imported", "standard_paid", "featured", "sponsor"]);
const LOCATION_PRECISIONS = new Set([
  "exact",
  "facility",
  "city",
  "metro",
  "state",
  "remote",
  "multiple",
  "unknown",
]);
const AUTO_DECISIONS = new Set(["approve", "reject"]);
const EVERGREEN_AGE_DAYS = 180;

function enumOrDefault(value, allowed, fallback) {
  const normalized = String(value || "").trim().toLowerCase();
  return allowed.has(normalized) ? normalized : fallback;
}

function autoDecisionForClassification(classification = {}, normalizedJob = {}) {
  const recommendation = String(classification.recommendation || "").toLowerCase();
  const confidence = Number(classification.confidenceScore);
  const roleBadge = String(classification.roleBadge || "").toUpperCase();
  const hasApplyUrl = Boolean(normalizedJob.applyUrl);
  const safeApproveRole = roleBadge && !["UNKNOWN", "OTHER", "OMD"].includes(roleBadge);
  const safeRejectRole = roleBadge && roleBadge !== "UNKNOWN";

  if (!AUTO_DECISIONS.has(recommendation) || !Number.isFinite(confidence) || confidence < 95) {
    return { applied: false, decision: null };
  }
  if (recommendation === "approve" && (!safeApproveRole || !hasApplyUrl)) {
    return { applied: false, decision: null };
  }
  if (recommendation === "reject" && !safeRejectRole) {
    return { applied: false, decision: null };
  }

  return { applied: true, decision: recommendation };
}

function numberOrNull(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function boolOrNull(value) {
  return typeof value === "boolean" ? value : null;
}

function dateOrNull(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function intOrNull(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) ? numeric : null;
}

function evergreenPolicyFromJob(normalizedJob = {}) {
  const ageDays = intOrNull(normalizedJob.sourcePostingAgeDays);
  const explicitEvergreen = normalizedJob.evergreen === true;
  const explicitReason = String(normalizedJob.evergreenReason || "").trim();
  const ageTriggered = Number.isInteger(ageDays) && ageDays > EVERGREEN_AGE_DAYS;

  if (explicitEvergreen || ageTriggered) {
    return {
      evergreen: true,
      evergreenReason:
        explicitReason ||
        (ageTriggered
          ? `Source posting age is ${ageDays} days, exceeding the ${EVERGREEN_AGE_DAYS}-day evergreen threshold.`
          : "Source or employer-specific evergreen policy marked this import as evergreen."),
    };
  }

  return {
    evergreen: false,
    evergreenReason: explicitReason || null,
  };
}

function classificationFromJob(normalizedJob = {}) {
  const summary = normalizedJob.classificationSummary || {};
  return {
    primaryRole: normalizedJob.primaryRole || summary.primaryRole || null,
    secondaryRole: normalizedJob.secondaryRole || summary.secondaryRole || null,
    specialty: normalizedJob.specialty || summary.specialty || null,
    employmentType: summary.employmentType || normalizedJob.employmentType || null,
    practiceType: normalizedJob.practiceType || summary.practiceType || null,
    compensationSummary:
      normalizedJob.compensationSummary || summary.compensationSummary || normalizedJob.compensation || null,
    jobsVisionRelevant: boolOrNull(
      normalizedJob.jobsVisionRelevant ?? summary.jobsVisionRelevant
    ),
    recommendation: normalizedJob.recommendation || summary.recommendation || null,
    recommendationReason:
      normalizedJob.recommendationReason || summary.recommendationReason || null,
    confidenceScore: numberOrNull(
      normalizedJob.classificationConfidenceScore ?? summary.confidenceScore
    ),
    roleBadge: normalizedJob.roleBadge || summary.roleBadge || null,
  };
}

function normalizedJobFromImportRow(row = {}) {
  const normalized =
    row.normalized_job && typeof row.normalized_job === "object"
      ? row.normalized_job
      : {};

  return {
    title: normalized.title || row.normalized_title || row.raw_title || "",
    rawTitle: row.raw_title || normalized.rawTitle || "",
    company: normalized.company || row.normalized_company || row.employer_name || "",
    parentCompany: normalized.parentCompany || normalized.parent_company || null,
    employerBrand: normalized.employerBrand || normalized.employer_brand || null,
    practiceName: normalized.practiceName || normalized.practice_name || null,
    location: normalized.location || row.normalized_location || row.raw_location || "",
    rawLocation: row.raw_location || normalized.rawLocation || "",
    employmentType: normalized.employmentType || row.normalized_employment_type || null,
    compensation: normalized.compensation || row.normalized_compensation || null,
    description: normalized.description || row.normalized_description || row.raw_description || "",
    rawDescription: row.raw_description || normalized.rawDescription || "",
    applyUrl: normalized.applyUrl || row.normalized_apply_url || row.apply_url || null,
    sourceUrl: normalized.sourceUrl || row.normalized_source_url || row.source_url || null,
    sourceType: normalized.sourceType || row.normalized_source_type || row.source_type || "unknown",
    industryTags: Array.isArray(normalized.industryTags) ? normalized.industryTags : row.industry_tags || [],
    roleTags: Array.isArray(normalized.roleTags) ? normalized.roleTags : row.role_tags || [],
    evergreen: normalized.evergreen ?? row.evergreen ?? false,
    evergreenReason: normalized.evergreenReason || row.evergreen_reason || null,
    sourcePostedAt: normalized.sourcePostedAt || row.source_posted_at || null,
    sourceUpdatedAt: normalized.sourceUpdatedAt || row.source_updated_at || null,
    sourcePostingAgeDays: normalized.sourcePostingAgeDays ?? row.source_posting_age_days ?? null,
    freshnessCheckedAt: normalized.freshnessCheckedAt || row.freshness_checked_at || null,
    listingSource: normalized.listingSource || row.listing_source || "imported",
    listingTier: normalized.listingTier || row.listing_tier || "imported",
    listingOpportunityType: normalized.listingOpportunityType || row.listing_opportunity_type || "job",
    locationPrecision: normalized.locationPrecision || row.location_precision || (row.normalized_location ? "city" : "unknown"),
    status: normalized.status || row.status || "needs_review",
    duplicateKey: normalized.duplicateKey || row.duplicate_key,
  };
}

async function saveDiscoveredJobImport({ source, discoveryResult, normalizedJob, discoveredBy = null }) {
  const listingOpportunityType = enumOrDefault(
    normalizedJob.listingOpportunityType,
    LISTING_OPPORTUNITY_TYPES,
    "job"
  );
  const listingTier = enumOrDefault(normalizedJob.listingTier, LISTING_TIERS, "imported");
  const locationPrecision = enumOrDefault(
    normalizedJob.locationPrecision,
    LOCATION_PRECISIONS,
    normalizedJob.location ? "city" : "unknown"
  );
  const normalizedWithListing = {
    ...normalizedJob,
    listingSource: "imported",
    listingTier,
    listingOpportunityType,
    locationPrecision,
  };
  const attribution = inferEmployerAttribution({
    parentCompany: normalizedWithListing.parentCompany,
    employerBrand: normalizedWithListing.employerBrand,
    practiceName: normalizedWithListing.practiceName,
    employerName: source.employerName,
    company: normalizedWithListing.company,
    title: normalizedWithListing.title,
    rawTitle: discoveryResult.rawTitle,
    description: normalizedWithListing.description,
    sourceUrl: normalizedWithListing.sourceUrl,
    applyUrl: normalizedWithListing.applyUrl,
    customFields:
      normalizedWithListing.customFields ||
      discoveryResult.customFields ||
      discoveryResult.smartRecruiters?.customFields,
    smartRecruiters: normalizedWithListing.smartRecruiters || discoveryResult.smartRecruiters,
    smartRecruitersDetail:
      normalizedWithListing.smartRecruitersDetail || discoveryResult.smartRecruitersDetail,
  });
  normalizedWithListing.parentCompany = attribution.parentCompany;
  normalizedWithListing.employerBrand = attribution.employerBrand;
  normalizedWithListing.practiceName = attribution.practiceName;
  const evergreenPolicy = evergreenPolicyFromJob(normalizedWithListing);
  const status = evergreenPolicy.evergreen ? "evergreen" : normalizedWithListing.status || "needs_review";
  const classification = classificationFromJob(normalizedWithListing);
  const autoDecision = autoDecisionForClassification(classification, normalizedWithListing);
  const params = [
    source.employerName,
    source.employerWebsiteUrl,
    source.careersUrl || null,
    source.industryKey || null,
    source.sourceType,
    discoveryResult.sourceUrl,
    discoveryResult.discoveredAt,
    discoveryResult.rawTitle,
    discoveryResult.rawLocation || null,
    discoveryResult.rawDescription || null,
    discoveryResult.applyUrl || null,
    discoveryResult.confidenceScore,
    discoveryResult.extractionNotes || [],
    normalizedJob.title,
    normalizedJob.company,
    normalizedJob.location || null,
    normalizedJob.employmentType || null,
    normalizedJob.compensation || null,
    normalizedJob.description || null,
    normalizedJob.applyUrl || null,
    normalizedJob.sourceUrl,
    normalizedJob.sourceType,
    toTextArray(normalizedJob.industryTags),
    toTextArray(normalizedJob.roleTags),
    status,
    normalizedWithListing.duplicateKey,
    JSON.stringify(discoveryResult),
    JSON.stringify(normalizedWithListing),
    discoveredBy,
    attribution.parentCompany,
    attribution.employerBrand,
    attribution.practiceName,
    "imported",
    listingTier,
    listingOpportunityType,
    locationPrecision,
    classification.primaryRole,
    classification.secondaryRole,
    classification.employmentType,
    classification.practiceType,
    classification.compensationSummary,
    classification.jobsVisionRelevant,
    classification.recommendation,
    classification.recommendationReason,
    classification.confidenceScore,
    classification.roleBadge,
    classification.specialty,
    autoDecision.applied,
    autoDecision.decision,
    autoDecision.applied ? new Date().toISOString() : null,
    evergreenPolicy.evergreen,
    evergreenPolicy.evergreenReason,
    dateOrNull(normalizedWithListing.sourcePostedAt),
    dateOrNull(normalizedWithListing.sourceUpdatedAt),
    intOrNull(normalizedWithListing.sourcePostingAgeDays),
    dateOrNull(normalizedWithListing.freshnessCheckedAt) || new Date().toISOString(),
  ];

  return one(
    `
      insert into public.job_imports (
        employer_name,
        employer_website_url,
        careers_url,
        industry_key,
        source_type,
        source_url,
        discovered_at,
        raw_title,
        raw_location,
        raw_description,
        apply_url,
        confidence_score,
        extraction_notes,
        normalized_title,
        normalized_company,
        normalized_location,
        normalized_employment_type,
        normalized_compensation,
        normalized_description,
        normalized_apply_url,
        normalized_source_url,
        normalized_source_type,
        industry_tags,
        role_tags,
        status,
        duplicate_key,
        discovery_result,
        normalized_job,
        discovered_by,
        parent_company,
        employer_brand,
        practice_name,
        listing_source,
        listing_tier,
        listing_opportunity_type,
        location_precision,
        primary_role,
        secondary_role,
        classification_employment_type,
        classification_practice_type,
        compensation_summary,
        jobs_vision_relevant,
        recommendation,
        recommendation_reason,
        classification_confidence_score,
        role_badge,
        specialty,
        auto_decision_applied,
        auto_decision,
        auto_decision_at,
        evergreen,
        evergreen_reason,
        source_posted_at,
        source_updated_at,
        source_posting_age_days,
        freshness_checked_at
      )
      values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13::text[], $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23::text[], $24::text[], $25, $26, $27::jsonb, $28::jsonb, $29,
        $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44,
        $45, $46, $47, $48, $49, $50, $51, $52, $53, $54, $55, $56
      )
      on conflict (duplicate_key) do update set
        source_url = excluded.source_url,
        discovered_at = excluded.discovered_at,
        raw_title = excluded.raw_title,
        raw_location = excluded.raw_location,
        raw_description = excluded.raw_description,
        apply_url = excluded.apply_url,
        confidence_score = excluded.confidence_score,
        extraction_notes = excluded.extraction_notes,
        normalized_title = excluded.normalized_title,
        normalized_company = excluded.normalized_company,
        normalized_location = excluded.normalized_location,
        normalized_employment_type = excluded.normalized_employment_type,
        normalized_compensation = excluded.normalized_compensation,
        normalized_description = excluded.normalized_description,
        normalized_apply_url = excluded.normalized_apply_url,
        normalized_source_url = excluded.normalized_source_url,
        normalized_source_type = excluded.normalized_source_type,
        industry_tags = excluded.industry_tags,
        role_tags = excluded.role_tags,
        discovery_result = excluded.discovery_result,
        normalized_job = excluded.normalized_job,
        discovered_by = coalesce(excluded.discovered_by, public.job_imports.discovered_by),
        parent_company = excluded.parent_company,
        employer_brand = excluded.employer_brand,
        practice_name = excluded.practice_name,
        listing_source = excluded.listing_source,
        listing_tier = excluded.listing_tier,
        listing_opportunity_type = excluded.listing_opportunity_type,
        location_precision = excluded.location_precision,
        primary_role = excluded.primary_role,
        secondary_role = excluded.secondary_role,
        classification_employment_type = excluded.classification_employment_type,
        classification_practice_type = excluded.classification_practice_type,
        compensation_summary = excluded.compensation_summary,
        jobs_vision_relevant = excluded.jobs_vision_relevant,
        recommendation = excluded.recommendation,
        recommendation_reason = excluded.recommendation_reason,
        classification_confidence_score = excluded.classification_confidence_score,
        role_badge = excluded.role_badge,
        specialty = excluded.specialty,
        auto_decision_applied = excluded.auto_decision_applied,
        auto_decision = excluded.auto_decision,
        auto_decision_at = excluded.auto_decision_at,
        evergreen = excluded.evergreen,
        evergreen_reason = excluded.evergreen_reason,
        source_posted_at = excluded.source_posted_at,
        source_updated_at = excluded.source_updated_at,
        source_posting_age_days = excluded.source_posting_age_days,
        freshness_checked_at = excluded.freshness_checked_at,
        status = case
          when public.job_imports.status in ('published', 'rejected') then public.job_imports.status
          else excluded.status
        end,
        updated_at = now()
      returning *
    `,
    params
  );
}

async function saveDiscoveryRun(discoveryRun, options = {}) {
  const saved = [];
  for (const item of discoveryRun.jobs || []) {
    saved.push(
      await saveDiscoveredJobImport({
        source: discoveryRun.source,
        discoveryResult: item.discoveryResult,
        normalizedJob: item.normalizedJob,
        discoveredBy: options.discoveredBy || null,
      })
    );
  }
  return saved;
}

async function listJobImports({
  status = "needs_review",
  limit = 50,
  offset = 0,
  listingTier = "all",
  listingOpportunityType = "all",
} = {}) {
  const params = [];
  const where = [];
  if (status && status !== "all") {
    params.push(status);
    where.push(`status = $${params.length}`);
  }
  if (listingTier && listingTier !== "all") {
    params.push(listingTier);
    where.push(`listing_tier = $${params.length}`);
  }
  if (listingOpportunityType && listingOpportunityType !== "all") {
    params.push(listingOpportunityType);
    where.push(`listing_opportunity_type = $${params.length}`);
  }
  params.push(Math.min(500, Math.max(1, Number(limit) || 50)));
  const limitParam = params.length;
  params.push(Math.max(0, Number(offset) || 0));
  const offsetParam = params.length;

  const result = await query(
    `
      select *
      from public.job_imports
      ${where.length ? `where ${where.join(" and ")}` : ""}
      order by discovered_at desc, created_at desc
      limit $${limitParam}
      offset $${offsetParam}
    `,
    params
  );
  return result.rows || [];
}

async function getJobImport(id) {
  return one("select * from public.job_imports where id = $1", [id]);
}

async function updateJobImport(id, updates = {}) {
  const normalizedJob = updates.normalizedJob || null;
  const fields = [];
  const params = [];

  if (normalizedJob) {
    const attribution = inferEmployerAttribution({
      parentCompany: normalizedJob.parentCompany,
      employerBrand: normalizedJob.employerBrand,
      practiceName: normalizedJob.practiceName,
      employerName: normalizedJob.company,
      company: normalizedJob.company,
      title: normalizedJob.title,
      rawTitle: normalizedJob.rawTitle,
      description: normalizedJob.description,
      sourceUrl: normalizedJob.sourceUrl,
      applyUrl: normalizedJob.applyUrl,
      customFields: normalizedJob.customFields || normalizedJob.smartRecruiters?.customFields,
      smartRecruiters: normalizedJob.smartRecruiters,
      smartRecruitersDetail: normalizedJob.smartRecruitersDetail,
    });
    normalizedJob.parentCompany = attribution.parentCompany;
    normalizedJob.employerBrand = attribution.employerBrand;
    normalizedJob.practiceName = attribution.practiceName;
    const classification = classificationFromJob(normalizedJob);
    const autoDecision = autoDecisionForClassification(classification, normalizedJob);
    const mapping = {
      normalized_title: normalizedJob.title,
      normalized_company: normalizedJob.company,
      normalized_location: normalizedJob.location,
      normalized_employment_type: normalizedJob.employmentType,
      normalized_compensation: normalizedJob.compensation,
      normalized_description: normalizedJob.description,
      normalized_apply_url: normalizedJob.applyUrl,
      normalized_source_url: normalizedJob.sourceUrl,
      normalized_source_type: normalizedJob.sourceType,
      industry_tags: normalizedJob.industryTags || [],
      role_tags: normalizedJob.roleTags || [],
      parent_company: normalizedJob.parentCompany || null,
      employer_brand: normalizedJob.employerBrand || null,
      practice_name: normalizedJob.practiceName || null,
      duplicate_key: normalizedJob.duplicateKey,
      normalized_job: JSON.stringify(normalizedJob),
      evergreen: normalizedJob.evergreen === true,
      evergreen_reason: normalizedJob.evergreenReason || null,
      source_posted_at: dateOrNull(normalizedJob.sourcePostedAt),
      source_updated_at: dateOrNull(normalizedJob.sourceUpdatedAt),
      source_posting_age_days: intOrNull(normalizedJob.sourcePostingAgeDays),
      freshness_checked_at: dateOrNull(normalizedJob.freshnessCheckedAt) || null,
      listing_source: normalizedJob.listingSource || "imported",
      listing_tier: enumOrDefault(normalizedJob.listingTier, LISTING_TIERS, "imported"),
      listing_opportunity_type: enumOrDefault(
        normalizedJob.listingOpportunityType,
        LISTING_OPPORTUNITY_TYPES,
        "job"
      ),
      location_precision: enumOrDefault(
        normalizedJob.locationPrecision,
        LOCATION_PRECISIONS,
        normalizedJob.location ? "city" : "unknown"
      ),
      primary_role: classification.primaryRole,
      secondary_role: classification.secondaryRole,
      specialty: classification.specialty,
      classification_employment_type: classification.employmentType,
      classification_practice_type: classification.practiceType,
      compensation_summary: classification.compensationSummary,
      jobs_vision_relevant: classification.jobsVisionRelevant,
      recommendation: classification.recommendation,
      recommendation_reason: classification.recommendationReason,
      classification_confidence_score: classification.confidenceScore,
      role_badge: classification.roleBadge,
      auto_decision_applied: autoDecision.applied,
      auto_decision: autoDecision.decision,
      auto_decision_at: autoDecision.applied ? new Date().toISOString() : null,
    };

    for (const [column, value] of Object.entries(mapping)) {
      params.push(value);
      const cast = column === "normalized_job" ? "::jsonb" : Array.isArray(value) ? "::text[]" : "";
      fields.push(`${column} = $${params.length}${cast}`);
    }
  }

  if (updates.status) {
    params.push(updates.status);
    fields.push(`status = $${params.length}`);
  }

  if (updates.rejectionReason !== undefined) {
    params.push(updates.rejectionReason || null);
    fields.push(`rejection_reason = $${params.length}`);
  }

  if (updates.reviewedBy !== undefined) {
    params.push(updates.reviewedBy || null);
    fields.push(`reviewed_by = $${params.length}`);
    fields.push("reviewed_at = now()");
  }

  if (updates.reviewAction !== undefined) {
    params.push(updates.reviewAction || null);
    fields.push(`review_action = $${params.length}`);
  }

  if (updates.reviewSource !== undefined) {
    params.push(updates.reviewSource || null);
    fields.push(`review_source = $${params.length}`);
  }

  if (!fields.length) return getJobImport(id);
  params.push(id);

  return one(
    `
      update public.job_imports
      set ${fields.join(", ")}, updated_at = now()
      where id = $${params.length}
      returning *
    `,
    params
  );
}

async function markJobImportPublished(id, jobId, reviewedBy, options = {}) {
  return updateJobImport(id, {
    status: "published",
    reviewedBy,
    reviewAction: options.reviewAction || "publish",
    reviewSource: options.reviewSource || "manual",
    normalizedJob: null,
  }).then(() =>
    one(
      `
        update public.job_imports
        set published_job_id = $1, updated_at = now()
        where id = $2
        returning *
      `,
      [jobId, id]
    )
  );
}

async function jobImportClassificationBackfillStatus() {
  const [remaining, recommendations, roles] = await Promise.all([
    one(`
      select
        count(*)::int as total_imports,
        count(*) filter (where recommendation is null or primary_role is null)::int as rows_remaining,
        count(*) filter (where recommendation is null)::int as recommendation_null,
        count(*) filter (where primary_role is null)::int as primary_role_null,
        count(*) filter (where classification_confidence_score is null)::int as classification_confidence_score_null
      from public.job_imports
    `),
    query(`
      select coalesce(recommendation, 'null') as recommendation, count(*)::int as count
      from public.job_imports
      group by 1
      order by 1
    `),
    query(`
      select coalesce(role_badge, 'null') as role_badge, count(*)::int as count
      from public.job_imports
      group by 1
      order by 1
    `),
  ]);

  return {
    totalImports: Number(remaining?.total_imports || 0),
    rowsRemaining: Number(remaining?.rows_remaining || 0),
    recommendationNull: Number(remaining?.recommendation_null || 0),
    primaryRoleNull: Number(remaining?.primary_role_null || 0),
    classificationConfidenceScoreNull: Number(remaining?.classification_confidence_score_null || 0),
    recommendations: recommendations.rows || [],
    roles: roles.rows || [],
  };
}

async function backfillJobImportClassifications({ force = false, limit = 1000 } = {}) {
  const before = await jobImportClassificationBackfillStatus();
  const params = [];
  const where = [];

  if (!force) {
    where.push("(recommendation is null or primary_role is null)");
  }

  params.push(Math.min(5000, Math.max(1, Number(limit) || 1000)));
  const limitParam = params.length;

  const result = await query(
    `
      select *
      from public.job_imports
      ${where.length ? `where ${where.join(" and ")}` : ""}
      order by discovered_at desc, created_at desc
      limit $${limitParam}
    `,
    params
  );

  const rows = result.rows || [];
  const failures = [];
  let classified = 0;

  for (const row of rows) {
    try {
      const normalizedJob = normalizedJobFromImportRow(row);
      const classification = classifyJobForReview(normalizedJob);
      const autoDecision = autoDecisionForClassification(classification, normalizedJob);
      const values = [
        classification.primaryRole,
        classification.secondaryRole,
        classification.specialty,
        classification.employmentType,
        classification.practiceType,
        classification.compensationSummary,
        classification.jobsVisionRelevant,
        classification.recommendation,
        classification.recommendationReason,
        classification.confidenceScore,
        classification.roleBadge,
        autoDecision.applied,
        autoDecision.decision,
        autoDecision.applied ? new Date().toISOString() : null,
        row.id,
      ];

      await query(
        `
          update public.job_imports
          set
            primary_role = ${force ? "$1" : "coalesce(primary_role, $1)"},
            secondary_role = ${force ? "$2" : "coalesce(secondary_role, $2)"},
            specialty = ${force ? "$3" : "coalesce(specialty, $3)"},
            classification_employment_type = ${force ? "$4" : "coalesce(classification_employment_type, $4)"},
            classification_practice_type = ${force ? "$5" : "coalesce(classification_practice_type, $5)"},
            compensation_summary = ${force ? "$6" : "coalesce(compensation_summary, $6)"},
            jobs_vision_relevant = ${force ? "$7" : "coalesce(jobs_vision_relevant, $7)"},
            recommendation = ${force ? "$8" : "coalesce(recommendation, $8)"},
            recommendation_reason = ${force ? "$9" : "coalesce(recommendation_reason, $9)"},
            classification_confidence_score = ${force ? "$10" : "coalesce(classification_confidence_score, $10)"},
            role_badge = ${force ? "$11" : "coalesce(role_badge, $11)"},
            auto_decision_applied = ${force ? "$12" : "case when auto_decision_applied = false then $12 else auto_decision_applied end"},
            auto_decision = ${force ? "$13" : "coalesce(auto_decision, $13)"},
            auto_decision_at = ${force ? "$14" : "coalesce(auto_decision_at, $14)"},
            updated_at = now()
          where id = $15
        `,
        values
      );
      classified += 1;
    } catch (error) {
      failures.push({
        id: row.id,
        title: row.normalized_title || row.raw_title || null,
        error: error?.message || "Classification backfill failed.",
      });
    }
  }

  const after = await jobImportClassificationBackfillStatus();

  return {
    force,
    totalScanned: rows.length,
    totalClassified: classified,
    totalSkipped: Math.max(0, before.totalImports - rows.length),
    totalFailures: failures.length,
    rowsRemaining: after.rowsRemaining,
    failures,
    before,
    after,
  };
}

module.exports = {
  backfillJobImportClassifications,
  getJobImport,
  jobImportClassificationBackfillStatus,
  listJobImports,
  markJobImportPublished,
  saveDiscoveredJobImport,
  saveDiscoveryRun,
  updateJobImport,
};
