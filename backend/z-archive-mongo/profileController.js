const User = require("../models/User");

// ✅ GET /api/profile
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("email userRole profile");
    if (!user) return res.status(404).json({ message: "User not found." });

    res.status(200).json({
      email: user.email,
      userRole: user.userRole,
      profile: user.profile,
    });
  } catch (err) {
    console.error("Get Profile Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ PUT /api/profile
const updateProfile = async (req, res) => {
  try {
    const updates = req.body; // Should match the shape of profile object
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found." });

    // Archive previous version
    await user.updateProfile(updates);

    res.status(200).json({
      message: "Profile updated successfully",
      profile: user.profile,
    });
  } catch (err) {
    console.error("Update Profile Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  getProfile,
  updateProfile,
};
