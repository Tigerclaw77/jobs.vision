const jwt = require("jsonwebtoken");

// Secret key (must match your backend .env JWT_SECRET)
const JWT_SECRET = "your_jwt_secret"; // ✅ Replace with your actual secret!

// Create a payload with user info (you can adjust as needed)
const payload = {
  id: "admin-user-id", // ✅ Make this a real User _id from your DB if you want
  userRole: "admin",        // Change to "recruiter" or "candidate" to test
  recruiterType: "corporate", // Optional, based on your logic
  corporation: "luxottica"    // Optional, for recruiter testing
};

// Generate the token
const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });

console.log("✅ Your JWT Token:");
console.log(token);
