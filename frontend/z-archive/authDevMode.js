// authDevMode.js

const authDevMode = (req, res, next) => {
    // Only bypass authentication in development mode
    if (process.env.NODE_ENV === "development") {
      console.log("Dev Mode: Access granted to all routes."); // Log for development mode
      return next(); // Proceed to the next middleware (or route handler)
    }
  
    console.log("Dev Mode: Normal check."); // If not in dev mode, proceed with regular checks
    next(); // Continue to the next middleware (authentication, etc.)
  };
  
  module.exports = authDevMode;
  