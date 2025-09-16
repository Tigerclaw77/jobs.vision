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

/**
 * Send a verification email to a new user
 */
exports.sendVerificationEmail = async (toEmail, firstName, verificationLink) => {
  const mailOptions = {
    from: `"Opportometry" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: "Verify Your Email - Opportometry",
    html: `
      <p>Welcome to Opportometry, ${firstName}!</p>
      <p>Please verify your email by clicking the link below:</p>
      <a href="${verificationLink}" target="_blank">Verify My Email</a>
      <p>If you did not create an account, you can ignore this message.</p>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Verification email sent to ${toEmail}:`, info.response);
  } catch (error) {
    console.error(`🚨 Error sending email to ${toEmail}:`, error.message);
    throw new Error("Failed to send verification email.");
  }
};
