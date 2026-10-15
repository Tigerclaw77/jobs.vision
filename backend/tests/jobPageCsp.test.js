const assert = require("node:assert/strict");
const test = require("node:test");
const { createJobPageCsp } = require("../services/jobPageCsp");

function policy(authUrl) {
  const headers = {};
  const response = { setHeader(name, value) { headers[name] = value; } };
  createJobPageCsp(authUrl)({}, response, () => {});
  return headers["Content-Security-Policy"];
}

test("job HTML permits consented PostHog delivery and preserves auth access", () => {
  const csp = policy("https://auth.example.neon.tech/api/auth");
  assert.match(csp, /connect-src 'self' https:\/\/us\.i\.posthog\.com/);
  assert.match(csp, /https:\/\/auth\.example\.neon\.tech/);
  assert.match(csp, /script-src 'self' https:\/\/us-assets\.i\.posthog\.com/);
  assert.match(csp, /https:\/\/www\.googletagmanager\.com/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /frame-ancestors 'self'/);
  assert.doesNotMatch(csp, /\*/);
});

test("untrusted auth URL cannot broaden job HTML connections", () => {
  const csp = policy("javascript:alert(1)");
  assert.doesNotMatch(csp, /alert/);
  assert.match(csp, /connect-src 'self' https:\/\/us\.i\.posthog\.com/);
});
