const User = require("../models/User");

// ✅ Get Admin Dashboard (basic example)
const getAdminDashboard = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({});
    const lockedUsers = await User.find({ failedLoginAttempts: { $gte: 5 } }).select("email failedLoginAttempts");

    res.status(200).json({
      message: "Admin Dashboard Data",
      totalUsers,
      lockedUsers,
    });
  } catch (error) {
    console.error("🚨 Admin Dashboard Error:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// ✅ Reset Failed Login Attempts (Admin Only)
const resetFailedLoginAttempts = async (req, res) => {
  const { email } = req.body;

  if (!email || !validateEmail(email)) {
    return res.status(400).json({ message: "A valid email is required." });
  }

  try {
    const user = await User.findOneAndUpdate(
      { email },
      { $set: { failedLoginAttempts: 0 } },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    console.log(`✅ Reset failed login attempts for ${user.email}`);

    res.status(200).json({
      message: `Failed login attempts reset for ${user.email}.`,
      user: {
        email: user.email,
        failedLoginAttempts: user.failedLoginAttempts,
      },
    });
  } catch (error) {
    console.error("🚨 Reset Failed Login Attempts Error:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// ✅ Helper function for email validation
function validateEmail(email) {
  const re = /^\S+@\S+\.\S+$/;
  return re.test(email);
}

module.exports = {
  getAdminDashboard,
  resetFailedLoginAttempts,
};
