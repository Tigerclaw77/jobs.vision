const jwt = require("jsonwebtoken");

/**
 * Admin Authentication Middleware
 * Verifies JWT and admin role.
 * Bypasses authentication in development mode.
 */
const adminAuth = (req, res, next) => {
  // ✅ Bypass authentication in development mode
  if (process.env.NODE_ENV === "development") {
    console.log("🔧 Dev mode: skipping adminAuth check");
    req.user = {
      _id: "67ccb98f866cbc48ae78d3e0", // Your MongoDB ObjectId for dev mode
      userRole: "admin",
    };
    return next();
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authorization token missing or invalid." });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.userRole !== "admin") {
      return res.status(403).json({ message: "Access denied. Admins only." });
    }

    req.user = decoded;

    console.log(`✅ Admin access granted to user: ${decoded._id}`);
    next();
  } catch (error) {
    console.error("🚨 Token verification failed:", error.message);
    return res.status(401).json({ message: "Invalid or expired token." });
  }
};

module.exports = adminAuth;
