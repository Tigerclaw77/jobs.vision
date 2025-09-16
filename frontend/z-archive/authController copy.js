const User = require("../models/User");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");

// ✅ Configure AOL Email Transport
const transporter = nodemailer.createTransport({
  host: "smtp.aol.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

transporter.verify((error, success) => {
  if (error) {
    console.error("🚨 Email setup error:", error);
  } else {
    console.log("✅ Email transporter is ready");
  }
});

// ✅ Register User & Send Verification Email
const registerUser = async (req, res) => {
  try {
    const { firstName, lastName, email, password, confirmPassword, userRole } = req.body;

    // ✅ Validate required fields
    if (!firstName || !lastName || !email || !password || !confirmPassword || !userRole) {
      return res.status(400).json({ message: "All fields are required." });
    }

    // ✅ Validate password match
    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match." });
    }

    // ✅ Validate password strength
    const passwordRegex = /^(?=.*\d)(?=.*[!@#$%^&*])[a-zA-Z\d!@#$%^&*]{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        message: "Password must be at least 8 characters long and include at least one number and one special character.",
      });
    }

    // ✅ Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "User already exists." });

    // ✅ Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // ✅ Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");

    // ✅ Create and save user
    const newUser = new User({
      email,
      password: hashedPassword,
      userRole,
      isVerified: false,
      verificationToken,
      profile: { firstName, lastName, updatedAt: new Date() },
    });

    await newUser.save();

    // ✅ Send verification email
    const verificationLink = `http://localhost:3000/verify-email?token=${verificationToken}`;
    await transporter.sendMail({
      from: `"Opportometry" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Verify Your Email",
      html: `
        <p>Welcome to Opportometry, ${firstName}!</p>
        <p>Please verify your email by clicking the link below:</p>
        <a href="${verificationLink}" target="_blank">Verify My Email</a>
        <p>If you did not create an account, please ignore this email.</p>
      `,
    });

    res.status(201).json({ message: "Registration successful! Check your email to verify your account." });

  } catch (error) {
    console.error("Registration Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// ✅ Verify Email
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;

    const user = await User.findOne({ verificationToken: token });
    if (!user) return res.status(400).json({ message: "Invalid or expired verification link." });

    user.isVerified = true;
    user.verificationToken = null;
    await user.save();

    res.status(200).json({ message: "Email verified successfully! You can now log in." });
  } catch (error) {
    console.error("Verification Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// ✅ Login User
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials." });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials." });

    if (!user.isVerified) {
      return res.status(403).json({ message: "Please verify your email before logging in." });
    }

    const token = jwt.sign(
      { userId: user.userID, userRole: user.userRole }, // ✅ UUID-based userID
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );    

    res.status(200).json({ message: "Login successful.", token });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
    console.log("🔐 JWT Payload:", { userId: user.userID, userRole: user.userRole });
  }
};

module.exports = {
  registerUser,
  loginUser,
  verifyEmail,
};
