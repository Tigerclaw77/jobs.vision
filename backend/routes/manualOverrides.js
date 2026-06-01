// backend/routes/manualOverrides.js
const express = require('express');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const path = require('path');
const { supa } = require('../services/supaClient.js');
const { one, query } = require('../services/db.js');
const { verifyHCaptcha } = require('../services/hcaptcha.js');
const requireAdmin = require('../middleware/requireAdmin');
const { sendEmail } = require('../services/email');

const router = express.Router();
const adminOnly = requireAdmin();

// 🔒 Simple per-IP limiter: 10 create attempts/hour
const createLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false
});

// Multer to accept optional attachments (PDF/PNG/JPG)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Utility: upload file buffer to Supabase storage
async function uploadProofBufferToSupabase(file, overrideId) {
  if (!supa) {
    throw new Error('Supabase storage is not configured.');
  }

  // Bucket must exist: override_docs
  const ext = path.extname(file.originalname || '') || '.bin';
  const key = `${overrideId}/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;

  const { data, error } = await supa.storage.from('override_docs')
    .upload(key, file.buffer, {
      contentType: file.mimetype || 'application/octet-stream',
      upsert: false
    });

  if (error) throw error;

  const { data: signed, error: signErr } = await supa.storage.from('override_docs')
    .createSignedUrl(data.path, 60 * 60 * 24 * 7); // 7 days signed URL for admin view

  if (signErr) throw signErr;

  return signed.signedUrl;
}

/**
 * POST /api/manual-overrides
 * Body: { name, email, role?, company, companyWebsite?, justification, proofUrls[], hcaptchaToken }
 * Files: attachments[] (optional)
 */
router.post(
  '/',
  createLimiter,
  upload.array('attachments', 3),
  async (req, res) => {
    try {
      const {
        name,
        email,
        role,
        company,
        companyWebsite,
        justification,
        proofUrls // JSON string or array
      } = req.body;

      const hcaptchaToken = req.body.hcaptchaToken;
      const remoteip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;

      if (!name || !email || !company) {
        return res.status(400).json({ error: 'Missing required fields (name, email, company).' });
      }
      if (!hcaptchaToken) {
        return res.status(400).json({ error: 'Missing hCaptcha token.' });
      }

      // Verify hCaptcha
      const secret = process.env.HCAPTCHA_SECRET;
      const hc = await verifyHCaptcha(hcaptchaToken, secret, remoteip);
      if (!hc?.success) {
        return res.status(422).json({ error: 'Bot verification failed.', details: hc });
      }

      // Normalize email
      const normEmail = email.trim().toLowerCase();

      // Parse proofUrls
      let proofUrlsArr = [];
      if (Array.isArray(proofUrls)) {
        proofUrlsArr = proofUrls;
      } else if (typeof proofUrls === 'string' && proofUrls.trim()) {
        try {
          const parsed = JSON.parse(proofUrls);
          if (Array.isArray(parsed)) proofUrlsArr = parsed;
        } catch {
          // allow single URL string
          proofUrlsArr = [proofUrls.trim()];
        }
      }

      // Create placeholder row to get ID (for file paths)
      const row = await one(
        `
          insert into public.manual_overrides (
            email,
            name,
            role,
            company,
            company_website,
            justification,
            proof_urls,
            status,
            requester_ip,
            captcha_score
          )
          values ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $9)
          returning *
        `,
        [
          normEmail,
          name.trim(),
          role?.trim() || null,
          company.trim(),
          companyWebsite?.trim() || null,
          justification?.trim() || null,
          proofUrlsArr,
          remoteip ? remoteip : null,
          hc?.score ?? null,
        ]
      );

      // Optional: upload any attachments to Supabase storage and append signed URLs
      const files = req.files || [];
      const uploadedUrls = [];
      for (const f of files) {
        try {
          const url = await uploadProofBufferToSupabase(f, row.id);
          uploadedUrls.push(url);
        } catch (e) {
          // soft-fail: continue, but record server-side error
          console.error('Upload error:', e);
        }
      }

      if (uploadedUrls.length) {
        await query(
          "update public.manual_overrides set proof_urls = $1, updated_at = now() where id = $2",
          [(row.proof_urls || []).concat(uploadedUrls), row.id]
        );
      }

      return res.json({ ok: true, id: row.id });
    } catch (err) {
      console.error('manual-overrides POST error', err);
      return res.status(500).json({ error: 'Server error.' });
    }
  }
);

/**
 * GET /api/manual-overrides?status=pending
 */
router.get('/', adminOnly, async (req, res) => {
  try {
    const status = (req.query.status || 'pending').toLowerCase();
    if (!['pending', 'approved', 'denied'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status filter.' });
    }

    const result = await query(
      `
        select id,email,name,role,company,company_website,justification,proof_urls,status,created_at,reviewed_by,reviewed_at
        from public.manual_overrides
        where status = $1
        order by created_at desc
      `,
      [status]
    );

    return res.json({ items: result.rows || [] });
  } catch (err) {
    console.error('manual-overrides GET error', err);
    return res.status(500).json({ error: 'Server error.' });
  }
});

/**
 * POST /api/manual-overrides/:id/decision
 * Body: { decision: 'approve' | 'deny', reviewedBy: 'admin@...' }
 */
router.post('/:id/decision', adminOnly, async (req, res) => {
  try {
    const id = req.params.id;
    const { decision } = req.body || {};
    if (!['approve', 'deny'].includes(decision)) {
      return res.status(400).json({ error: 'Invalid decision.' });
    }

    const status = decision === 'approve' ? 'approved' : 'denied';
    const reviewedBy = req.profile?.email || req.user?.email || req.user?.id || 'admin';
    const data = await one(
      `
        update public.manual_overrides
        set status = $1,
            reviewed_by = $2,
            reviewed_at = $3,
            updated_at = now()
        where id = $4 and status = 'pending'
        returning id,email,name,company,status,reviewed_at
      `,
      [status, reviewedBy, new Date().toISOString(), id]
    );

    if (!data) return res.status(404).json({ error: 'Pending override not found.' });

    const approved = status === 'approved';
    const subject = approved
      ? 'Your jobs.vision manual verification was approved'
      : 'Your jobs.vision manual verification was denied';
    const text = approved
      ? `Hi ${data.name || 'there'},\n\nYour manual recruiter verification for ${data.company} was approved. You can continue using jobs.vision.\n\njobs.vision`
      : `Hi ${data.name || 'there'},\n\nYour manual recruiter verification for ${data.company} was denied. If you believe this was a mistake, please submit a new request with additional proof.\n\njobs.vision`;

    let emailSent = false;
    try {
      const mail = await sendEmail({ to: data.email, subject, text });
      emailSent = !!mail.sent;
    } catch (mailErr) {
      console.error('manual-overrides decision email error', mailErr);
    }

    return res.json({ ok: true, item: data, emailSent });
  } catch (err) {
    console.error('manual-overrides decision error', err);
    return res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
