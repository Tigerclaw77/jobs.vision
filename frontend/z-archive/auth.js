// const jwt = require("jsonwebtoken");
// const Job = require("../models/Job"); // Import the Job model
// require("dotenv").config(); // Ensure .env variables are available

// /**
//  * Middleware to authenticate user via JWT
//  */
// const authenticateUser = (req, res, next) => {
//   try {
//     const token = req.header("Authorization")?.replace("Bearer ", "");
//     if (!token) {
//       return res.status(401).json({ message: "No token provided" });
//     }

//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     req.user = decoded; // Attach user details to request object
//     next();
//   } catch (error) {
//     res.status(401).json({ message: "Invalid or expired token" });
//   }
// };

// /**
//  * Middleware to authorize specific user roles (e.g., only recruiters can post/edit jobs)
//  
// const authorizeUserRoles = (allowedUserRoles) => (req, res, next) => {
//   if (!req.user || !allowedUserRoles.includes(req.user.userRole)) {
//     return res.status(403).json({ message: "Access denied: Unauthorized user role" });
//   }
//   next();
// };

// /**
//  * Middleware to check if the authenticated recruiter owns the job
//  */
// const checkJobOwnership = async (req, res, next) => {
//   try {
//     const job = await Job.findById(req.params.jobId);
//     if (!job) {
//       return res.status(404).json({ message: "Job not found" });
//     }

//     // Ensure the logged-in recruiter owns the job
//     if (job.recruiterId.toString() !== req.user.id) {
//       return res.status(403).json({ message: "Unauthorized: You do not own this job" });
//     }

//     next(); // Allow request to proceed
//   } catch (error) {
//     res.status(500).json({ message: "Server error" });
//   }
// };

// module.exports = {
//   authenticateUser,
//   authorizeUserRoles,
//   checkJobOwnership,
// };

const jwt = require("jsonwebtoken");
const Job = require("../models/Job");
require("dotenv").config();

/**
 * Middleware to authenticate user via JWT
 */
const authenticateUser = (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ message: "Authentication token is required" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Attach user details to request object
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ message: "Token has expired" });
    }
    res.status(401).json({ message: "Invalid or expired token" });
  }
};

/**
 * Middleware to authorize specific user roles (e.g., only recruiters can post/edit jobs)
 */
const authorizeUserRoles = (allowedUserRoles) => (req, res, next) => {
  if (!req.user || !allowedUserRoles.includes(req.user.userRole)) {
    return res.status(403).json({ message: "Access denied: Unauthorized user role" });
  }
  next();
};

/**
 * Middleware to check if the authenticated recruiter owns the job
 */
const checkJobOwnership = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.jobId);
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    // Ensure the logged-in recruiter owns the job
    if (job.recruiterId.toString() !== req.user.id) {
      return res.status(403).json({ message: "Unauthorized: You do not own this job" });
    }

    next(); // Allow request to proceed
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  authenticateUser,
  authorizeUserRoles,
  checkJobOwnership,
};
