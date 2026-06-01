const express = require("express");
const crypto = require("crypto");
const { one, query } = require("../services/db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { sendEmail } = require("../services/email");

const router = express.Router();

const APP_URL = (process.env.APP_URL || process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/+$/, "");
const API_URL = (process.env.PUBLIC_API_URL || "http://localhost:5000").replace(/\/+$/, "").replace(/\/api$/, "");

/**
 * GET /api/recruiter/domains
 * List my domains
 */
router.get("/recruiter/domains", requireAuth, requireRole(["recruiter", "admin"]), async (req, res) => {
  try {
    const result = await query(
      `
        select id, domain, status, verified_at, created_at
        from public.recruiter_domains
        where user_id = $1
        order by created_at desc
      `,
      [req.user.id]
    );
    res.json({ items: result.rows });
  } catch (e) {
    console.error("List domains error:", e);
    res.status(500).json({ error: "Failed to list domains" });
  }
});

/**
 * POST /api/recruiter/domains/request
 * body: { domain: "walmart.com", sendTo: "someone@walmart.com" }
 */
router.post("/recruiter/domains/request", requireAuth, requireRole(["recruiter", "admin"]), async (req, res) => {
  try {
    const userId = req.user.id;
    const rawDomain = String(req.body?.domain || "");
    const domain = rawDomain
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0];

    const sendTo = String(req.body?.sendTo || "").trim().toLowerCase();
    if (!domain) return res.status(400).json({ error: "domain required" });
    if (!sendTo || !sendTo.endsWith(`@${domain}`)) {
      return res.status(400).json({ error: "sendTo must be an address at that domain" });
    }

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);

    const data = await one(
      `
        insert into public.recruiter_domains (
          user_id,
          domain,
          status,
          verification_token,
          token_expires_at
        )
        values ($1, $2, 'pending', $3, $4)
        on conflict (user_id, domain) do update
          set status = excluded.status,
              verification_token = excluded.verification_token,
              token_expires_at = excluded.token_expires_at,
              updated_at = now()
        returning id, domain, status
      `,
      [userId, domain, token, expiresAt.toISOString()]
    );

    const link = `${API_URL}/api/verify-domain?token=${token}`;
    const mail = await sendEmail({
      to: sendTo,
      subject: `Verify ${domain}`,
      text: `Click to verify your jobs.vision recruiter domain: ${link}`,
      html: `<p>Click to verify your jobs.vision recruiter domain:</p><p><a href="${link}">${link}</a></p>`,
    });

    res.json({ ok: true, domain: data?.domain || domain, status: "pending", emailSent: !!mail.sent });
  } catch (e) {
    console.error("Request domain verify error:", e);
    res.status(500).json({ error: "Failed to request verification" });
  }
});

/**
 * GET /api/verify-domain?token=...
 * Public callback from email link
 */
router.get("/verify-domain", async (req, res) => {
  try {
    const token = String(req.query.token || "");
    if (!token) return res.status(400).send("Missing token");

    const rec = await one(
      "select * from public.recruiter_domains where verification_token = $1",
      [token]
    );
    if (!rec) return res.status(400).send("Invalid token");

    if (!rec.token_expires_at || new Date(rec.token_expires_at) < new Date()) {
      return res.status(400).send("Token expired");
    }

    await query(
      `
        update public.recruiter_domains
        set status = 'verified',
            verified_at = now(),
            verification_token = null,
            token_expires_at = null,
            updated_at = now()
        where id = $1
      `,
      [rec.id]
    );

    const appRedirect = `${APP_URL}/recruiter/domains?verified=${encodeURIComponent(rec.domain)}`;
    res.redirect(appRedirect);
  } catch (e) {
    console.error("Verify domain error:", e);
    res.status(500).send("Server error");
  }
});

module.exports = router;
