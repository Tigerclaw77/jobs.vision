const express = require("express");
const router = express.Router();
const User = require("../models/User");
const { verifyUserRole } = require("../middleware/verifyUserRole"); // Uses JWT-based auth

// ✅ GET /api/profile - Fetch profile of authenticated user
router.get("/", verifyUserRole(), async (req, res) => {
  console.log("✅ GET /api/profile hit");
  console.log("🔍 Looking for user _id:", req.user._id);

  try {
    const user = await User.findById(req.user._id).select("email userRole profile");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json({
      email: user.email,
      userRole: user.userRole,
      profile: user.profile,
    });
  } catch (error) {
    console.error("Get Profile Error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ PUT /api/profile - Update profile and archive previous version
router.put("/", verifyUserRole(), async (req, res) => {
  const updates = req.body;

  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Archive current profile
    if (user.profile) {
      user.profileHistory.push({
        profileData: { ...user.profile },
        archivedAt: new Date(),
      });
    }

    // Apply updates
    user.profile = { ...user.profile, ...updates, updatedAt: new Date() };
    await user.save();

    res.status(200).json({
      message: "Profile updated successfully",
      profile: user.profile,
    });
  } catch (error) {
    console.error("Update Profile Error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
