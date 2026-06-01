const nodemailer = require("nodemailer");

function hasSmtpConfig() {
  return Boolean(process.env.SMTP_HOST && (process.env.SMTP_FROM || process.env.SMTP_USER));
}

function createTransport() {
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || "").toLowerCase() === "true" || port === 465;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: process.env.SMTP_USER
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS || "",
        }
      : undefined,
  });
}

async function sendEmail({ to, subject, text, html }) {
  if (!to) return { sent: false, skipped: true, reason: "missing-recipient" };

  if (!hasSmtpConfig()) {
    console.warn("[mail] SMTP not configured; skipping email:", subject, "to:", to);
    return { sent: false, skipped: true, reason: "smtp-not-configured" };
  }

  const transport = createTransport();
  await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
    html,
  });

  return { sent: true };
}

module.exports = { sendEmail };
