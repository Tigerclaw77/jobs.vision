// backend/services/supaClient.js
// Database access lives in backend/services/db.js. This optional client remains
// only for legacy Supabase Storage flows such as manual override attachments.

const { createClient } = require("@supabase/supabase-js");

const rawUrl = process.env.SUPABASE_URL;
const SUPABASE_URL = (rawUrl || "").replace(/\/+$/, "");
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

const supa =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
        db: { schema: "public" },
      })
    : null;

module.exports = { supa };
