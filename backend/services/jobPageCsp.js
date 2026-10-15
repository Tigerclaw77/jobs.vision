const helmet = require("helmet");

function authOrigin(authUrl) {
  if (!authUrl) return null;
  try {
    const url = new URL(authUrl);
    return url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}

function createJobPageCsp(authUrl = process.env.REACT_APP_NEON_AUTH_URL) {
  const neonAuthOrigin = authOrigin(authUrl);
  return helmet.contentSecurityPolicy({
    directives: {
      // The static web service has no CSP. These HTML responses pass through
      // Helmet, so explicitly permit the consent-gated browser integrations.
      "connect-src": [
        "'self'",
        "https://us.i.posthog.com",
        "https://www.google-analytics.com",
        "https://region1.google-analytics.com",
        ...(neonAuthOrigin ? [neonAuthOrigin] : []),
      ],
      "script-src": [
        "'self'",
        "https://us-assets.i.posthog.com",
        "https://www.googletagmanager.com",
      ],
      "img-src": [
        "'self'",
        "data:",
        "https://us.i.posthog.com",
        "https://www.google-analytics.com",
        "https://region1.google-analytics.com",
      ],
    },
  });
}

module.exports = { createJobPageCsp };
