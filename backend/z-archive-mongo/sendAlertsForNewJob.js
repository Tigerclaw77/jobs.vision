const User = require("../models/User");
const sendEmail = require("../utils/sendEmail");
const sendSMS = require("../utils/sendSMS"); // Implement this as needed

const haversineDistance = (coords1, coords2) => {
  const toRad = (val) => (val * Math.PI) / 180;
  const R = 3958.8; // miles
  const dLat = toRad(coords2.lat - coords1.lat);
  const dLon = toRad(coords2.lng - coords1.lng);
  const lat1 = toRad(coords1.lat);
  const lat2 = toRad(coords2.lat);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

module.exports = async function sendAlertsForNewJob(job) {
  const candidates = await User.find({
    userRole: "candidate",
    tier: { $in: ["paid", "premium"] },
    "alertPreferences.keywords": { $exists: true, $not: { $size: 0 } },
    "alertPreferences.radiusMiles": { $gt: 0 },
    "alertPreferences.location.coordinates": { $exists: true },
  });

  for (const user of candidates) {
    const prefs = user.alertPreferences || {};
    const keywords = prefs.keywords.map(k => k.toLowerCase());
    const jobMatchesKeyword = keywords.some(kw =>
      job.title.toLowerCase().includes(kw) ||
      job.description.toLowerCase().includes(kw) ||
      job.company.toLowerCase().includes(kw)
    );

    const jobCoords = job.location.coordinates;
    const userCoords = prefs.location?.coordinates;
    const radius = prefs.radiusMiles;

    const distance = userCoords && jobCoords
      ? haversineDistance(userCoords, jobCoords)
      : Infinity;

    const recentlyAlerted =
      user.lastAlertSent &&
      Date.now() - new Date(user.lastAlertSent).getTime() < 6 * 60 * 60 * 1000; // 6 hrs

    if (jobMatchesKeyword && distance <= radius && !recentlyAlerted) {
      if (prefs.sendEmail && user.email) {
        await sendEmail({
          to: user.email,
          subject: `New Job Match: ${job.title}`,
          text: `A new job was posted: ${job.title} at ${job.company}\nView it here: https://yourdomain.com/jobs/${job._id}`,
        });
      }

      if (prefs.sendSMS && user.profile?.phone) {
        await sendSMS({
          to: user.profile.phone,
          message: `New job match: ${job.title} at ${job.company}.`,
        });
      }

      user.lastAlertSent = new Date();
      await user.save();
    }
  }
};
