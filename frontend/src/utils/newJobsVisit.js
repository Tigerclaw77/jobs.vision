const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export const NEW_JOBS_MIN_COUNT = 3;
export const LAST_VISIT_KEY = "jobsVision.lastVisitAt";
export const SESSION_NOTICE_KEY = "jobsVision.newJobsNoticeShown";

function safeRead(storage, key) {
  try {
    return storage?.getItem(key) || "";
  } catch {
    return "";
  }
}

function safeWrite(storage, key, value) {
  try {
    storage?.setItem(key, value);
  } catch {
    // Storage can be unavailable in privacy modes; the notice still works as a weekly signal.
  }
}

export function beginNewJobsVisit({ now = Date.now(), localStorage, sessionStorage } = {}) {
  if (safeRead(sessionStorage, SESSION_NOTICE_KEY) === "1") return null;

  safeWrite(sessionStorage, SESSION_NOTICE_KEY, "1");
  const previousVisit = safeRead(localStorage, LAST_VISIT_KEY);
  safeWrite(localStorage, LAST_VISIT_KEY, new Date(now).toISOString());

  const previousVisitMs = Date.parse(previousVisit);
  const hasUsableHistory =
    Number.isFinite(previousVisitMs) && previousVisitMs > 0 && previousVisitMs < now;
  const cutoffMs = hasUsableHistory ? previousVisitMs : now - WEEK_MS;

  return {
    cutoff: new Date(cutoffMs).toISOString(),
    mode: hasUsableHistory ? "returning" : "weekly",
  };
}

export function shouldShowNewJobs(count) {
  return Number.isFinite(Number(count)) && Number(count) >= NEW_JOBS_MIN_COUNT;
}

export function buildNewJobsHref(cutoff) {
  const params = new URLSearchParams({ publishedSince: cutoff, sort: "newest", page: "1" });
  return `/jobs?${params.toString()}`;
}

export function newJobsMessage(count, mode) {
  return mode === "returning"
    ? `${count} new jobs since your last visit`
    : `${count} new jobs added this week`;
}
