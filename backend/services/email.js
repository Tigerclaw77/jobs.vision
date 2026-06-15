const nodemailer = require("nodemailer");

const DEFAULT_SMTP_HOST = "smtp.resend.com";
const DEFAULT_SMTP_PORT = 465;
const DEFAULT_SMTP_USER = "resend";
const DEFAULT_SMTP_FROM = "no-reply@jobs.vision";

function getEmailConfig() {
  const port = Number(process.env.SMTP_PORT || DEFAULT_SMTP_PORT);
  const secure =
    String(process.env.SMTP_SECURE || "").toLowerCase() === "true" ||
    (!process.env.SMTP_SECURE && port === DEFAULT_SMTP_PORT) ||
    port === 465;
  const pass = process.env.SMTP_PASS || process.env.RESEND_API_KEY || "";

  return {
    host: process.env.SMTP_HOST || DEFAULT_SMTP_HOST,
    port,
    secure,
    user: process.env.SMTP_USER || DEFAULT_SMTP_USER,
    pass,
    from: process.env.SMTP_FROM || DEFAULT_SMTP_FROM,
  };
}

function hasSmtpConfig() {
  const config = getEmailConfig();
  return Boolean(config.host && config.port && config.user && config.pass && config.from);
}

function createTransport() {
  const config = getEmailConfig();

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });
}

async function sendEmail({ to, subject, text, html }) {
  if (!to) return { sent: false, skipped: true, reason: "missing-recipient" };

  if (!hasSmtpConfig()) {
    console.warn("[mail] SMTP not configured; skipping email:", subject, "to:", to);
    return { sent: false, skipped: true, reason: "smtp-not-configured" };
  }

  const config = getEmailConfig();
  const transport = createTransport();
  const info = await transport.sendMail({
    from: config.from,
    to,
    subject,
    text,
    html,
  });

  return {
    sent: true,
    from: config.from,
    messageId: info.messageId || null,
    accepted: info.accepted || [],
    rejected: info.rejected || [],
    response: info.response || null,
  };
}

module.exports = { getEmailConfig, hasSmtpConfig, sendEmail };
