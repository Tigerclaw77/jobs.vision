const crypto = require("node:crypto");
const { assertSafeExternalUrl } = require("./urlSafety");
const { classifyJobPage } = require("./pageClassifier");

const VERIFIER_KEY = "external_application_http";
const VERIFIER_VERSION = "2026-07-29.1";
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_REDIRECTS = 5;
const DEFAULT_MAX_BODY_BYTES = 1_000_000;

function signal(outcome, confidence, reasonCodes = []) {
  return { outcome, confidence, reasonCodes };
}

async function readBodyLimited(response, maxBytes) {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    const error = new Error("Response body exceeds verification limit.");
    error.code = "response_too_large";
    throw error;
  }
  if (!response.body?.getReader) {
    const text = await response.text();
    if (Buffer.byteLength(text) > maxBytes) {
      const error = new Error("Response body exceeds verification limit.");
      error.code = "response_too_large";
      throw error;
    }
    return text;
  }

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      const error = new Error("Response body exceeds verification limit.");
      error.code = "response_too_large";
      throw error;
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function checkResultFromError(error, startedAt) {
  const outcome = error.outcome || "inconclusive";
  const confidence = outcome === "hard_fail" ? 92 : 35;
  return {
    applicationDestination: signal(outcome, confidence, [error.code || "verification_error"]),
    specificPosition: signal("unknown", 0),
    check: {
      verifierKey: VERIFIER_KEY,
      verifierVersion: VERIFIER_VERSION,
      outcome,
      confidenceScore: confidence,
      reasonCodes: [error.code || "verification_error"],
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt.getTime(),
      errorCode: error.code || "verification_error",
      errorDetail: String(error.message || error).slice(0, 500),
      signals: {},
    },
  };
}

async function verifyExternalApplication({
  job,
  fetchImpl = globalThis.fetch,
  resolveHost,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxRedirects = DEFAULT_MAX_REDIRECTS,
  maxBodyBytes = DEFAULT_MAX_BODY_BYTES,
} = {}) {
  const startedAt = new Date();
  const applyUrl = job?.external_apply_url || job?.apply_url || job?.source_url;
  if (!applyUrl) {
    const error = new Error("Job has no external application destination.");
    error.code = "missing_apply_url";
    error.outcome = "hard_fail";
    return checkResultFromError(error, startedAt);
  }
  if (typeof fetchImpl !== "function") {
    const error = new Error("Fetch is unavailable in this runtime.");
    error.code = "fetch_unavailable";
    return checkResultFromError(error, startedAt);
  }

  let currentUrl = applyUrl;
  const visited = new Set();
  let redirectCount = 0;

  try {
    while (true) {
      const safe = await assertSafeExternalUrl(currentUrl, { resolveHost });
      const normalizedUrl = safe.url.toString();
      if (visited.has(normalizedUrl)) {
        const error = new Error("Application URL entered a redirect loop.");
        error.code = "redirect_loop";
        error.outcome = "hard_fail";
        throw error;
      }
      visited.add(normalizedUrl);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let response;
      try {
        response = await fetchImpl(normalizedUrl, {
          method: "GET",
          redirect: "manual",
          signal: controller.signal,
          headers: {
            accept: "text/html,application/xhtml+xml,application/json;q=0.8,text/plain;q=0.7",
            "user-agent": "jobs.vision-job-health/1.0 (+https://www.jobs.vision)",
          },
        });
      } catch (cause) {
        const error = new Error(
          cause?.name === "AbortError"
            ? "Application URL verification timed out."
            : "Application URL could not be reached."
        );
        error.code = cause?.name === "AbortError" ? "request_timeout" : "connection_failed";
        error.outcome = "inconclusive";
        throw error;
      } finally {
        clearTimeout(timer);
      }

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) {
          const error = new Error("Redirect response has no destination.");
          error.code = "redirect_missing_location";
          error.outcome = "inconclusive";
          throw error;
        }
        redirectCount += 1;
        if (redirectCount > maxRedirects) {
          const error = new Error("Application URL exceeded the redirect limit.");
          error.code = "redirect_limit_exceeded";
          error.outcome = "hard_fail";
          throw error;
        }
        currentUrl = new URL(location, normalizedUrl).toString();
        continue;
      }

      const baseCheck = {
        verifierKey: VERIFIER_KEY,
        verifierVersion: VERIFIER_VERSION,
        startedAt: startedAt.toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt.getTime(),
        httpStatus: response.status,
        finalUrl: normalizedUrl,
        redirectCount,
        destinationDomain: safe.hostname,
      };

      if (response.status === 404 || response.status === 410) {
        const reasonCode = `http_${response.status}`;
        return {
          applicationDestination: signal("hard_fail", 99, [reasonCode]),
          specificPosition: signal("hard_fail", 90, [reasonCode]),
          check: {
            ...baseCheck,
            outcome: "hard_fail",
            confidenceScore: 99,
            reasonCodes: [reasonCode],
            signals: {},
          },
        };
      }

      if (
        response.status === 401 ||
        response.status === 403 ||
        response.status === 429 ||
        response.status >= 500
      ) {
        const reasonCode = `http_${response.status}`;
        return {
          applicationDestination: signal("inconclusive", 35, [reasonCode]),
          specificPosition: signal("unknown", 0),
          check: {
            ...baseCheck,
            outcome: "inconclusive",
            confidenceScore: 35,
            reasonCodes: [reasonCode],
            signals: {},
          },
        };
      }

      if (response.status < 200 || response.status >= 300) {
        const reasonCode = `http_${response.status}`;
        return {
          applicationDestination: signal("soft_fail", 65, [reasonCode]),
          specificPosition: signal("unknown", 0),
          check: {
            ...baseCheck,
            outcome: "soft_fail",
            confidenceScore: 65,
            reasonCodes: [reasonCode],
            signals: {},
          },
        };
      }

      let html;
      try {
        html = await readBodyLimited(response, maxBodyBytes);
      } catch (error) {
        error.outcome = "inconclusive";
        throw error;
      }
      const page = classifyJobPage({
        html,
        title: job.title,
        location: job.location,
        finalUrl: normalizedUrl,
      });
      const outcome =
        page.outcome === "hard_fail"
          ? "hard_fail"
          : page.outcome === "soft_fail"
          ? "soft_fail"
          : "pass";
      const reasonCodes = page.reasonCodes || [];

      return {
        applicationDestination:
          page.outcome === "hard_fail"
            ? signal("hard_fail", page.confidence, reasonCodes)
            : signal("pass", 95),
        specificPosition: {
          outcome: page.outcome,
          confidence: page.confidence,
          reasonCodes,
        },
        check: {
          ...baseCheck,
          outcome,
          confidenceScore: page.confidence,
          reasonCodes,
          signals: page.signals,
          contentHash: crypto.createHash("sha256").update(html).digest("hex"),
          evidenceExcerpt: page.evidenceExcerpt,
        },
      };
    }
  } catch (error) {
    return checkResultFromError(error, startedAt);
  }
}

module.exports = {
  DEFAULT_MAX_BODY_BYTES,
  DEFAULT_MAX_REDIRECTS,
  DEFAULT_TIMEOUT_MS,
  VERIFIER_KEY,
  VERIFIER_VERSION,
  readBodyLimited,
  verifyExternalApplication,
};

