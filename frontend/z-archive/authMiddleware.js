const jwt = require("jsonwebtoken");

const verifyUserRole = (requiredUserRole) => {
  return (req, res, next) => {
    console.log("🔹 authMiddleware executing...");
    console.log("🔹 NODE_ENV:", process.env.NODE_ENV);

    // ✅ Fully bypass authentication in development mode
    if (process.env.NODE_ENV === "development") {
      console.log("🟢 Development mode active: Skipping authentication.");
      req.user = { id: "dev-admin-id", userRole: "admin" }; // ✅ Auto-admin
      return next();
    }

    // Normal authentication for production
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      console.log("🔴 No token provided.");
      return res.status(403).json({ message: "Authentication token is required" });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.userRole !== requiredUserRole) {
        console.log(`🔴 Access denied. User role: ${decoded.userRole}, Required: ${requiredUserRole}`);
        return res.status(403).json({ message: `Access denied. Must be a ${requiredUserRole}.` });
      }
      req.user = decoded;
      next();
    } catch (error) {
      console.log("🔴 Invalid token.");
      res.status(401).json({ message: "Invalid or expired token." });
    }
  };
};

module.exports = verifyUserRole;
