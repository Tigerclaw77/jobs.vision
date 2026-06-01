// src/utils/api.supabase.js
import { getNeonSession } from "./neonAuthClient";

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
    company: row.employer_name || row.company || row.venue_name || "",
    location: row.location || [row.city, row.state].filter(Boolean).join(", "),
    role: (row.role || "").toLowerCase(),
    hours: (row.hours || "").toString().toLowerCase(),
    type: (row.type || "").toString().toLowerCase(),
    salary: row.salary,
    tags: tagsRaw.map((t) => String(t).toLowerCase()),
    latitude: row.latitude != null ? Number(row.latitude) : undefined,
    longitude: row.longitude != null ? Number(row.longitude) : undefined,
    description: row.description || "",
    createdAt: row.posted_at || row.created_at || row.createdAt || null,
    status: row.status || "active",
  };
}

export async function fetchJobs() {
  const data = await apiJson("/jobs");
  return (Array.isArray(data) ? data : []).map(mapJobRow);
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

export async function getUserJobInteractions() {
  const { session } = await getNeonSession();
  const token = session?.access_token;
  if (!token) return { favorites: [], appliedJobs: [] };

  const headers = { Authorization: `Bearer ${token}` };
  const [favs, apps] = await Promise.all([
    apiJson("/favorites", { headers }),
    apiJson("/applications/mine", { headers }),
  ]);

  return {
    favorites: (Array.isArray(favs) ? favs : []).map((row) => String(row.job_id)),
    appliedJobs: (Array.isArray(apps) ? apps : []).map((row) => String(row.job_id)),
  };
}
