const express = require("express");
const crypto = require("crypto");
const { supa } = require("../services/supaClient");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

const APP_URL = process.env.APP_URL || "http://localhost:3000";
const API_URL = process.env.PUBLIC_API_URL || "http://localhost:5000";

/** You can replace this with your mailer */
async function sendEmail(to, subject, text) {
  console.log("[mail] to:", to, "| subject:", subject, "| body:", text);
  // TODO: wire up real email (Resend, SES, Mailgun, etc.)
}

/**
 * GET /api/recruiter/domains
 * List my domains
 */
router.get("/recruiter/domains", requireAuth, async (req, res) => {
  try {
    const { data, error } = await supa
      .from("recruiter_domains")
      .select("id,domain,status,verified_at,created_at")
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ items: data || [] });
  } catch (e) {
    console.error("List domains error:", e);
    res.status(500).json({ error: "Failed to list domains" });
  }
});

/**
 * POST /api/recruiter/domains/request
 * body: { domain: "walmart.com", sendTo: "someone@walmart.com" }
 * Sends a verification link to an address at that domain.
 */
router.post("/recruiter/domains/request", requireAuth, async (req, res) => {
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
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24h

    const { data, error } = await supa
      .from("recruiter_domains")
      .upsert(
        {
          user_id: userId,
          domain,
          status: "pending",
          verification_token: token,
          token_expires_at: expiresAt.toISOString(),
        },
        { onConflict: "user_id,domain" }
      )
      .select("id,domain,status")
      .maybeSingle();
    if (error) throw error;

    const link = `${API_URL}/api/verify-domain?token=${token}`;
    await sendEmail(sendTo, `Verify ${domain}`, `Click to verify: ${link}`);

    res.json({ ok: true, domain, status: "pending" });
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

    const { data: rec, error } = await supa
      .from("recruiter_domains")
      .select("*")
      .eq("verification_token", token)
      .maybeSingle();
    if (error || !rec) return res.status(400).send("Invalid token");

    if (!rec.token_expires_at || new Date(rec.token_expires_at) < new Date()) {
      return res.status(400).send("Token expired");
    }

    const { error: upErr } = await supa
      .from("recruiter_domains")
      .update({
        status: "verified",
        verified_at: new Date().toISOString(),
        verification_token: null,
        token_expires_at: null,
      })
      .eq("id", rec.id);
    if (upErr) return res.status(500).send("Failed to verify");

    // Redirect back to app
    const appRedirect = `${APP_URL}/recruiter/domains?verified=${encodeURIComponent(rec.domain)}`;
    res.redirect(appRedirect);
  } catch (e) {
    console.error("Verify domain error:", e);
    res.status(500).send("Server error");
  }
});

module.exports = router;
