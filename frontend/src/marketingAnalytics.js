import posthog from "posthog-js";

const CONSENT_KEY = "jobsvision.analytics.consent";
const HOST = "https://us.i.posthog.com";
const key = String(process.env.REACT_APP_POSTHOG_KEY || "").trim();
const host = String(process.env.REACT_APP_POSTHOG_HOST || HOST).trim().replace(/\/$/, "");
const gaId = String(process.env.REACT_APP_GA_MEASUREMENT_ID || "").trim();
const allowedEvents = new Set([
  "$pageview", "recruiter_page_view", "recruiter_pricing_view",
  "recruiter_registration_start", "sign_up", "recruiter_posting_start",
  "recruiter_posting_saved", "begin_checkout", "purchase",
  "job_search", "search_results_viewed", "listing_viewed", "application_link_clicked",
]);
const allowedProperties = new Set([
  "audience", "plan", "recruiter_type", "method", "page_path",
  "result_count_bucket", "destination_type", "value", "currency",
]);
let started = false;
let consent = "unset";
const listeners = new Set();

export function safePagePath(path) {
  const pathname = String(path || "/").split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  if (/^\/jobs\/[^/]+/.test(pathname)) return "/jobs/:listing";
  return new Set(["/", "/jobs", "/pricing", "/about", "/contact", "/terms", "/privacy", "/recruiter/register"])
    .has(pathname) ? pathname : "";
}

function safeProperties(properties = {}) {
  const clean = {};
  for (const [name, value] of Object.entries(properties)) {
    if (!allowedProperties.has(name)) continue;
    if (name === "page_path") {
      const path = safePagePath(value);
      if (path) clean.page_path = path;
    } else if (name === "audience" && ["recruiter", "job_seeker"].includes(value)) clean.audience = value;
    else if (name === "plan" && ["staff", "manager", "doctor"].includes(value)) clean.plan = value;
    else if (name === "recruiter_type" && ["independent", "corporate"].includes(value)) clean.recruiter_type = value;
    else if (name === "method" && value === "email") clean.method = value;
    else if (name === "destination_type" && ["external_url", "recruiter_email", "recruiter_website"].includes(value)) clean.destination_type = value;
    else if (name === "result_count_bucket" && ["0", "1-9", "10-49", "50+"].includes(value)) clean.result_count_bucket = value;
    else if (name === "value" && Number.isFinite(value) && value >= 0 && value <= 10000) clean.value = value;
    else if (name === "currency" && value === "USD") clean.currency = value;
  }
  return clean;
}

function sanitizePostHogEvent(event) {
  if (!event || !allowedEvents.has(event.event)) return null;
  const original = event.properties || {};
  const properties = safeProperties(original);
  // Keep only protocol fields required by PostHog. Browser, URL, referrer,
  // query, form, user and GeoIP fields are never forwarded.
  for (const field of ["token", "distinct_id", "$device_id", "$insert_id", "$lib", "$lib_version"]) {
    if (original[field] !== undefined) properties[field] = original[field];
  }
  properties.$geoip_disable = true;
  if (event.event === "$pageview" && properties.page_path) {
    properties.$current_url = `${window.location.origin}${properties.page_path}`;
  }
  return { ...event, properties };
}

function loadGa4() {
  if (!gaId || typeof document === "undefined" || document.getElementById("jobs-vision-ga4")) return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments); };
  const script = document.createElement("script");
  script.id = "jobs-vision-ga4";
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`;
  document.head.appendChild(script);
  window.gtag("js", new Date());
  window.gtag("config", gaId, { send_page_view: false });
}

function start() {
  if (consent !== "granted" || typeof window === "undefined") return;
  if (key && !started) {
    posthog.init(key, {
      api_host: host,
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      capture_exceptions: false,
      capture_performance: false,
      enable_heatmaps: false,
      disable_session_recording: true,
      enable_recording_console_log: false,
      mask_all_element_attributes: true,
      person_profiles: "identified_only",
      persistence: "memory",
      before_send: sanitizePostHogEvent,
    });
    started = true;
  }
  if (started) posthog.opt_in_capturing();
  loadGa4();
}

export function getAnalyticsConsent() { return consent; }
export function subscribeAnalyticsConsent(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function setAnalyticsConsent(next) {
  if (!["granted", "denied"].includes(next)) return;
  consent = next;
  try { window.localStorage.setItem(CONSENT_KEY, next); } catch {}
  if (next === "granted") start();
  else {
    if (started) { posthog.opt_out_capturing(); posthog.reset(); }
    if (window.gtag) window.gtag("consent", "update", { analytics_storage: "denied" });
  }
  listeners.forEach((listener) => listener(consent));
}
export function initializeMarketingAnalytics() {
  if (typeof window === "undefined") return;
  try { consent = window.localStorage.getItem(CONSENT_KEY) === "granted" ? "granted" :
    window.localStorage.getItem(CONSENT_KEY) === "denied" ? "denied" : "unset"; } catch { consent = "unset"; }
  if (consent === "granted") start();
}
export function trackPageView(path) {
  if (consent !== "granted" || typeof window === "undefined") return;
  const page_path = safePagePath(path || window.location.pathname);
  if (!page_path) return;
  if (window.gtag && gaId) window.gtag("event", "page_view", { page_path, page_location: `${window.location.origin}${page_path}` });
  if (started) posthog.capture("$pageview", { page_path, $current_url: `${window.location.origin}${page_path}` });
}
export function trackMarketingConversion(eventName, properties = {}) {
  if (consent !== "granted" || !allowedEvents.has(eventName)) return false;
  const safe = safeProperties(properties);
  if (window.gtag && gaId) window.gtag("event", eventName, safe);
  if (started) posthog.capture(eventName, safe);
  return Boolean(started || (window.gtag && gaId));
}
