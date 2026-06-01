// backend/middleware/requireAdmin.js
const { one } = require("../services/db");
const { verifyNeonAuthToken } = require("../services/neonAuthVerifier");

module.exports = function requireAdmin() {
  return async (req, res, next) => {
    try {
      const auth = req.headers.authorization || "";
      const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;
      if (!token) return res.status(401).json({ error: "No token" });

      const user = await verifyNeonAuthToken(token);

      // Keep the existing database-backed admin source of truth.
      const prof = await one(
        "select id, email, role from public.profiles where id = $1",
        [user.id]
      );

      if (!prof || (prof.role || "").toLowerCase() !== "admin") {
        return res.status(403).json({ error: "Admin only" });
      }

      req.user = { ...user, role: prof.role };
      req.profile = prof;
      return next();
    } catch (e) {
      console.error("requireAdmin error", e);
      return res.status(401).json({ error: "Invalid token" });
    }
  };
};
