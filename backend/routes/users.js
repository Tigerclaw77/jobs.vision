// backend/routes/users.js
const express = require("express");
const router = express.Router();

const requireAdmin = require("../middleware/requireAdmin");
const { one, query } = require("../services/db");

const FREE_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "aol.com",
  "icloud.com",
  "proton.me",
  "protonmail.com",
  "live.com",
  "me.com",
  "msn.com",
]);

const SORT_COLUMNS = new Set([
  "email",
  "created_at",
  "role",
  "first_name",
  "last_name",
  "company",
  "failed_attempts",
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
    const role = String(req.query.role || "").toLowerCase();
    const search = (req.query.search || "").trim();
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const sort = (req.query.sort || "email.asc").toString();
    const [sortColRaw = "email", sortDirRaw = "asc"] = sort.split(".");
    const sortCol = SORT_COLUMNS.has(sortColRaw) ? sortColRaw : "email";
    const sortDir = sortDirRaw.toLowerCase() === "desc" ? "desc" : "asc";

    const where = [];
    const params = [];

    if (["admin", "recruiter", "candidate"].includes(role)) {
      params.push(role);
      where.push(`role = $${params.length}`);
    }

    if (search) {
      params.push(`%${search.replace(/,/g, "")}%`);
      where.push(
        `(email ilike $${params.length} or first_name ilike $${params.length} or last_name ilike $${params.length} or company ilike $${params.length})`
      );
    }

    params.push(limit);
    const limitParam = params.length;
    params.push((page - 1) * limit);
    const offsetParam = params.length;

    const result = await query(
      `
        select
          id,
          email,
          role,
          first_name,
          last_name,
          created_at,
          company,
          locked,
          locked_at,
          failed_attempts,
          count(*) over()::int as __total
        from public.profiles
        ${where.length ? `where ${where.join(" and ")}` : ""}
        order by ${sortCol} ${sortDir}
        limit $${limitParam} offset $${offsetParam}
      `,
      params
    );

    const total = result.rows[0]?.__total ?? 0;
    const items = result.rows.map((r) => {
      const first = (r.first_name || "").trim();
      const last = (r.last_name || "").trim();
      const local = (r.email || "").split("@")[0] || "";

      return {
        id: r.id,
        email: r.email,
        role: r.role || "unknown",
        first_name: first,
        last_name: last,
        profile: { firstName: first, lastName: last },
        company: r.company || null,
        org: orgFrom(r.email, r.company) || ((r.email || "").split("@")[1] || "").toLowerCase(),
        locked: !!r.locked,
        lockedAt: r.locked_at || null,
        createdAt: r.created_at || null,
        failedAttempts: Number.isFinite(r.failed_attempts) ? r.failed_attempts : 0,
        displayName: (last && first && `${last}, ${first}`) || last || first || local || "-",
      };
    });

    res.set("Cache-Control", "no-store");
    return res.json({ items, total, page, limit });
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

    const data = await one(
      "update public.profiles set failed_attempts = 0 where email = $1 returning id, email",
      [email]
    );

    if (!data) return res.status(404).json({ error: "User not found" });
    return res.json({ ok: true });
  } catch (e) {
    console.error("POST /api/users/reset-failed-attempts error", e);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
