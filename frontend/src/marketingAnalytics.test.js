jest.mock("posthog-js", () => ({
  __esModule: true,
  default: {
    init: jest.fn(),
    capture: jest.fn(),
    opt_in_capturing: jest.fn(),
    opt_out_capturing: jest.fn(),
    reset: jest.fn(),
  },
}));

function loadAnalytics() {
  let analytics;
  jest.isolateModules(() => { analytics = require("./marketingAnalytics"); });
  return analytics;
}

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  process.env.REACT_APP_POSTHOG_KEY = "phc_test_public_key";
  process.env.REACT_APP_POSTHOG_HOST = "https://us.i.posthog.com";
});

test("does not initialize or capture before consent and after decline", () => {
  const posthog = require("posthog-js").default;
  const analytics = loadAnalytics();
  analytics.initializeMarketingAnalytics();
  analytics.trackPageView("/jobs?email=private@example.com");
  analytics.trackMarketingConversion("job_search", { query: "private" });
  expect(posthog.init).not.toHaveBeenCalled();
  expect(posthog.capture).not.toHaveBeenCalled();
  analytics.setAnalyticsConsent("denied");
  expect(posthog.init).not.toHaveBeenCalled();
});

test("grants, revokes and grants consent again with sanitized events", () => {
  const posthog = require("posthog-js").default;
  const analytics = loadAnalytics();
  analytics.initializeMarketingAnalytics();
  analytics.setAnalyticsConsent("granted");
  expect(posthog.init).toHaveBeenCalledTimes(1);
  const config = posthog.init.mock.calls[0][1];
  expect(config).toMatchObject({
    autocapture: false, capture_pageview: false, capture_pageleave: false,
    enable_heatmaps: false, disable_session_recording: true,
  });
  analytics.trackPageView("/jobs/private-id/private-slug?email=private@example.com");
  expect(posthog.capture).toHaveBeenCalledWith("$pageview", {
    page_path: "/jobs/:listing",
    $current_url: `${window.location.origin}/jobs/:listing`,
  });
  const cleaned = config.before_send({
    event: "job_search",
    properties: { token: "public", distinct_id: "anonymous", query: "private", $ip: "192.0.2.1",
      $current_url: "https://jobs.vision/jobs?email=private@example.com" },
  });
  expect(cleaned.properties).toEqual({
    token: "public", distinct_id: "anonymous", $geoip_disable: true,
  });
  analytics.setAnalyticsConsent("denied");
  expect(posthog.opt_out_capturing).toHaveBeenCalledTimes(1);
  posthog.capture.mockClear();
  analytics.trackMarketingConversion("listing_viewed");
  expect(posthog.capture).not.toHaveBeenCalled();
  analytics.setAnalyticsConsent("granted");
  expect(posthog.opt_in_capturing).toHaveBeenCalledTimes(2);
  expect(posthog.init).toHaveBeenCalledTimes(1);
});
