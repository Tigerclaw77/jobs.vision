import { trackMarketingConversion } from "./marketingAnalytics";

const events = new Set([
  "recruiter_page_view", "recruiter_pricing_view", "recruiter_registration_start",
  "sign_up", "recruiter_posting_start", "recruiter_posting_saved",
  "begin_checkout", "purchase",
]);
const sent = new Set();

// Only categorical, fixed properties are accepted by the shared analytics gate.
export function trackRecruiterEvent(name, properties = {}, onceKey = "") {
  if (!events.has(name)) return false;
  const key = onceKey ? `${name}:${onceKey}` : "";
  if (key && sent.has(key)) return false;
  const delivered = trackMarketingConversion(name, {
    audience: "recruiter",
    ...properties,
    ...(name === "sign_up" ? { method: "email" } : {}),
  });
  if (delivered && key) sent.add(key);
  return delivered;
}
