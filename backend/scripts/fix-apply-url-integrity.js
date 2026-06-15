const path = require("node:path");

require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
require("dotenv").config();

const { pool, query } = require("../services/db");

const SOURCE_ORDER = [
  "National Vision",
  "EssilorLuxottica",
  "MyEyeDr",
  "Walmart",
  "Sam's",
  "VisionWorks",
  "EyeCare Partners",
  "Other",
];

function clean(value) {
  return String(value ?? "").trim();
}

function toUrl(value) {
  const text = clean(value);
  if (!text) return null;
  try {
    const url = new URL(text);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

function normalizedJob(row) {
  return row.normalized_job && typeof row.normalized_job === "object" ? row.normalized_job : {};
}

function discoveryResult(row) {
  return row.discovery_result && typeof row.discovery_result === "object" ? row.discovery_result : {};
}

function textBlob(row) {
  const normalized = normalizedJob(row);
  return [
    row.company,
    row.employer_name,
    row.parent_company,
    row.employer_brand,
    row.practice_name,
    row.source_url,
    row.external_apply_url,
    row.import_employer_name,
    row.import_discovered_by,
    row.import_source_url,
    row.import_apply_url,
    normalized.company,
    normalized.employerBrand,
    normalized.parentCompany,
    normalized.practiceName,
    normalized.sourceUrl,
    normalized.applyUrl,
  ]
    .map(clean)
    .join(" ")
    .toLowerCase();
}

function sourceCategory(row) {
  const text = textBlob(row);
  if (
    text.includes("nationalvision") ||
    text.includes("national vision") ||
    text.includes("america's best") ||
    text.includes("eyeglass world") ||
    text.includes("vista optical")
  ) {
    return "National Vision";
  }
  if (
    text.includes("essilorluxottica") ||
    text.includes("lenscrafters") ||
    text.includes("target optical") ||
    text.includes("pearle vision") ||
    text.includes("for eyes")
  ) {
    return "EssilorLuxottica";
  }
  if (text.includes("myeyedr") || text.includes("my eye dr")) return "MyEyeDr";
  if (text.includes("sam's") || text.includes("sams club") || text.includes("sam’s") || text.includes("sam club")) {
    return "Sam's";
  }
  if (text.includes("walmart") || text.includes("vision center")) return "Walmart";
  if (text.includes("visionworks")) return "VisionWorks";
  if (
    text.includes("eyecare partners") ||
    text.includes("clarkson") ||
    text.includes("eyecarecenter") ||
    text.includes("cincinnati eye institute") ||
    text.includes("nationwide vision") ||
    text.includes("associated retinal")
  ) {
    return "EyeCare Partners";
  }
  return "Other";
}

function isRawApiUrl(value) {
  const url = toUrl(value);
  if (!url) return false;
  const hostname = url.hostname.toLowerCase();
  const pathname = url.pathname.toLowerCase();
  return (
    hostname === "api.smartrecruiters.com" ||
    hostname.startsWith("api.") ||
    pathname.includes("/api/") ||
    pathname.includes("/v1/") ||
    pathname.endsWith(".json")
  );
}

function isCandidateFacingUrl(value) {
  const url = toUrl(value);
  if (!url) return false;
  return !isRawApiUrl(url.toString());
}

function parseSmartRecruitersApiUrl(value) {
  const url = toUrl(value);
  if (!url || url.hostname.toLowerCase() !== "api.smartrecruiters.com") return null;
  const parts = url.pathname.split("/").filter(Boolean);
  const companyIndex = parts.findIndex((part) => part.toLowerCase() === "companies");
  const postingsIndex = parts.findIndex((part) => part.toLowerCase() === "postings");
  if (companyIndex < 0 || postingsIndex < 0) return null;
  const company = parts[companyIndex + 1];
  const postingId = parts[postingsIndex + 1];
  if (!company || !postingId) return null;
  return { company, postingId };
}

function smartRecruitersPublicUrl(value) {
  const parsed = parseSmartRecruitersApiUrl(value);
  if (!parsed) return null;
  return `https://jobs.smartrecruiters.com/${encodeURIComponent(parsed.company)}/${encodeURIComponent(parsed.postingId)}`;
}

function firstUnique(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const text = clean(value);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
  }
  return result;
}

function candidateUrlFor(row) {
  const normalized = normalizedJob(row);
  const discovery = discoveryResult(row);
  const explicitCandidates = firstUnique([
    normalized.applyUrl,
    normalized.smartRecruiters?.applyUrl,
    normalized.smartRecruitersDetail?.applyUrl,
    normalized.smartRecruitersDetail?.postingUrl,
    discovery.applyUrl,
    discovery.smartRecruiters?.applyUrl,
    discovery.smartRecruitersDetail?.applyUrl,
    discovery.smartRecruitersDetail?.postingUrl,
    row.import_normalized_apply_url,
    row.import_apply_url,
    row.external_apply_url,
    normalized.sourceUrl,
    discovery.sourceUrl,
    row.import_normalized_source_url,
    row.import_source_url,
    row.source_url,
  ]);

  const employerOwned = explicitCandidates.find(
    (url) =>
      isCandidateFacingUrl(url) &&
      !toUrl(url).hostname.toLowerCase().includes("smartrecruiters.com")
  );
  if (employerOwned) return { url: employerOwned, source: "employer_owned_stored_url" };

  const publicAts = explicitCandidates.find((url) => {
    const parsed = toUrl(url);
    return (
      isCandidateFacingUrl(url) &&
      parsed.hostname.toLowerCase() === "jobs.smartrecruiters.com"
    );
  });
  if (publicAts) return { url: publicAts, source: "public_ats_stored_url" };

  for (const candidate of explicitCandidates) {
    const derived = smartRecruitersPublicUrl(candidate);
    if (derived) return { url: derived, source: "derived_smartrecruiters_public_url" };
  }

  return { url: null, source: "unresolved" };
}

async function loadActiveJobs() {
  const result = await query(`
    select
      j.id,
      j.title,
      j.company,
      j.employer_name,
      j.parent_company,
      j.employer_brand,
      j.practice_name,
      j.external_apply_url,
      j.source_url,
      j.listing_source,
      ji.id as import_id,
      ji.employer_name as import_employer_name,
      ji.discovered_by as import_discovered_by,
      ji.source_url as import_source_url,
      ji.apply_url as import_apply_url,
      ji.normalized_apply_url as import_normalized_apply_url,
      ji.normalized_source_url as import_normalized_source_url,
      ji.normalized_job,
      ji.discovery_result
    from public.jobs j
    left join public.job_imports ji on ji.published_job_id = j.id
    where j.status = 'active'
      and j.is_archived = false
    order by j.posted_at desc nulls last, j.created_at desc nulls last
  `);
  return result.rows || [];
}

async function updateJobAndImport(row, nextUrl) {
  await query(
    `
      update public.jobs
      set external_apply_url = $2,
          updated_at = now()
      where id = $1
    `,
    [row.id, nextUrl]
  );

  if (!row.import_id) return;

  const normalized = {
    ...normalizedJob(row),
    applyUrl: nextUrl,
  };
  const discovery = {
    ...discoveryResult(row),
    applyUrl: nextUrl,
  };

  await query(
    `
      update public.job_imports
      set apply_url = $2,
          normalized_apply_url = $2,
          normalized_job = $3::jsonb,
          discovery_result = $4::jsonb,
          updated_at = now()
      where id = $1
    `,
    [row.import_id, nextUrl, JSON.stringify(normalized), JSON.stringify(discovery)]
  );
}

function emptySourceCounts() {
  return Object.fromEntries(SOURCE_ORDER.map((source) => [source, 0]));
}

function increment(object, key, amount = 1) {
  object[key] = (object[key] || 0) + amount;
}

function sampleRows(rows) {
  return rows.slice(0, 10).map((row) => ({
    id: row.id,
    title: row.title,
    display: row.employer_brand || row.practice_name || row.company,
    source: sourceCategory(row),
    currentApplyUrl: row.external_apply_url,
    replacementUrl: row.replacement?.url || null,
    replacementSource: row.replacement?.source || null,
  }));
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const apply = args.has("--apply");
  const rows = await loadActiveJobs();
  const affected = [];
  const corrected = [];
  const unresolved = [];
  const affectedBySource = emptySourceCounts();
  const correctedBySource = emptySourceCounts();
  const unresolvedBySource = emptySourceCounts();
  const activeBySource = emptySourceCounts();

  for (const row of rows) {
    const source = sourceCategory(row);
    increment(activeBySource, source);
    if (!isRawApiUrl(row.external_apply_url)) continue;

    const replacement = candidateUrlFor(row);
    const nextRow = { ...row, replacement };
    affected.push(nextRow);
    increment(affectedBySource, source);

    if (replacement.url && replacement.url !== row.external_apply_url) {
      corrected.push(nextRow);
      increment(correctedBySource, source);
      if (apply) {
        await updateJobAndImport(row, replacement.url);
      }
    } else {
      unresolved.push(nextRow);
      increment(unresolvedBySource, source);
    }
  }

  const postRows = apply ? await loadActiveJobs() : rows;
  const remaining = postRows.filter((row) => isRawApiUrl(row.external_apply_url));
  const remainingBySource = emptySourceCounts();
  for (const row of remaining) increment(remainingBySource, sourceCategory(row));

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        totalActiveJobs: rows.length,
        activeBySource,
        affectedJobs: affected.length,
        affectedBySource,
        correctedJobs: apply ? corrected.length : 0,
        correctableJobs: corrected.length,
        correctedBySource: apply ? correctedBySource : emptySourceCounts(),
        correctableBySource: correctedBySource,
        unresolvedJobs: unresolved.length,
        unresolvedBySource,
        remainingRawApiApplyUrls: remaining.length,
        remainingBySource,
        samples: sampleRows(affected),
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => {});
  });
