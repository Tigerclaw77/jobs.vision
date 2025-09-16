// const express = require("express");
// const bcrypt = require("bcryptjs");
// const crypto = require("crypto");
// const nodemailer = require("nodemailer");
// const User = require("../models/User");

// const router = express.Router(); // ✅ Ensure this is defined at the top

// // router.post("/", async (req, res) => {
// //   const { firstName, lastName, email, password, userRole } = req.body; // ✅ Expecting firstName & lastName separately

// //   // ✅ Ensure required fields are present
// //   if (!firstName || !lastName || !email || !password) {
// //     return res.status(400).json({ message: "First name, last name, email, and password are required." });
// //   }

// //   try {
// //     // ✅ Check if user already exists
// //     const userExists = await User.findOne({ email });
// //     if (userExists) {
// //       return res.status(400).json({ message: "User already exists." });
// //     }

// //     // ✅ Hash the password before storing
// //     const hashedPassword = await bcrypt.hash(password, 10);

// //     // ✅ Create new user with profile
// //     const newUser = new User({
// //       email,
// //       password: hashedPassword,
// //       userRole: userRole || "candidate",
// //       profile: {
// //         firstName,
// //         lastName,
// //         updatedAt: new Date(),
// //       },
// //     });

// //     await newUser.save();

// //     res.status(201).json({
// //       message: "User registered successfully!",
// //       userID: newUser.userID,
// //     });
// //   } catch (error) {
// //     console.error("Registration Error:", error);
// //     res.status(500).json({ error: "Internal Server Error", details: error.message });
// //   }
// // });

// // router.post("/", async (req, res) => {
// //   const { firstName, lastName, email, password, userRole } = req.body;

// //   if (!firstName || !lastName || !email || !password) {
// //     return res.status(400).json({ message: "First name, last name, email, and password are required." });
// //   }

// //   try {
// //     const userExists = await User.findOne({ email });
// //     if (userExists) {
// //       return res.status(400).json({ message: "User already exists." });
// //     }

// //     const hashedPassword = await bcrypt.hash(password, 10);
// //     const verificationToken = crypto.randomBytes(32).toString("hex");

// //     const newUser = new User({
// //       email,
// //       password: hashedPassword,
// //       userRole,
// //       isVerified: false,
// //       verificationToken,
// //       profile: {
// //         firstName,
// //         lastName,
// //         updatedAt: new Date(),
// //       },
// //     });

// //     await newUser.save();
// //     console.log("✅ User registered successfully:", newUser);

// //     // ✅ Send verification email
// //     const verificationLink = `http://localhost:3000/verify-email?token=${verificationToken}`;
// //     console.log("📩 Sending verification email to:", email); // ✅ Log email being sent

// //     await transporter.sendMail({
// //       from: process.env.EMAIL_USER,
// //       to: email,
// //       subject: "Verify Your Email",
// //       html: `<p>Click <a href="${verificationLink}">here</a> to verify your email.</p>`,
// //     });

// //     console.log("✅ Email sent successfully!");

// //     res.status(201).json({ message: "User registered successfully! Check your email for verification." });

// //   } catch (error) {
// //     console.error("🚨 Registration or Email Error:", error);
// //     res.status(500).json({ error: "Internal Server Error", details: error.message });
// //   }
// // });

// router.post("/", async (req, res) => {
//   const { firstName, lastName, email, password, userRole } = req.body;

//   if (!firstName || !lastName || !email || !password) {
//     return res.status(400).json({ message: "First name, last name, email, and password are required." });
//   }

//   try {
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

//     // const mailOptions = {
//     //   from: `"Opportometry" <${process.env.EMAIL_USER}>`, // ✅ Must match AOL email exactly
//     //   to: email, // ✅ Send to the registered user
//     //   subject: "Verify Your Email",
//     //   html: `
//     //     <p>Welcome to Opportometry, ${firstName}!</p>
//     //     <p>Please verify your email by clicking the link below:</p>
//     //     <a href="http://localhost:3000/verify-email?token=${verificationToken}" target="_blank">Verify My Email</a>
//     //     <p>If you did not create an account, please ignore this email.</p>
//     //   `,
//     // };    

//     transporter.sendMail(mailOptions, (error, info) => {
//       if (error) {
//         console.error("🚨 Email Sending Error:", error);
//         return res.status(500).json({ message: "Error sending verification email." });
//       }
//       console.log("✅ Email sent successfully! View it at:", nodemailer.getTestMessageUrl(info));
//     });

//     res.status(201).json({ message: "User registered successfully! Check your email for verification." });

//   } catch (error) {
//     console.error("🚨 Registration Error:", error);
//     res.status(500).json({ error: "Internal Server Error", details: error.message });
//   }
// });


// module.exports = router; // ✅ Ensure the router is exported
