// backend/routes/admin.js
const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { supa } = require('../services/supaClient'); // service-role client

// Public (anon) client for verifying the caller's access token only
const pub = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

// Middleware: require admin
async function requireAdmin(req, res, next) {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'No token' });

    const { data: { user }, error } = await pub.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: 'Invalid token' });

    // Read profile with SERVICE client to bypass RLS and avoid policy issues
    const { data: prof, error: pErr } = await supa
      .from('profiles')
      .select('id, email, role')
      .eq('id', user.id)
      .single();

    if (pErr) {
      console.error('requireAdmin: profile lookup error:', pErr);
      return res.status(403).json({ error: 'Profile lookup failed' });
    }

    console.log('requireAdmin: user', user.id, 'role', prof?.role);

    if (!prof || (prof.role || '').toLowerCase() !== 'admin') {
      return res.status(403).json({ error: 'Admin only' });
    }

    req.user = user;
    req.profile = prof;
    next();
  } catch (e) {
    console.error('requireAdmin error', e);
    res.status(500).json({ error: 'Auth error' });
  }
}

// GET /api/admin/dashboard
router.get('/dashboard', requireAdmin, async (_req, res) => {
  try {
    // Use service client for counts
    const [jobs, users, apps] = await Promise.all([
      supa.from('jobs').select('id', { count: 'exact', head: true }),
      supa.from('profiles').select('id', { count: 'exact', head: true }),
      supa.from('job_applications').select('id', { count: 'exact', head: true }),
    ]);

    if (jobs.error || users.error || apps.error) {
      console.error('admin/dashboard count errors:', { jobs: jobs.error, users: users.error, apps: apps.error });
      return res.status(500).json({ error: 'Failed to load counts' });
    }

    res.json({
      counts: {
        jobs: jobs.count ?? 0,
        users: users.count ?? 0,
        applications: apps.count ?? 0,
      },
    });
  } catch (e) {
    console.error('admin/dashboard error', e);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
