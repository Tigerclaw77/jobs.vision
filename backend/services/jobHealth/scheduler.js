const { mergeJobHealthPolicy } = require("./policy");

function nextVerificationAtFor(healthStatus, policy, now = new Date()) {
  const merged = mergeJobHealthPolicy(policy);
  const hours = Number(
    merged.scheduleHours[healthStatus] ?? merged.scheduleHours.unknown ?? 1
  );
  return new Date(now.getTime() + Math.max(1, hours) * 3_600_000).toISOString();
}

module.exports = {
  nextVerificationAtFor,
};

