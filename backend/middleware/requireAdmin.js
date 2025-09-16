// backend/middleware/requireAdmin.js
const { createClient } = require("@supabase/supabase-js");
const { supa, EXPECTED_ISSUER } = require("../services/supaClient");

// Public (anon) client just to verify the token
const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const pub = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

module.exports = function requireAdmin() {
  return async (req, res, next) => {
    try {
      const auth = req.headers.authorization || "";
      const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
      if (!token) return res.status(401).json({ error: "No token" });

      // 🔒 Reject tokens from wrong Supabase project (e.g., Aijin)
      try {
        const payload = JSON.parse(
          Buffer.from(token.split(".")[1] || "", "base64").toString("utf8") || "{}"
        );
        const iss = String(payload.iss || "").replace(/\/+$/, "");
        const expected = EXPECTED_ISSUER || `${SUPABASE_URL}/auth/v1`;
        if (iss !== expected) {
          return res.status(401).json({ error: "Wrong project token" });
        }
      } catch {
        return res.status(401).json({ error: "Malformed token" });
      }

      // Verify token (anon client)
      const {
        data: { user },
        error,
      } = await pub.auth.getUser(token);
      if (error || !user) return res.status(401).json({ error: "Invalid token" });

      // Check admin using SERVICE client (bypasses RLS)
      const { data: prof, error: pErr } = await supa
        .from("profiles")
        .select("id, email, role")
        .eq("id", user.id)
        .single();

      // Optional debug — remove after confirming
      // console.log("requireAdmin -> user:", user.id, "role:", prof?.role);

      if (pErr) return res.status(403).json({ error: "Profile lookup failed" });
      if (!prof || (prof.role || "").toLowerCase() !== "admin") {
        return res.status(403).json({ error: "Admin only" });
      }

      req.user = user;
      req.profile = prof;
      next();
    } catch (e) {
      console.error("requireAdmin error", e);
      res.status(500).json({ error: "Auth error" });
    }
  };
};
