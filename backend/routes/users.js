// backend/routes/users.js
const express = require("express");
const router = express.Router();

const requireAdmin = require("../middleware/requireAdmin"); // central guard
const { supa } = require("../services/supaClient");         // service-role client

// Free email domains -> "Personal" org fallback
const FREE_DOMAINS = new Set([
  "gmail.com","yahoo.com","outlook.com","hotmail.com","aol.com",
  "icloud.com","proton.me","protonmail.com","live.com","me.com","msn.com"
]);

function domainFromEmail(email = "") {
  const at = email.indexOf("@");
  return at === -1 ? "" : email.slice(at + 1).toLowerCase();
}

function orgFrom(email, company) {
  if (company) return company;
  const d = domainFromEmail(email);
  if (!d) return "";
  return FREE_DOMAINS.has(d) ? "Personal" : d;
}

// GET /api/users?role=&search=&page=&limit=&sort=created_at.desc
router.get("/", requireAdmin(), async (req, res) => {
  try {
    const role   = String(req.query.role || "").toLowerCase();
    const search = (req.query.search || "").trim();

    // optional paging/sort
    const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const sort  = (req.query.sort || "email.asc").toString(); // e.g., "created_at.desc"
    const [sortCol = "email", sortDirRaw = "asc"] = sort.split(".");
    const ascending = sortDirRaw.toLowerCase() !== "desc";

    let q = supa
      .from("profiles")
      .select(
        "id,email,role,first_name,last_name,created_at,company,locked,locked_at,failed_attempts",
        { count: "exact" }
      )
      .order(sortCol, { ascending });

    if (["admin", "recruiter", "candidate"].includes(role)) {
      q = q.eq("role", role);
    }

    if (search) {
      // search across email/first/last/company
      const s = search.replace(/,/g, "");
      q = q.or(
        `email.ilike.%${s}%,first_name.ilike.%${s}%,last_name.ilike.%${s}%,company.ilike.%${s}%`
      );
    }

    // paging
    const from = (page - 1) * limit;
    const to   = from + limit - 1;
    q = q.range(from, to);

    let { data, error, count } = await q;
    if (error) {
      console.error("profiles select error", error);
      return res.status(500).json({ error: "Select failed" });
    }

    const items = (data || []).map((r) => {
      const first = (r.first_name || "").trim();
      const last  = (r.last_name  || "").trim();
      const local = (r.email || "").split("@")[0] || "";

      return {
        id: r.id,
        email: r.email,
        role: r.role || "unknown",

        // expose BOTH shapes so any component can read it
        first_name: first,
        last_name:  last,
        profile: { firstName: first, lastName: last },

        company: r.company || null,
        org: orgFrom(r.email, r.company) || ((r.email || "").split("@")[1] || "").toLowerCase(),

        locked: !!r.locked,
        lockedAt: r.locked_at || null,

        createdAt: r.created_at || null,

        failedAttempts: Number.isFinite(r.failed_attempts) ? r.failed_attempts : 0,

        // always provide a reliable display name
        displayName:
          (last && first && `${last}, ${first}`) ||
          last || first || local || "—",
      };
    });

    res.set("Cache-Control", "no-store");
    return res.json({
      items,
      total: typeof count === "number" ? count : items.length,
      page,
      limit,
    });
  } catch (e) {
    console.error("GET /api/users error", e);
    return res.status(500).json({ error: "Server error" });
  }
});

// POST /api/users/reset-failed-attempts { email }
router.post("/reset-failed-attempts", requireAdmin(), async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: "email required" });

    const { data, error } = await supa
      .from("profiles")
      .update({ failed_attempts: 0 })
      .eq("email", email)
      .select("id,email")
      .maybeSingle();

    if (error) return res.status(500).json({ error: "Update failed" });
    if (!data) return res.status(404).json({ error: "User not found" });

    return res.json({ ok: true });
  } catch (e) {
    console.error("POST /api/users/reset-failed-attempts error", e);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
