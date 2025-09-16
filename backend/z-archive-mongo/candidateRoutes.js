const express = require("express");
const router = express.Router();

const User = require("../models/User");
const Job = require("../models/Job");

const { verifyUserRole } = require("../middleware/verifyUserRole");

/**
 * ✅ GET all job data (favorites, watchlist, applied jobs)
 * GET /api/candidate/job-data
 */
router.get("/job-data", verifyUserRole("candidate"), async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({
      favorites: user.savedJobs || [],  // or user.favoriteJobs if you rename
      // watchlistJobs: user.watchlistJobs || [],
      appliedJobs: user.appliedJobs || [],
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch user job data", error: error.message });
  }
});

/**
 * ✅ GET Watchlist Jobs
 * GET /api/candidate/watchlist
 */
// router.get("/watchlist", verifyUserRole("candidate"), async (req, res) => {
//   try {
//     const user = await User.findById(req.user.id).populate("watchlistJobs");
//     if (!user) return res.status(404).json({ message: "User not found" });

//     res.json(user.watchlistJobs);
//   } catch (error) {
//     res.status(500).json({ message: "Failed to fetch watchlist jobs", error: error.message });
//   }
// });

/**
 * ✅ Toggle Job in Watchlist
 * POST /api/candidate/watchlist/:jobId
 */
// router.post("/watchlist/:jobId", verifyUserRole("candidate"), async (req, res) => {
//   try {
//     const { jobId } = req.params;
//     const user = await User.findById(req.user.id);

//     if (!user) return res.status(404).json({ message: "User not found" });

//     const index = user.watchlistJobs.findIndex((id) => id.toString() === jobId);

//     if (index >= 0) {
//       user.watchlistJobs.splice(index, 1);
//     } else {
//       user.watchlistJobs.push(jobId);
//     }

//     await user.save();
//     res.json({ message: "Watchlist updated", watchlistJobs: user.watchlistJobs });
//   } catch (error) {
//     res.status(500).json({ message: "Failed to update watchlist", error: error.message });
//   }
// });

/**
 * ✅ Toggle Job in Favorites
 * POST /api/candidate/favorites/:jobId
 */
router.post("/favorites/:jobId", verifyUserRole("candidate"), async (req, res) => {
  try {
    const { jobId } = req.params;
    const user = await User.findById(req.user.id);

    if (!user) return res.status(404).json({ message: "User not found" });

    const index = user.savedJobs.findIndex((id) => id.toString() === jobId);

    if (index >= 0) {
      user.savedJobs.splice(index, 1);
    } else {
      user.savedJobs.push(jobId);
    }

    await user.save();
    res.json({ message: "Favorites updated", favorites: user.savedJobs });
  } catch (error) {
    res.status(500).json({ message: "Failed to update favorites", error: error.message });
  }
});

/**
 * ✅ Apply to a Job
 * POST /api/candidate/apply/:jobId
 */
router.post("/apply/:jobId", verifyUserRole("candidate"), async (req, res) => {
  try {
    const { jobId } = req.params;

    const user = await User.findById(req.user.id);
    const job = await Job.findById(jobId);

    if (!user || !job) {
      return res.status(404).json({ message: "User or job not found" });
    }

    if (user.appliedJobs.some((id) => id.toString() === jobId)) {
      return res.status(400).json({ message: "Already applied to this job." });
    }

    user.appliedJobs.push(jobId);
    await user.save();

    res.json({ message: "Successfully applied to the job", appliedJobs: user.appliedJobs });
  } catch (error) {
    res.status(500).json({ message: "Failed to apply to job", error: error.message });
  }
});

/**
 * ✅ Remove Job from Applied Jobs
 * DELETE /api/candidate/applied/:jobId
 */
router.delete("/applied/:jobId", verifyUserRole("candidate"), async (req, res) => {
  try {
    const { jobId } = req.params;

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.appliedJobs = user.appliedJobs.filter((id) => id.toString() !== jobId);
    await user.save();

    res.json({ message: "Removed job from applied jobs", appliedJobs: user.appliedJobs });
  } catch (error) {
    res.status(500).json({ message: "Failed to remove applied job", error: error.message });
  }
});

module.exports = router;
