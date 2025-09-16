const express = require("express");
const router = express.Router();
const { billJobsMonthly } = require("../controllers/billingController");

const { verifyUserRole } = require("../middleware/verifyUserRole");

// Admin-only trigger (manual for now)
router.post("/monthly", verifyUserRole("admin"), billJobsMonthly);

module.exports = router;
