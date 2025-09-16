const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Job = require("../models/Job");
const Favorite = require("../models/Favorite");
const Application = require("../models/Application");
const HiddenJob = require("../models/HiddenJob");
const { verifyUser, verifyUserRole } = require("../middleware/verifyUserRole");

// ✅ Admin-only route
router.get("/admin", verifyUserRole("admin"), (req, res) => {
  res.json({ message: "Welcome, Admin!" });
});

// ✅ Admin-only: fetch all users
router.get("/", verifyUserRole("admin"), async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ✅ Candidate-only route
router.get("/candidate", verifyUserRole("candidate"), (req, res) => {
  res.json({ message: "Welcome, Candidate!" });
});

// ✅ Recruiter-only route
router.get("/recruiter", verifyUserRole("recruiter"), (req, res) => {
  res.json({ message: "Welcome, Recruiter!" });
});

// ✅ Authenticated session route (used on login or refresh)
router.get("/me", verifyUser, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select("-password -resetToken -resetTokenExpires -verificationToken")
      .populate("savedJobs")
      .populate("appliedJobs");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const [favorites, applications, hiddenJobs] = await Promise.all([
      Favorite.find({ user: user._id }).select("job"),
      Application.find({ user: user._id }).select("job"),
      HiddenJob.find({ user: user._id }).select("job"),
    ]);

    const response = {
      user: {
        _id: user._id,
        email: user.email,
        userRole: user.userRole,
        tier: user.tier,
        profile: user.profile,
        savedJobs: favorites.map((f) => f.job.toString()),
        appliedJobs: applications.map((a) => a.job.toString()),
        hiddenJobs: hiddenJobs.map((h) => h.job.toString()),
      },
    };

    if (user.userRole === "recruiter") {
      const recruiterJobs = await Job.find({ createdBy: user._id });
      response.user.recruiterJobs = recruiterJobs;
    }

    res.status(200).json(response);
  } catch (err) {
    console.error("🚨 /me error:", err.message);
    res.status(500).json({ message: "Server error", details: err.message });
  }
});

// ✅ Job Interactions (favorites and applications only)
router.get("/interactions", verifyUser, async (req, res) => {
  try {
    const userId = req.user._id;
    const [favorites, applied] = await Promise.all([
      Favorite.find({ user: userId }).select("job"),
      Application.find({ user: userId }).select("job"),
    ]);

    res.json({
      favorites: favorites.map((f) => f.job.toString()),
      appliedJobs: applied.map((a) => a.job.toString()),
    });
  } catch (error) {
    console.error("Error fetching interactions:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ✅ Hidden Jobs — fetch all hidden job IDs
router.get("/hidden", verifyUser, async (req, res) => {
  try {
    const hiddenJobs = await HiddenJob.find({ user: req.user._id }).select("job");
    res.json(hiddenJobs.map((h) => h.job.toString()));
  } catch (err) {
    console.error("Failed to fetch hidden jobs:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Hide a Job
router.post("/hide/:jobId", verifyUser, async (req, res) => {
  try {
    const { jobId } = req.params;
    await HiddenJob.findOneAndUpdate(
      { user: req.user._id, job: jobId },
      { $setOnInsert: { user: req.user._id, job: jobId } },
      { upsert: true, new: true }
    );
    res.json({ message: "Job hidden" });
  } catch (err) {
    console.error("Failed to hide job:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Unhide a Job
router.delete("/hide/:jobId", verifyUser, async (req, res) => {
  try {
    const { jobId } = req.params;
    await HiddenJob.findOneAndDelete({ user: req.user._id, job: jobId });
    res.json({ message: "Job unhidden" });
  } catch (err) {
    console.error("Failed to unhide job:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
