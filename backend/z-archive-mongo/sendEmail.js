// Minimal stub. Replace with nodemailer/SendGrid/etc later.
module.exports = async function sendEmail({ to, subject, text, html }) {
  console.log("✉️  [stub] Email to:", to, "| subject:", subject);
  return { ok: true };
};
