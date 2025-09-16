// Minimal stub. Replace with Twilio/etc later.
module.exports = async function sendSMS({ to, message }) {
  console.log("📱 [stub] SMS to:", to, "| msg:", message);
  return { ok: true };
};
