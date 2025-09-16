const express = require("express");
const router = express.Router();

const adminController = require("../controllers/adminController");
const { verifyUserRole } = require("../middleware/verifyUserRole");

// ✅ Admin Dashboard (Admins Only)
router.get("/dashboard", verifyUserRole("admin"), adminController.getAdminDashboard);

// ✅ Reset Failed Login Attempts (Admins Only)
router.post(
  "/reset-failed-attempts",
  verifyUserRole("admin"),
  adminController.resetFailedLoginAttempts
);

module.exports = router;
