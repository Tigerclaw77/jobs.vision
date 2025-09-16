// // const mongoose = require("mongoose");
// // const User = require("../models/User");
// // console.log("🧪 Mongoose model keys:", mongoose.modelNames());
// // console.log("🧩 User model path:", require.resolve("../models/User"));

// // const bcrypt = require("bcryptjs");
// // const jwt = require("jsonwebtoken");
// // const crypto = require("crypto");
// // const nodemailer = require("nodemailer");

// // // ✅ Configure Nodemailer Transporter
// // const transporter = nodemailer.createTransport({
// //   host: "smtp.aol.com",
// //   port: 465,
// //   secure: true,
// //   auth: {
// //     user: process.env.EMAIL_USER,
// //     pass: process.env.EMAIL_PASS,
// //   },
// // });

// // /**
// //  * ✅ Register User
// //  */
// // const registerUser = async (req, res) => {
// //   try {
// //     const { firstName, lastName, email, password, userRole, tier = "free" } = req.body; // 🔄 include tier

// //     if (!firstName || !lastName || !email || !password || !userRole) {
// //       return res.status(400).json({
// //         message: "First name, last name, email, password, and role are required.",
// //       });
// //     }

// //     const userExists = await User.findOne({ email });
// //     if (userExists) {
// //       return res.status(400).json({ message: "User already exists." });
// //     }

// //     const verificationToken = crypto.randomBytes(32).toString("hex");

// //     const newUser = new User({
// //       email,
// //       password,
// //       userRole,
// //       tier, // ✅ Tier assigned on registration
// //       isVerified: false,
// //       verificationToken,
// //       profile: {
// //         firstName,
// //         lastName,
// //         updatedAt: new Date(),
// //       },
// //     });

// //     await newUser.save();
// //     console.log("✅ Registered user:", newUser.email);

// //     const verificationLink = `http://localhost:3000/verify-email?token=${verificationToken}`;

// //     await transporter.sendMail({
// //       from: `"Opportometry" <${process.env.EMAIL_USER}>`,
// //       to: email,
// //       subject: "Verify Your Email",
// //       html: `
// //         <p>Welcome to Opportometry, ${firstName}!</p>
// //         <p>Please verify your email by clicking the link below:</p>
// //         <a href="${verificationLink}">Verify My Email</a>
// //       `,
// //     });

// //     return res.status(201).json({
// //       message: "User registered successfully! Check your email for verification.",
// //     });
// //   } catch (error) {
// //     console.error("🚨 Registration Error:", error.message);
// //     return res.status(500).json({ message: "Internal Server Error", details: error.message });
// //   }
// // };

// // /**
// //  * ✅ Login User
// //  */
// // const loginUser = async (req, res) => {
// //   try {
// //     const { email, password } = req.body;
// //     console.log("🔍 Login attempt for:", email);

// //     if (!email || !password) {
// //       return res.status(400).json({ message: "Email and password are required." });
// //     }

// //     const user = await User.findOne({ email });
// //     if (!user) {
// //       return res.status(400).json({ message: "Invalid email/password combination." });
// //     }

// //     const isMatch = await bcrypt.compare(password, user.password);
// //     if (!isMatch) {
// //       return res.status(400).json({ message: "Invalid email/password combination." });
// //     }

// //     if (!user.isVerified) {
// //       return res.status(403).json({ message: "Please verify your email." });
// //     }

// //     // ✅ Include user tier and role in JWT
// //     const token = jwt.sign(
// //       {
// //         _id: user._id.toString(),
// //         userRole: user.userRole,
// //         tier: user.tier, // 🔄
// //       },
// //       process.env.JWT_SECRET,
// //       { expiresIn: "3h" }
// //     );

// //     const safeUser = {
// //       _id: user._id,
// //       email: user.email,
// //       userRole: user.userRole,
// //       tier: user.tier, // ✅ expose tier to frontend
// //       profile: user.profile,
// //     };

// //     return res.status(200).json({
// //       token,
// //       userRole: user.userRole,
// //       tier: user.tier,
// //       redirect: "/recruiter/dashboard",
// //       user: safeUser,
// //     });
// //   } catch (error) {
// //     console.error("🚨 Login error:", error);
// //     return res.status(500).json({ message: "Internal server error" });
// //   }
// // };

// // /**
// //  * ✅ Forgot Password
// //  */
// // const forgotPassword = async (req, res) => {
// //   try {
// //     const { email } = req.body;
// //     if (!email) return res.status(400).json({ message: "Email is required." });

// //     const user = await User.findOne({ email });
// //     if (!user) {
// //       return res.status(200).json({ message: "If an account exists, a reset link will be sent." });
// //     }

// //     const resetToken = crypto.randomBytes(32).toString("hex");
// //     user.resetToken = resetToken;
// //     user.resetTokenExpires = Date.now() + 3600000; // 1 hour
// //     await user.save();

// //     const resetLink = `http://localhost:3000/reset-password?token=${resetToken}`;

// //     await transporter.sendMail({
// //       from: `"Opportometry" <${process.env.EMAIL_USER}>`,
// //       to: email,
// //       subject: "Reset Your Password",
// //       html: `
// //         <p>You requested a password reset.</p>
// //         <p>Click <a href="${resetLink}">here</a> to reset your password. This link expires in 1 hour.</p>
// //       `,
// //     });

// //     return res.status(200).json({ message: "If an account exists, a reset link will be sent." });
// //   } catch (error) {
// //     console.error("🚨 Forgot Password Error:", error.message);
// //     return res.status(500).json({ message: "Internal Server Error" });
// //   }
// // };

// // /**
// //  * ✅ Reset Password
// //  */
// // const resetPassword = async (req, res) => {
// //   try {
// //     const { token, newPassword } = req.body;

// //     if (!token || !newPassword) {
// //       return res.status(400).json({ message: "Token and new password are required." });
// //     }

// //     const user = await User.findOne({ resetToken: token });
// //     if (!user) {
// //       return res.status(400).json({ message: "Invalid reset token." });
// //     }

// //     if (user.resetTokenExpires.getTime() < Date.now()) {
// //       return res.status(400).json({ message: "Expired reset token." });
// //     }

// //     user.password = newPassword;
// //     user.resetToken = null;
// //     user.resetTokenExpires = null;
// //     await user.save();

// //     console.log(`✅ Password reset successful for ${user.email}`);
// //     return res.status(200).json({ message: "Password reset successfully. You can now log in." });
// //   } catch (error) {
// //     console.error("🚨 Reset Password Error:", error.message);
// //     return res.status(500).json({ message: "Internal Server Error" });
// //   }
// // };

// // // ✅ Export Controllers
// // module.exports = {
// //   registerUser,
// //   loginUser,
// //   forgotPassword,
// //   resetPassword,
// // };

// const mongoose = require("mongoose");
// const User = require("../models/User");
// console.log("🧪 Mongoose model keys:", mongoose.modelNames());
// console.log("🧩 User model path:", require.resolve("../models/User"));

// const bcrypt = require("bcryptjs");
// const jwt = require("jsonwebtoken");
// const crypto = require("crypto");
// const nodemailer = require("nodemailer");

// // ✅ Configure Nodemailer Transporter
// const transporter = nodemailer.createTransport({
//   host: "smtp.aol.com",
//   port: 465,
//   secure: true,
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASS,
//   },
// });

// /**
//  * ✅ Register User
//  */
// const registerUser = async (req, res) => {
//   try {
//     const { firstName, lastName, email, password, userRole, tier = "free" } = req.body;

//     if (!firstName || !lastName || !email || !password || !userRole) {
//       return res.status(400).json({
//         message: "First name, last name, email, password, and role are required.",
//       });
//     }

//     const userExists = await User.findOne({ email });
//     if (userExists) {
//       return res.status(400).json({ message: "User already exists." });
//     }

//     const verificationToken = crypto.randomBytes(32).toString("hex");

//     const newUser = new User({
//       email,
//       password,
//       userRole,
//       tier,
//       isVerified: false,
//       verificationToken,
//       profile: {
//         firstName,
//         lastName,
//         updatedAt: new Date(),
//       },
//     });

//     await newUser.save();
//     console.log("✅ Registered user:", newUser.email);

//     const verificationLink = `http://localhost:3000/verify-email?token=${verificationToken}`;

//     await transporter.sendMail({
//       from: `"Opportometry" <${process.env.EMAIL_USER}>`,
//       to: email,
//       subject: "Verify Your Email",
//       html: `
//         <p>Welcome to Opportometry, ${firstName}!</p>
//         <p>Please verify your email by clicking the link below:</p>
//         <a href="${verificationLink}">Verify My Email</a>
//       `,
//     });

//     return res.status(201).json({
//       message: "User registered successfully! Check your email for verification.",
//     });
//   } catch (error) {
//     console.error("🚨 Registration Error:", error.message);
//     return res.status(500).json({ message: "Internal Server Error", details: error.message });
//   }
// };

// /**
//  * ✅ Login User
//  */
// const loginUser = async (req, res) => {
//   try {
//     const { email, password } = req.body;
//     console.log("🛂 Login route hit with email:", email);

//     if (!email || !password) {
//       return res.status(400).json({ message: "Email and password are required." });
//     }

//     const user = await User.findOne({ email });

//     if (!user) {
//       console.log("⛔ No user found with that email:", email);
//       return res.status(400).json({ message: "Invalid email/password combination." });
//     }

//     const isMatch = await bcrypt.compare(password, user.password);

//     if (!isMatch) {
//       console.log("🔒 Password mismatch for:", email);
//       return res.status(400).json({ message: "Invalid email/password combination." });
//     }

//     console.log("✅ User found. Email:", user.email);
//     console.log("🔍 isVerified value:", user.isVerified, " (type:", typeof user.isVerified, ")");

//     if (!user.isVerified) {
//       console.log("🚫 Blocking unverified user:", email);
//       return res.status(403).json({ message: "Please verify your email." });
//     }

//     // ✅ Create JWT with role/tier
//     const token = jwt.sign(
//       {
//         _id: user._id.toString(),
//         userRole: user.userRole,
//         tier: user.tier,
//       },
//       process.env.JWT_SECRET,
//       { expiresIn: "3h" }
//     );

//     const safeUser = {
//   _id: user._id,
//   email: user.email,
//   userRole: user.userRole,
//   tier: user.tier,
//   profile: user.profile,
//   isVerified: user.isVerified, // ✅ Add this back
// };


//     return res.status(200).json({
//       token,
//       userRole: user.userRole,
//       tier: user.tier,
//       redirect: "/recruiter/dashboard",
//       user: safeUser,
//     });
//   } catch (error) {
//     console.error("🚨 Login error:", error);
//     return res.status(500).json({ message: "Internal server error" });
//   }
// };

// /**
//  * ✅ Forgot Password
//  */
// const forgotPassword = async (req, res) => {
//   try {
//     const { email } = req.body;
//     if (!email) return res.status(400).json({ message: "Email is required." });

//     const user = await User.findOne({ email });
//     if (!user) {
//       return res.status(200).json({ message: "If an account exists, a reset link will be sent." });
//     }

//     const resetToken = crypto.randomBytes(32).toString("hex");
//     user.resetToken = resetToken;
//     user.resetTokenExpires = Date.now() + 3600000; // 1 hour
//     await user.save();

//     const resetLink = `http://localhost:3000/reset-password?token=${resetToken}`;

//     await transporter.sendMail({
//       from: `"Opportometry" <${process.env.EMAIL_USER}>`,
//       to: email,
//       subject: "Reset Your Password",
//       html: `
//         <p>You requested a password reset.</p>
//         <p>Click <a href="${resetLink}">here</a> to reset your password. This link expires in 1 hour.</p>
//       `,
//     });

//     return res.status(200).json({ message: "If an account exists, a reset link will be sent." });
//   } catch (error) {
//     console.error("🚨 Forgot Password Error:", error.message);
//     return res.status(500).json({ message: "Internal Server Error" });
//   }
// };

// /**
//  * ✅ Reset Password
//  */
// const resetPassword = async (req, res) => {
//   try {
//     const { token, newPassword } = req.body;

//     if (!token || !newPassword) {
//       return res.status(400).json({ message: "Token and new password are required." });
//     }

//     const user = await User.findOne({ resetToken: token });
//     if (!user) {
//       return res.status(400).json({ message: "Invalid reset token." });
//     }

//     if (user.resetTokenExpires.getTime() < Date.now()) {
//       return res.status(400).json({ message: "Expired reset token." });
//     }

//     user.password = newPassword;
//     user.resetToken = null;
//     user.resetTokenExpires = null;
//     await user.save();

//     console.log(`✅ Password reset successful for ${user.email}`);
//     return res.status(200).json({ message: "Password reset successfully. You can now log in." });
//   } catch (error) {
//     console.error("🚨 Reset Password Error:", error.message);
//     return res.status(500).json({ message: "Internal Server Error" });
//   }
// };

// // ✅ Export Controllers
// module.exports = {
//   registerUser,
//   loginUser,
//   forgotPassword,
//   resetPassword,
// };
