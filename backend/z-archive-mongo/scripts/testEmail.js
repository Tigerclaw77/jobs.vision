require("dotenv").config();
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp.aol.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const mailOptions = {
  from: process.env.EMAIL_USER,
  to: "pauldriggers@aol.com", // ✅ Replace with your AOL email
  subject: "Test Email from Opportometry",
  text: "If you received this email, AOL SMTP is working correctly!",
};

transporter.sendMail(mailOptions, (error, info) => {
  if (error) {
    console.error("🚨 Error sending test email:", error);
  } else {
    console.log("✅ Test email sent successfully:", info.response);
  }
});
