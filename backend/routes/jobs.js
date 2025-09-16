// backend/routes/jobs.js
const express = require("express");
const { supa } = require("../services/supaClient.js");
const { requireAuth, maybeAuth } = require("../middleware/auth.js");

// ✅ Brand/group helpers (you created this in step #1)
const {
  normalizeDomain,
  detectBrandKeyFromText,
  acceptedDomainsForBrand,
  brandByKey,
} = require("../services/brandRegistry");

const router = express.Router();

/* ---------------------------- PUBLIC LIST ----------------------------- */
/**
 * GET /api/jobs
 * Public list (non-archived). Supports q, city, state, tags, limit, offset
 * If you added a `status` column, uncomment the status=active filter.
 */
router.get("/", maybeAuth, async (req, res) => {
  try {
    const { q, city, state, tags, limit = "20", offset = "0" } = req.query;
    const tagIds = typeof tags === "string" && tags.length ? tags.split(",") : [];

    let qy = supa
      .from("jobs")
      .select("*")
      .eq("is_archived", false)
      // .eq("status", "active")
      .order("posted_at", { ascending: false })
      .range(
        parseInt(offset, 10),
        parseInt(offset, 10) + parseInt(limit, 10) - 1
      );

    if (q)     qy = qy.ilike("title", `%${q}%`);
    if (city)  qy = qy.eq("city", city);
    if (state) qy = qy.eq("state", state);
    if (tagIds.length) qy = qy.contains("tag_ids", tagIds); // text[] contains

    const { data, error } = await qy;
    if (error) throw error;
    res.json(data);
  } catch (e) {
    console.error("List jobs error:", e);
    res.status(500).json({ error: "Failed to list jobs" });
  }
});

/* ------------------------ CREATE (brand rules) ------------------------ */
/**
 * POST /api/jobs
 * Recruiter creates a job.
 *
 * Accepts old and new fields:
 * {
 *   title, description, location, city, state, role, hours, type, salary, tag_ids, is_archived?,
 *   employer_name?, company?,                  // free text employer
 *   employer_brand?, brand?,                   // brand key or alias (e.g. 'walmart', 'target optical')
 *   employer_domain?, company_domain?,         // domain to verify against (optional)
 *   venue_brand?, venue_name?, venue_store_id?, venue_note? // venue-only disclosure (no verification)
 * }
 */
router.post("/", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const recruiter_id = user.id;

    // ---- collect / normalize fields (back-compat) ----
    let employer_name   = req.body.employer_name ?? req.body.company ?? null;
    let employer_brand  = req.body.employer_brand ?? req.body.brand ?? null; // may be key or alias
    let employer_domain = normalizeDomain(req.body.employer_domain ?? req.body.company_domain ?? "");
    let venue_brand     = req.body.venue_brand ?? null;
    let venue_name      = req.body.venue_name ?? null;
    const venue_store_id= req.body.venue_store_id ?? null;
    const venue_note    = req.body.venue_note ?? null;

    // normalize employer_brand to canonical brand key if possible
    if (employer_brand) {
      const asKey = brandByKey(employer_brand)?.key;
      employer_brand = asKey || detectBrandKeyFromText(employer_brand) || employer_brand;
    }
    // normalize venue_brand similarly
    if (venue_brand) {
      const asKey = brandByKey(venue_brand)?.key;
      venue_brand = asKey || detectBrandKeyFromText(venue_brand) || venue_brand;
    }

    // ---- compute brand verification (group-aware) ----
    let status = "active";
    let employer_brand_verified = false;

    if (employer_brand && brandByKey(employer_brand)) {
      // accepted domains = brand.domains ∪ group.domains per your brandRegistry
      const accepted = acceptedDomainsForBrand(employer_brand).map(normalizeDomain);
      const candidates = new Set(accepted);
      if (employer_domain) candidates.add(normalizeDomain(employer_domain));

      const { data: doms, error: domErr } = await supa
        .from("recruiter_domains")
        .select("domain,status")
        .eq("user_id", recruiter_id);
      if (domErr) throw domErr;

      employer_brand_verified = (doms || []).some(
        d => d.status === "verified" && candidates.has(normalizeDomain(d.domain))
      );

      if (!employer_brand_verified) {
        status = "pending_domain"; // not public until verified
      }
    }

    // ---- downgrade sneaky branding in employer_name to venue if not verified ----
    if (!employer_brand_verified && employer_name) {
      const hitKey = detectBrandKeyFromText(employer_name);
      if (hitKey) {
        const brand = brandByKey(hitKey);
        // move to venue disclosure
        venue_brand = venue_brand || brand?.key;
        venue_name  = venue_name  || brand?.label || null;

        // strip brand aliases from employer_name if it looks branded
        const aliases = (brand?.aliases || []).map(a => a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
        if (aliases.length) {
          const re = new RegExp(aliases.join("|"), "ig");
          const stripped = employer_name.replace(re, "").replace(/\s{2,}/g, " ").trim();
          employer_name = stripped || null;
        }

        // ensure we are NOT treating as corporate employer
        employer_brand = null;
        employer_domain = null;
      }
    }

    // ---- build payload & insert ----
    const nowIso = new Date().toISOString();

    const payload = {
      // existing columns you already had
      title: req.body.title,
      description: req.body.description ?? null,
      location: req.body.location ?? null,
      city: req.body.city ?? null,
      state: req.body.state ?? null,
      role: req.body.role ?? null,
      hours: req.body.hours ?? null,
      type: req.body.type ?? null,
      salary: req.body.salary ?? null,
      tag_ids: Array.isArray(req.body.tag_ids) ? req.body.tag_ids : [],
      recruiter_id,                // keep for back-compat
      is_archived: !!req.body.is_archived,
      posted_at: nowIso,

      // new employer/brand fields (make sure your jobs table has these columns)
      employer_name: employer_name ?? null,
      employer_brand: employer_brand ?? null,
      employer_domain: employer_brand_verified ? (employer_domain || null) : null,
      employer_brand_verified,

      // venue disclosure (always allowed)
      venue_brand: venue_brand || null,
      venue_name: venue_name || null,
      venue_store_id: venue_store_id || null,
      venue_note: venue_note || null,

      // lifecycle (if you added this column)
      status,                      // 'active' | 'pending_domain' | 'archived' | 'draft'
      posted_by: recruiter_id,
      updated_at: nowIso
    };

    const { data, error } = await supa
      .from("jobs")
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      job: data,
      requiresVerification: status === "pending_domain",
      message: status === "pending_domain"
        ? "Brand postings require domain verification. We saved this as Pending Domain."
        : undefined
    });
  } catch (e) {
    console.error("Create job error:", e);
    res.status(500).json({ error: "Failed to create job" });
  }
});

/* ------------------------ UPDATE (brand rules) ------------------------ */
/**
 * PATCH /api/jobs/:id
 * Recruiter updates own job (re-run brand rule if relevant fields changed)
 */
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const recruiter_id = req.user.id;
    const jobId = req.params.id;

    // own job?
    const { data: job, error: e1 } = await supa
      .from("jobs")
      .select("*")
      .eq("id", jobId)
      .single();
    if (e1) throw e1;
    if (!job || job.recruiter_id !== recruiter_id)
      return res.status(403).json({ error: "Forbidden" });

    // allowed fields (include new columns)
    const allowed = [
      "title","description","location","city","state","role","hours","type","salary","tag_ids","is_archived",
      "employer_name","employer_brand","employer_domain",
      "venue_brand","venue_name","venue_store_id","venue_note",
      "status" // allow explicit status overrides if you want
    ];
    const updates = {};
    for (const k of allowed) if (k in req.body) updates[k] = req.body[k];

    // re-run brand rules if employer_* changed
    let status = job.status || "active";
    let employer_brand_verified = job.employer_brand_verified || false;

    const employer_name = ( "employer_name" in updates ? updates.employer_name : job.employer_name ) ?? job.company ?? null;
    let employer_brand  = ( "employer_brand" in updates ? updates.employer_brand : job.employer_brand ) ?? null;
    let employer_domain = normalizeDomain( "employer_domain" in updates ? updates.employer_domain : (job.employer_domain || "") );
    let venue_brand     = ( "venue_brand" in updates ? updates.venue_brand : job.venue_brand ) ?? null;
    let venue_name      = ( "venue_name"  in updates ? updates.venue_name  : job.venue_name )  ?? null;

    // normalize employer_brand / venue_brand to canonical keys
    if (employer_brand) {
      const asKey = brandByKey(employer_brand)?.key;
      employer_brand = asKey || detectBrandKeyFromText(employer_brand) || employer_brand;
    }
    if (venue_brand) {
      const asKey = brandByKey(venue_brand)?.key;
      venue_brand = asKey || detectBrandKeyFromText(venue_brand) || venue_brand;
    }

    if ("employer_name" in updates || "employer_brand" in updates || "employer_domain" in updates) {
      employer_brand_verified = false;

      if (employer_brand && brandByKey(employer_brand)) {
        const accepted = acceptedDomainsForBrand(employer_brand).map(normalizeDomain);
        const candidates = new Set(accepted);
        if (employer_domain) candidates.add(normalizeDomain(employer_domain));

        const { data: doms } = await supa
          .from("recruiter_domains")
          .select("domain,status")
          .eq("user_id", recruiter_id);

        employer_brand_verified = (doms || []).some(
          d => d.status === "verified" && candidates.has(normalizeDomain(d.domain))
        );

        status = employer_brand_verified ? "active" : "pending_domain";
      } else {
        status = "active";
      }

      if (!employer_brand_verified && employer_name) {
        const hitKey = detectBrandKeyFromText(employer_name);
        if (hitKey) {
          const brand = brandByKey(hitKey);
          venue_brand = venue_brand || brand?.key;
          venue_name  = venue_name  || brand?.label || null;

          const aliases = (brand?.aliases || []).map(a => a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
          if (aliases.length) {
            const re = new RegExp(aliases.join("|"), "ig");
            const stripped = employer_name.replace(re, "").replace(/\s{2,}/g, " ").trim();
            updates.employer_name = stripped || null;
          }

          updates.employer_brand = null;
          employer_brand = null;
          employer_domain = null;
        }
      }

      updates.employer_brand_verified = employer_brand_verified;
      updates.status = status;
      if (!employer_brand_verified) {
        updates.employer_domain = null;
      }
      if (venue_brand !== job.venue_brand) updates.venue_brand = venue_brand;
      if (venue_name  !== job.venue_name)  updates.venue_name  = venue_name;
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supa
      .from("jobs")
      .update(updates)
      .eq("id", jobId)
      .eq("recruiter_id", recruiter_id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (e) {
    console.error("Update job error:", e);
    res.status(500).json({ error: "Failed to update job" });
  }
});

/* -------------------------- UNARCHIVE / ARCHIVE ----------------------- */
/**
 * POST /api/jobs/:id/unarchive
 * Start billing timer; make job public
 */
router.post("/:id/unarchive", requireAuth, async (req, res) => {
  try {
    const recruiter_id = req.user.id;
    const jobId = req.params.id;

    const now = new Date().toISOString();
    const { data: job, error: e1 } = await supa
      .from("jobs")
      .select("*")
      .eq("id", jobId)
      .eq("recruiter_id", recruiter_id)
      .single();
    if (e1) throw e1;

    if (!job.is_archived) return res.json(job);

    const { data, error } = await supa
      .from("jobs")
      .update({
        is_archived: false,
        archived_at: null,
        last_activated_at: now,
        first_activated_at: job.first_activated_at ?? now,
        updated_at: now,
      })
      .eq("id", jobId)
      .eq("recruiter_id", recruiter_id)
      .select()
      .single();
    if (error) throw error;

    res.json(data);
  } catch (e) {
    console.error("Unarchive job error:", e);
    res.status(500).json({ error: "Failed to unarchive job" });
  }
});

/**
 * POST /api/jobs/:id/archive
 * Stop billing timer; hide job
 */
router.post("/:id/archive", requireAuth, async (req, res) => {
  try {
    const recruiter_id = req.user.id;
    const jobId = req.params.id;

    const now = new Date();
    const { data: job, error: e1 } = await supa
      .from("jobs")
      .select("*")
      .eq("id", jobId)
      .eq("recruiter_id", recruiter_id)
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
      .eq("recruiter_id", recruiter_id)
      .select()
      .single();
    if (error) throw error;

    res.json(data);
  } catch (e) {
    console.error("Archive job error:", e);
    res.status(500).json({ error: "Failed to archive job" });
  }
});

module.exports = router;
