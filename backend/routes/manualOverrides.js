// backend/routes/manualOverrides.js
const express = require('express');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const path = require('path');
const { supa } = require('../services/supaClient.js');
const { verifyHCaptcha } = require('../services/hcaptcha.js');

const router = express.Router();

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
      const { data: row, error: insertErr } = await supa
        .from('manual_overrides')
        .insert({
          email: normEmail,
          name: name.trim(),
          role: role?.trim() || null,
          company: company.trim(),
          company_website: companyWebsite?.trim() || null,
          justification: justification?.trim() || null,
          proof_urls: proofUrlsArr,
          status: 'pending',
          requester_ip: remoteip ? remoteip : null,
          captcha_score: hc?.score ?? null
        })
        .select('*')
        .single();

      if (insertErr) {
        return res.status(500).json({ error: 'Failed to create override request.', details: insertErr });
      }

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
        const { error: updateErr } = await supa
          .from('manual_overrides')
          .update({ proof_urls: (row.proof_urls || []).concat(uploadedUrls) })
          .eq('id', row.id);

        if (updateErr) {
          console.error('Failed to attach uploaded URLs:', updateErr);
        }
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
router.get('/', async (req, res) => {
  try {
    const status = (req.query.status || 'pending').toLowerCase();
    const { data, error } = await supa
      .from('manual_overrides')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: 'Failed to fetch.', details: error });
    return res.json({ items: data || [] });
  } catch (err) {
    console.error('manual-overrides GET error', err);
    return res.status(500).json({ error: 'Server error.' });
  }
});

/**
 * POST /api/manual-overrides/:id/decision
 * Body: { decision: 'approve' | 'deny', reviewedBy: 'admin@...' }
 */
router.post('/:id/decision', async (req, res) => {
  try {
    const id = req.params.id;
    const { decision, reviewedBy } = req.body || {};
    if (!['approve', 'deny'].includes(decision)) {
      return res.status(400).json({ error: 'Invalid decision.' });
    }

    const status = decision === 'approve' ? 'approved' : 'denied';
    const { error } = await supa
      .from('manual_overrides')
      .update({
        status,
        reviewed_by: reviewedBy || 'admin',
        reviewed_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) return res.status(500).json({ error: 'Failed to update.', details: error });
    return res.json({ ok: true });
  } catch (err) {
    console.error('manual-overrides decision error', err);
    return res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
