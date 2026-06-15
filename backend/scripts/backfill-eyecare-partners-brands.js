const path = require("node:path");

require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
require("dotenv").config();

const { pool, query } = require("../services/db");

const SOURCE = "script:eyecare-partners-full-acquisition";
const PARENT_COMPANY = "EyeCare Partners";

const PRACTICE_PATTERNS = [
  {
    brand: "Associated Retinal Consultants",
    patterns: [/\bassociated[-\s]+retinal[-\s]+consultants\b/i],
  },
  {
    brand: "Alabama Vision Centers",
    patterns: [/\balabama[-\s]+vision[-\s]+centers\b/i],
  },
  {
    brand: "Cavanaugh Eye Center",
    patterns: [/\bcavanaugh[-\s]+eye[-\s]+center\b/i],
  },
  {
    brand: "Cincinnati Eye Institute",
    patterns: [/\bcincinnati[-\s]+eye[-\s]+institute\b/i],
  },
  {
    brand: "Commonwealth Eye Care Associates",
    patterns: [/\bcommonwealth[-\s]+eye[-\s]+care[-\s]+associates\b/i],
  },
  {
    brand: "EyeCare Associates",
    patterns: [/\beyecare[-\s]+associates\b/i, /\beye[-\s]+care[-\s]+associates\b/i],
  },
  {
    brand: "Eyecarecenter",
    patterns: [/\beyecarecenters?\b/i, /\beyecare[-\s]+centers?\b/i],
  },
  {
    brand: "Virginia Eye Consultants",
    patterns: [/\bvirginia[-\s]+eye[-\s]+consultants\b/i],
  },
];

function clean(value) {
  return String(value ?? "").trim();
}

function displayName(row) {
  const normalized = row.normalized_job && typeof row.normalized_job === "object" ? row.normalized_job : {};
  return (
    clean(row.employer_brand) ||
    clean(row.practice_name) ||
    clean(row.normalized_company) ||
    clean(row.employer_name) ||
    clean(normalized.company) ||
    ""
  );
}

function countBy(rows, getter) {
  const counts = new Map();
  for (const row of rows) {
    const value = clean(getter(row)) || "(blank)";
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function haystackFor(row) {
  const normalized = row.normalized_job && typeof row.normalized_job === "object" ? row.normalized_job : {};
  const discovery = row.discovery_result && typeof row.discovery_result === "object" ? row.discovery_result : {};
  const customFields = [...(normalized.customFields || []), ...(discovery.customFields || [])];
  const practiceValues = customFields
    .filter((field) => /practice/i.test(clean(field.fieldLabel)))
    .map((field) => clean(field.valueLabel || field.value));

  return [
    row.source_url,
    row.normalized_source_url,
    row.apply_url,
    normalized.sourceUrl,
    normalized.applyUrl,
    row.raw_title,
    row.normalized_title,
    normalized.title,
    ...practiceValues,
    discovery.rawDescription,
    normalized.description,
  ]
    .map(clean)
    .filter(Boolean)
    .join("\n");
}

function brandFor(row) {
  const text = haystackFor(row);
  if (!text) return null;

  for (const { brand, patterns } of PRACTICE_PATTERNS) {
    if (patterns.some((pattern) => pattern.test(text))) return brand;
  }
  return null;
}

function withBrand(row, brand) {
  const normalized = row.normalized_job && typeof row.normalized_job === "object" ? { ...row.normalized_job } : {};
  return {
    ...normalized,
    company: brand,
    employerBrand: brand,
    practiceName: brand,
    parentCompany: PARENT_COMPANY,
  };
}

async function loadRows() {
  const result = await query(
    `
      select
        id,
        employer_brand,
        practice_name,
        parent_company,
        employer_name,
        normalized_company,
        raw_title,
        normalized_title,
        source_url,
        normalized_source_url,
        apply_url,
        normalized_job,
        discovery_result
      from public.job_imports
      where discovered_by = $1
      order by created_at asc
    `,
    [SOURCE]
  );
  return result.rows || [];
}

async function applyBrand(row, brand) {
  await query(
    `
      update public.job_imports
      set
        employer_brand = $2,
        practice_name = $2,
        parent_company = $3,
        normalized_company = $2,
        normalized_job = $4::jsonb,
        updated_at = now()
      where id = $1
    `,
    [row.id, brand, PARENT_COMPANY, JSON.stringify(withBrand(row, brand))]
  );
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const apply = args.has("--apply");
  const rows = await loadRows();
  const genericRows = rows.filter((row) => /^eyecare partners$/i.test(displayName(row)));
  const recoverable = [];

  for (const row of genericRows) {
    const brand = brandFor(row);
    if (brand) recoverable.push({ row, brand });
  }

  if (apply) {
    for (const { row, brand } of recoverable) {
      await applyBrand(row, brand);
    }
  }

  const afterRows = apply ? await loadRows() : rows;
  const displayCounts = countBy(afterRows, displayName);
  const genericAfter = afterRows.filter((row) => /^eyecare partners$/i.test(displayName(row))).length;
  const brandedAfter = afterRows.length - genericAfter;

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        totalImported: rows.length,
        genericBefore: genericRows.length,
        brandedBefore: rows.length - genericRows.length,
        recovered: recoverable.length,
        recoveredByBrand: countBy(recoverable, (item) => item.brand),
        brandedAfter,
        genericAfter,
        displayCounts: displayCounts.slice(0, 50),
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
