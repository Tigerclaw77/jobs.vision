// backend/services/supaClient.js
// CommonJS server-only Supabase (service role)

const { createClient } = require("@supabase/supabase-js");

const rawUrl = process.env.SUPABASE_URL;
const SUPABASE_URL = (rawUrl || "").replace(/\/+$/, ""); // normalize
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "Supabase misconfigured: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env"
  );
}

// Service-role client (bypasses RLS — use only on trusted server)
const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  db: { schema: "public" },
});

// Helpful export for issuer checks in middleware
const EXPECTED_ISSUER = `${SUPABASE_URL.replace(/\/+$/, "")}/auth/v1`;

module.exports = {
  supa,
  EXPECTED_ISSUER,

  // --- existing helpers kept as-is ---
  async listJobs({ q, tagIds = [], city, state, limit = 20, offset = 0 } = {}) {
    let qy = supa
      .from("jobs")
      .select("*")
      .eq("is_archived", false)
      .order("posted_at", { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (q) qy = qy.ilike("title", `%${q}%`);
    if (city) qy = qy.eq("city", city);
    if (state) qy = qy.eq("state", state);
    if (tagIds?.length) qy = qy.contains("tag_ids", tagIds);

    const { data, error } = await qy;
    if (error) throw error;
    return data;
  },

  async unarchiveJob(jobId, recruiterId) {
    const nowIso = new Date().toISOString();
    const { data: job, error: e1 } = await supa
      .from("jobs")
      .select("*")
      .eq("id", jobId)
      .eq("recruiter_id", recruiterId)
      .single();
    if (e1) throw e1;

    if (!job.is_archived) return job;

    const { data, error } = await supa
      .from("jobs")
      .update({
        is_archived: false,
        archived_at: null,
        last_activated_at: nowIso,
        first_activated_at: job.first_activated_at ?? nowIso,
        updated_at: nowIso,
      })
      .eq("id", jobId)
      .eq("recruiter_id", recruiterId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async archiveJob(jobId, recruiterId) {
    const now = new Date();
    const { data: job, error: e1 } = await supa
      .from("jobs")
      .select("*")
      .eq("id", jobId)
      .eq("recruiter_id", recruiterId)
      .single();
    if (e1) throw e1;

    const addSeconds =
      job.last_activated_at && !job.is_archived
        ? Math.max(0, Math.floor((now - new Date(job.last_activated_at)) / 1000))
        : 0;

    const { data, error } = await supa
      .from("jobs")
      .update({
        is_archived: true,
        archived_at: now.toISOString(),
        total_active_seconds: (job.total_active_seconds ?? 0) + addSeconds,
        updated_at: now.toISOString(),
      })
      .eq("id", jobId)
      .eq("recruiter_id", recruiterId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};
