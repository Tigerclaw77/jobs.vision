const { buildInsert, buildUpdate, one, query } = require("./db");

function sourcePayload(input = {}, userId = null) {
  return {
    employer_name: input.employerName,
    employer_website_url: input.employerWebsiteUrl,
    careers_url: input.careersUrl || null,
    industry_key: input.industryKey || null,
    source_type: input.sourceType || "unknown",
    enabled: input.enabled !== false,
    notes: input.notes || null,
    updated_by: userId,
  };
}

function toSourceInput(row = {}) {
  return {
    employerName: row.employer_name,
    employerWebsiteUrl: row.employer_website_url,
    careersUrl: row.careers_url || null,
    industryKey: row.industry_key || null,
    sourceType: row.source_type || "unknown",
  };
}

async function listDiscoverySources({ includeDisabled = true } = {}) {
  const result = await query(
    `
      select *
      from public.job_discovery_sources
      ${includeDisabled ? "" : "where enabled = true"}
      order by enabled desc, employer_name asc, created_at desc
    `
  );
  return result.rows || [];
}

async function getDiscoverySource(id) {
  return one("select * from public.job_discovery_sources where id = $1", [id]);
}

async function createDiscoverySource(input, userId = null) {
  const payload = {
    ...sourcePayload(input, userId),
    created_by: userId,
  };
  const insert = buildInsert("public.job_discovery_sources", payload);
  return one(insert.text, insert.params);
}

async function updateDiscoverySource(id, input, userId = null) {
  const updates = sourcePayload(input, userId);
  updates.updated_at = new Date().toISOString();
  const valueCount = Object.values(updates).filter((value) => value !== undefined).length;
  const update = buildUpdate(
    "public.job_discovery_sources",
    updates,
    `id = $${valueCount + 1}`,
    [id]
  );
  return one(update.text, update.params);
}

async function deleteDiscoverySource(id) {
  return one(
    "delete from public.job_discovery_sources where id = $1 returning *",
    [id]
  );
}

async function recordDiscoverySourceRun(id, { status, message = null, discoveredCount = 0 } = {}) {
  const update = buildUpdate(
    "public.job_discovery_sources",
    {
      last_run_at: new Date().toISOString(),
      last_run_status: status,
      last_run_message: message,
      last_discovered_count: discoveredCount,
      updated_at: new Date().toISOString(),
    },
    "id = $6",
    [id]
  );
  return one(update.text, update.params);
}

module.exports = {
  createDiscoverySource,
  deleteDiscoverySource,
  getDiscoverySource,
  listDiscoverySources,
  recordDiscoverySourceRun,
  toSourceInput,
  updateDiscoverySource,
};
