// src/utils/api.supabase.js
import { supabase } from "./supabaseClient";

/** Normalize a DB row to the UI shape the components expect. */
function mapJobRow(row = {}) {
  const tagsRaw = Array.isArray(row.tags)
    ? row.tags
    : typeof row.tags === "string"
    ? row.tags.split(",").map((t) => t.trim())
    : [];

  return {
    _id: String(row.id ?? row._id ?? row.uuid ?? crypto.randomUUID()),
    title: row.title || "",
    company: row.company || "",
    location: row.location || "",
    role: (row.role || "").toLowerCase(),
    hours: (row.hours || "").toLowerCase(),
    salary: typeof row.salary === "number" ? row.salary : undefined,
    tags: tagsRaw.map((t) => String(t).toLowerCase()),
    latitude: row.latitude != null ? Number(row.latitude) : undefined,
    longitude: row.longitude != null ? Number(row.longitude) : undefined,
    description: row.description || "",
    createdAt: row.created_at || row.createdAt || null,
    status: row.status || "active",
  };
}

/** Returns an ARRAY of jobs. Select `*` so missing columns don't break the query. */
export async function fetchJobs() {
  const { data, error } = await supabase.from("jobs").select("*");
  if (error) throw error;
  return (Array.isArray(data) ? data : []).map(mapJobRow);
}

/** Get the current Supabase-authenticated user id (throws if not signed in). */
async function getAuthUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  const uid = data?.user?.id;
  if (!uid) throw new Error("Not signed in.");
  return uid;
}

/**
 * Toggle favorite for a job.
 * Tables assumed:
 *   job_favorites: { id, user_id, job_id, created_at }
 * Unique index: (user_id, job_id)
 */
export async function addJobToFavorites(jobId) {
  const uid = await getAuthUserId();

  const { data: existing, error: selErr } = await supabase
    .from("job_favorites")
    .select("id")
    .eq("user_id", uid)
    .eq("job_id", jobId)
    .maybeSingle();

  if (selErr) throw selErr;

  if (existing?.id) {
    const { error: delErr } = await supabase
      .from("job_favorites")
      .delete()
      .eq("id", existing.id);
    if (delErr) throw delErr;
    return { added: false };
  }

  const { error: insErr } = await supabase
    .from("job_favorites")
    .insert([{ user_id: uid, job_id: jobId }]);
  if (insErr) throw insErr;
  return { added: true };
}

/**
 * Apply to a job (idempotent).
 * Tables assumed:
 *   job_applications: { id, user_id, job_id, created_at }
 * Unique index: (user_id, job_id)
 */
export async function applyToJob(jobId) {
  const uid = await getAuthUserId();

  const { error } = await supabase
    .from("job_applications")
    .insert([{ user_id: uid, job_id: jobId }]);

  // Ignore duplicate/unique violation if already applied
  if (error) {
    const msg = (error.message || "").toLowerCase();
    if (error.code !== "23505" && !msg.includes("duplicate") && !msg.includes("unique")) {
      throw error;
    }
  }
  return { applied: true };
}

/** Load favorites + applied job ids for the current user. */
export async function getUserJobInteractions() {
  const uid = await getAuthUserId();

  const [{ data: favs, error: favErr }, { data: apps, error: appErr }] =
    await Promise.all([
      supabase.from("job_favorites").select("job_id").eq("user_id", uid),
      supabase.from("job_applications").select("job_id").eq("user_id", uid),
    ]);

  if (favErr) throw favErr;
  if (appErr) throw appErr;

  return {
    favorites: (favs || []).map((r) => String(r.job_id)),
    appliedJobs: (apps || []).map((r) => String(r.job_id)),
  };
}
