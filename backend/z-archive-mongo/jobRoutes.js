const express = require("express");
const router = express.Router();

const {
  postJob,
  searchJobs,
  seedJobs,
  updateJob,
  archiveJob,
  getRecruiterJobs,
} = require("../controllers/jobController");

const {
  verifyUserRole,
  checkJobOwnership,
} = require("../middleware/verifyUserRole");

/**
 * ✅ Public Route — Search Jobs
 * Accessible by all users
 */
router.get("/", searchJobs);

/**
 * ✅ Recruiter Dashboard — View Own Jobs
 * Accessible to recruiter and admin roles
 */
router.get(
  "/recruiter",
  verifyUserRole(["recruiter", "admin"]),
  getRecruiterJobs
);

/**
 * ✅ Post a New Job
 * Recruiters and admins only
 */
router.post(
  "/",
  verifyUserRole(["recruiter", "admin"]),
  postJob
);

/**
 * ✅ Seed Sample Jobs
 * Admin-only route
 */
router.post(
  "/seed",
  verifyUserRole("admin"),
  seedJobs
);

/**
 * ✅ Update Existing Job
 * Recruiters can only update their own jobs
 * Admins can override
 */
router.put(
  "/:jobId",
  verifyUserRole(["recruiter", "admin"]),
  checkJobOwnership,
  updateJob
);

/**
 * ✅ Archive Job (soft delete)
 * Same access logic as update
 */
router.put(
  "/:jobId/archive",
  verifyUserRole(["recruiter", "admin"]),
  checkJobOwnership,
  archiveJob
);

module.exports = router;
