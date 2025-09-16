const express = require("express");
const router = express.Router();

const Job = require("../models/Job");
const User = require("../models/User");

const { verifyUserRole } = require("../middleware/verifyUserRole"); // ✅ Import your new middleware

/**
 * ✅ Recommend Jobs Based on Saved Jobs & Applied Jobs
 * Candidates Only
 */
router.get("/recommend-jobs", verifyUserRole("candidate"), async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user || user.userRole !== "candidate") {
      return res.status(403).json({ message: "Unauthorized: Only candidates can access job recommendations." });
    }

    // Get roles of saved jobs
    const savedRoles = await Job.find({ _id: { $in: user.savedJobs } }).distinct("role");

    // Recommend similar jobs (limit 5)
    const recommendedJobs = await Job.find({ role: { $in: savedRoles } }).limit(5);

    res.json(recommendedJobs);
  } catch (error) {
    console.error("❌ Error fetching job recommendations:", error.message);
    res.status(500).json({ message: "Error fetching job recommendations", error: error.message });
  }
});

/**
 * ✅ Recommend Candidates Based on Job Post
 * Recruiters Only
 */
router.get("/recommend-candidates/:jobId", verifyUserRole("recruiter"), async (req, res) => {
  try {
    const job = await Job.findById(req.params.jobId);

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    // Find candidates who are interested in this role (example logic)
    const recommendedCandidates = await User.find({
      userRole: "candidate",
      interestedRoles: job.jobRole // assuming there's a field like this
    }).limit(5);

    res.json(recommendedCandidates);
  } catch (error) {
    console.error("❌ Error fetching candidate recommendations:", error.message);
    res.status(500).json({ message: "Error fetching candidate recommendations", error: error.message });
  }
});

/**
 * ✅ AI-Powered Recommendations (Premium Candidates Only)
 */
router.get("/recommend-jobs/ai", verifyUserRole("candidate"), async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (user.tier < 2) {
      return res.status(403).json({ message: "Upgrade required for AI-powered recommendations." });
    }

    // Placeholder response for AI recommendations (implement with Pinecone/OpenAI later)
    res.json({ message: "AI-powered recommendations coming soon!" });
  } catch (error) {
    console.error("❌ Error fetching AI recommendations:", error.message);
    res.status(500).json({ message: "Error fetching AI recommendations", error: error.message });
  }
});

module.exports = router;
