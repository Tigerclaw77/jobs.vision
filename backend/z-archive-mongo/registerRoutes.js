// const express = require("express");
// const bcrypt = require("bcryptjs");
// const crypto = require("crypto");
// const nodemailer = require("nodemailer");
// const User = require("../models/User");

// const router = express.Router();

// // ✅ Configure Email Transporter (No need for test email on startup)
// const transporter = nodemailer.createTransport({
//   host: "smtp.aol.com", // ✅ AOL's SMTP Server
//   port: 465,
//   secure: true, // ✅ Use SSL
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASS,
//   },
// });

// router.post("/", async (req, res) => {
//   try {
//     const { firstName, lastName, email, password, userRole } = req.body;

//     if (!firstName || !lastName || !email || !password) {
//       return res.status(400).json({ message: "First name, last name, email, and password are required." });
//     }

//     const userExists = await User.findOne({ email });
//     if (userExists) {
//       return res.status(400).json({ message: "User already exists." });
//     }

//     const hashedPassword = await bcrypt.hash(password, 10);
//     const verificationToken = crypto.randomBytes(32).toString("hex");

//     const newUser = new User({
//       email,
//       password: hashedPassword,
//       userRole,
//       isVerified: false,
//       verificationToken,
//       profile: {
//         firstName,
//         lastName,
//         updatedAt: new Date(),
//       },
//     });

//     await newUser.save();
//     console.log("✅ User registered successfully:", newUser);

//     // ✅ Create verification link
//     const verificationLink = `http://localhost:3000/verify-email?token=${verificationToken}`;
//     console.log("📩 Sending verification email to:", email); // ✅ Log email being sent

//     const mailOptions = {
//       from: `"Opportometry" <${process.env.EMAIL_USER}>`,
//       to: email,
//       subject: "Verify Your Email",
//       html: `
//         <p>Welcome to Opportometry, ${firstName}!</p>
//         <p>Please verify your email by clicking the link below:</p>
//         <a href="${verificationLink}" target="_blank">Verify My Email</a>
//         <p>If you did not create an account, please ignore this email.</p>
//       `,
//     };

//     transporter.sendMail(mailOptions, (error, info) => {
//       if (error) {
//         console.error("🚨 Email Sending Error:", error);
//         return res.status(500).json({ message: "Error sending verification email." });
//       }
//       console.log("✅ Email sent successfully to:", email);
//     });

//     res.status(201).json({ message: "User registered successfully! Check your email for verification." });

//   } catch (error) {
//     console.error("🚨 Registration Error:", error);
//     res.status(500).json({ error: "Internal Server Error", details: error.message });
//   }
// });

// module.exports = router;


const express = require("express");
const router = express.Router();

const { registerUser } = require("../controllers/authController");

// ✅ Register Route (Public)
router.post("/", registerUser);

module.exports = router;
