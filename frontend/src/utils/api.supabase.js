// src/utils/api.supabase.js
import { getNeonSession } from "./neonAuthClient";
import { expandBrandFilterValues, normalizeMultiValue, normalizeRole } from "./jobTaxonomy";

function apiBaseUrl() {
  const raw = (process.env.REACT_APP_API_URL || "http://localhost:5000/api").replace(/\/+$/, "");
  return raw.endsWith("/api") ? raw : `${raw}/api`;
}

async function authHeaders() {
  const { session } = await getNeonSession();
  const token = session?.access_token;
  if (!token) throw new Error("Not signed in.");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function apiJson(path, options = {}) {
  const headers = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.headers || {}),
  };
  const res = await fetch(`${apiBaseUrl()}${path}`, { ...options, headers });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || "Request failed");
  return data;
}

function friendlyJobUpdateError(error) {
  const message = String(error?.message || "").trim();
  if (!message || /server error|request failed/i.test(message)) {
    return "We couldn't update this job. Please try again.";
  }
  return message;
}

const cleanText = (value = "") => String(value || "").replace(/\s+/g, " ").trim();

function isLensCraftersAtMacys(row = {}) {
  const brand = cleanText(row.employer_brand || row.venue_brand);
  if (!/^lenscrafters$/i.test(brand)) return false;

  const venueText = [
    row.venue_brand,
    row.venue_name,
    row.practice_name,
    row.company,
    row.title,
    row.description,
  ]
    .map(cleanText)
    .filter(Boolean)
    .join(" ");

  return /\bmacy'?s\b/i.test(venueText);
}

function displayCompanyName(row = {}) {
  if (isLensCraftersAtMacys(row)) return "LensCrafters at Macy's";

  return (
    row.employer_brand ||
    row.practice_name ||
    row.venue_brand ||
    row.company ||
    row.employer_name ||
    row.venue_name ||
    ""
  );
}

function mapJobRow(row = {}) {
  const rawTags = row.tag_ids || row.tags;
  const tagsRaw = Array.isArray(rawTags)
    ? rawTags
    : typeof rawTags === "string"
    ? rawTags.split(",").map((t) => t.trim())
    : [];

  return {
    _id: String(row.id ?? row._id ?? row.uuid ?? crypto.randomUUID()),
    id: String(row.id ?? row._id ?? row.uuid ?? ""),
    title: row.title || "",
    company: displayCompanyName(row),
    employer_name: row.employer_name || row.company || "",
    employer_brand: row.employer_brand || row.venue_brand || "",
    practice_name: row.practice_name || row.venue_name || "",
    parent_company: row.parent_company || row.employer_name || row.company || "",
    venue_brand: row.venue_brand || "",
    venue_name: row.venue_name || "",
    location: row.location || [row.city, row.state].filter(Boolean).join(", "),
    city: row.city || "",
    state: row.state || "",
    role: normalizeRole(row.role) || (row.role || "").toLowerCase(),
    hours: (row.hours || "").toString().toLowerCase(),
    type: (row.type || "").toString().toLowerCase(),
    opportunity_type: row.opportunity_type || "",
    opportunity_types: normalizeMultiValue(row.opportunity_types || row.opportunity_type),
    practice_type: row.practice_type || "",
    employment_type: row.employment_type || "",
    employment_types: normalizeMultiValue(row.employment_types || row.employment_type || row.type),
    work_arrangement: row.work_arrangement || "",
    work_arrangements: normalizeMultiValue(row.work_arrangements || row.work_arrangement),
    saturday_schedule: row.saturday_schedule || "",
    sign_on_bonus: row.sign_on_bonus || row.signOnBonus || "",
    relocation_assistance: row.relocation_assistance === true || row.relocationAssistance === true,
    benefits: row.benefits || "",
    ce_allowance: row.ce_allowance || row.ceAllowance || "",
    student_loan_assistance:
      row.student_loan_assistance === true || row.studentLoanAssistance === true,
    compensation_type: row.compensation_type || "",
    salary_min: row.salary_min,
    salary_max: row.salary_max,
    hourly_min: row.hourly_min,
    hourly_max: row.hourly_max,
    daily_rate: row.daily_rate,
    compensation_notes: row.compensation_notes || "",
    featured: row.featured === true,
    source: row.source || "",
    seed_batch: row.seed_batch || "",
    listing_source: row.listing_source || "",
    listing_tier: row.listing_tier || "",
    listing_opportunity_type: row.listing_opportunity_type || "job",
    location_precision: row.location_precision || "unknown",
    claimed_by_user_id: row.claimed_by_user_id || null,
    claimed_at: row.claimed_at || null,
    claim_status: row.claim_status || "unclaimed",
    external_apply_url: row.external_apply_url || row.apply_url || "",
    apply_url: row.external_apply_url || row.apply_url || "",
    applyUrl: row.external_apply_url || row.apply_url || "",
    application_email: row.application_email || row.applicationEmail || "",
    applicationEmail: row.application_email || row.applicationEmail || "",
    source_url: row.source_url || "",
    sourceUrl: row.source_url || "",
    salary: row.salary,
    tags: tagsRaw.map((t) => String(t).toLowerCase()),
    latitude: row.latitude != null ? Number(row.latitude) : undefined,
    longitude: row.longitude != null ? Number(row.longitude) : undefined,
    description: row.description || "",
    createdAt: row.posted_at || row.created_at || row.createdAt || null,
    updated_at: row.updated_at || null,
    ranking_score: row.ranking_score != null ? Number(row.ranking_score) : null,
    ranking_components: {
      relevance: row.relevance_score != null ? Number(row.relevance_score) : null,
      distance: row.distance_score != null ? Number(row.distance_score) : null,
      freshness: row.freshness_score != null ? Number(row.freshness_score) : null,
      promotion: row.promotion_score != null ? Number(row.promotion_score) : null,
    },
    status: row.status || "active",
  };
}

function appendArrayParam(params, key, values = []) {
  const list = Array.isArray(values)
    ? values
    : typeof values === "string"
    ? values.split(",")
    : [];
  const cleaned = list.map((value) => String(value || "").trim()).filter(Boolean);
  if (cleaned.length) params.set(key, cleaned.join(","));
}

export async function fetchJobsPage({
  limit = 100,
  offset = 0,
  sort = "best_match",
  includeBrand = [],
  excludeBrand = [],
} = {}) {
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 100));
  const safeOffset = Math.max(0, Number(offset) || 0);
  const params = new URLSearchParams({
    limit: String(safeLimit),
    offset: String(safeOffset),
    sort,
  });
  appendArrayParam(params, "includeBrand", expandBrandFilterValues(includeBrand));
  appendArrayParam(params, "excludeBrand", expandBrandFilterValues(excludeBrand));
  const data = await apiJson(`/jobs?${params.toString()}`);
  const legacyArrayResponse = Array.isArray(data);
  const rows = legacyArrayResponse ? data : data?.items || [];

  return {
    jobs: rows.map(mapJobRow),
    total: legacyArrayResponse ? null : Number(data?.total ?? rows.length),
    limit: Number(data?.limit ?? safeLimit),
    offset: Number(data?.offset ?? safeOffset),
  };
}

export async function fetchJobs({
  limit = 100,
  sort = "best_match",
  includeBrand = [],
  excludeBrand = [],
} = {}) {
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 100));
  const jobs = [];
  let offset = 0;
  let total = null;

  for (let page = 0; page < 100; page += 1) {
    const result = await fetchJobsPage({
      limit: safeLimit,
      offset,
      sort,
      includeBrand,
      excludeBrand,
    });
    jobs.push(...result.jobs);
    total = Number.isFinite(result.total) ? result.total : jobs.length;

    const hasKnownTotal = Number.isFinite(result.total);
    if (!result.jobs.length) break;
    if (hasKnownTotal && jobs.length >= total) break;
    if (!hasKnownTotal && result.jobs.length < safeLimit) break;
    offset += result.jobs.length;
  }

  return jobs;
}

export async function fetchPublicJob(jobId) {
  const data = await apiJson(`/jobs/public/${encodeURIComponent(jobId)}`);
  return mapJobRow(data);
}

export async function claimJobListing(jobId, claim = {}) {
  const headers = await authHeaders();
  return apiJson(`/jobs/${encodeURIComponent(jobId)}/claim`, {
    method: "POST",
    headers,
    body: JSON.stringify(claim),
  });
}

export async function fetchFavoriteJobs() {
  const headers = await authHeaders();
  return apiJson("/favorites", { headers });
}

export async function removeJobFromFavorites(jobId) {
  const headers = await authHeaders();
  await apiJson(`/favorites/${encodeURIComponent(jobId)}`, {
    method: "DELETE",
    headers,
  });
  return { removed: true };
}

export async function fetchHiddenJobs() {
  const headers = await authHeaders();
  return apiJson("/users/hidden", { headers });
}

export async function hideJob(jobId) {
  const headers = await authHeaders();
  try {
    await apiJson(`/users/hide/${encodeURIComponent(jobId)}`, {
      method: "POST",
      headers,
    });
  } catch (error) {
    throw new Error(friendlyJobUpdateError(error));
  }
  return { hidden: true };
}

export async function unhideJob(jobId) {
  const headers = await authHeaders();
  try {
    await apiJson(`/users/hide/${encodeURIComponent(jobId)}`, {
      method: "DELETE",
      headers,
    });
  } catch (error) {
    throw new Error(friendlyJobUpdateError(error));
  }
  return { hidden: false };
}

export async function addJobToFavorites(jobId) {
  const headers = await authHeaders();
  const { favorites } = await getUserJobInteractions();
  const normalizedId = String(jobId);

  if ((favorites || []).map(String).includes(normalizedId)) {
    await apiJson(`/favorites/${encodeURIComponent(jobId)}`, {
      method: "DELETE",
      headers,
    });
    return { added: false };
  }

  await apiJson("/favorites", {
    method: "POST",
    headers,
    body: JSON.stringify({ job_id: jobId }),
  });
  return { added: true };
}

function analyticsSessionId() {
  const key = "jobsVisionApplyAnalyticsSession";
  try {
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;
    const next =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(key, next);
    return next;
  } catch {
    return "";
  }
}

async function recordJobEvent(jobId, payload = {}) {
  if (!jobId) return null;
  const body = JSON.stringify({
    ...payload,
    session_id: analyticsSessionId() || undefined,
  });

  try {
    const res = await fetch(`${apiBaseUrl()}/jobs/${encodeURIComponent(jobId)}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    });
    return res.ok ? res.json().catch(() => ({ ok: true })) : null;
  } catch {
    return null;
  }
}

export async function recordListingView(jobId, metadata = {}) {
  return recordJobEvent(jobId, {
    event_type: "listing_view",
    source: "job_modal",
    metadata,
  });
}

export async function recordApplyClick(jobId, { destinationType, destination, source = "job_modal" } = {}) {
  return recordJobEvent(jobId, {
    event_type: "apply_click",
    destination_type: destinationType,
    destination,
    source,
  });
}

export async function applyToJob(jobId) {
  const headers = await authHeaders();
  try {
    await apiJson("/applications", {
      method: "POST",
      headers,
      body: JSON.stringify({ job_id: jobId }),
    });
  } catch (error) {
    const msg = String(error?.message || "").toLowerCase();
    if (!msg.includes("duplicate") && !msg.includes("unique")) throw error;
  }
  return { applied: true };
}

export async function removeJobApplication(jobId) {
  const headers = await authHeaders();
  await apiJson(`/applications/${encodeURIComponent(jobId)}`, {
    method: "DELETE",
    headers,
  });
  return { applied: false };
}

export async function getUserJobInteractions() {
  const { session } = await getNeonSession();
  const token = session?.access_token;
  if (!token) return { favorites: [], appliedJobs: [], hiddenJobs: [] };

  const headers = { Authorization: `Bearer ${token}` };
  const [favs, apps, hidden] = await Promise.all([
    apiJson("/favorites", { headers }),
    apiJson("/applications/mine", { headers }),
    apiJson("/users/hidden", { headers }).catch(() => []),
  ]);

  return {
    favorites: (Array.isArray(favs) ? favs : []).map((row) => String(row.job_id)),
    appliedJobs: (Array.isArray(apps) ? apps : []).map((row) => String(row.job_id)),
    hiddenJobs: (Array.isArray(hidden) ? hidden : []).map((jobId) => String(jobId)),
  };
}
