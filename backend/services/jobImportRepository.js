const { one, query } = require("./db");

function toTextArray(values = []) {
  if (!Array.isArray(values)) return [];
  return values.map(String).filter(Boolean);
}

async function saveDiscoveredJobImport({ source, discoveryResult, normalizedJob, discoveredBy = null }) {
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
    normalizedJob.status || "needs_review",
    normalizedJob.duplicateKey,
    JSON.stringify(discoveryResult),
    JSON.stringify(normalizedJob),
    discoveredBy,
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
        discovered_by
      )
      values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13::text[], $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23::text[], $24::text[], $25, $26, $27::jsonb, $28::jsonb, $29
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

async function listJobImports({ status = "needs_review", limit = 50, offset = 0 } = {}) {
  const params = [];
  const where = [];
  if (status && status !== "all") {
    params.push(status);
    where.push(`status = $${params.length}`);
  }
  params.push(Math.min(100, Math.max(1, Number(limit) || 50)));
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
      duplicate_key: normalizedJob.duplicateKey,
      normalized_job: JSON.stringify(normalizedJob),
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

async function markJobImportPublished(id, jobId, reviewedBy) {
  return updateJobImport(id, {
    status: "published",
    reviewedBy,
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

module.exports = {
  getJobImport,
  listJobImports,
  markJobImportPublished,
  saveDiscoveredJobImport,
  saveDiscoveryRun,
  updateJobImport,
};
