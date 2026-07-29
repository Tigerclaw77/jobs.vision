const test = require("node:test");
const assert = require("node:assert/strict");
const { classifyJobPage } = require("../services/jobHealth/pageClassifier");
const {
  verifyExternalApplication,
} = require("../services/jobHealth/httpVerifier");
const {
  assertSafeExternalUrl,
  isBlockedIp,
} = require("../services/jobHealth/urlSafety");
const { nextVerificationAtFor } = require("../services/jobHealth/scheduler");

const PUBLIC_DNS = async () => [{ address: "93.184.216.34", family: 4 }];

test("blocks private and metadata-network destinations", () => {
  assert.equal(isBlockedIp("127.0.0.1"), true);
  assert.equal(isBlockedIp("10.0.0.10"), true);
  assert.equal(isBlockedIp("169.254.169.254"), true);
  assert.equal(isBlockedIp("192.168.1.5"), true);
  assert.equal(isBlockedIp("93.184.216.34"), false);
});

test("rejects direct loopback URLs before any request is made", async () => {
  await assert.rejects(
    () => assertSafeExternalUrl("http://[::1]/private"),
    (error) => error.code === "blocked_destination"
  );
});

test("classifies explicit filled and expired language", () => {
  const result = classifyJobPage({
    html: "<main><h1>This job posting has expired</h1></main>",
    title: "Optometrist",
    finalUrl: "https://example.com/jobs/123",
  });
  assert.equal(result.outcome, "hard_fail");
  assert.equal(result.reasonCodes[0], "posting_expired");
});

test("classifies a generic careers page that does not contain the job", () => {
  const result = classifyJobPage({
    html: "<main><h1>Careers at Example Eye Care</h1><a>Search all jobs</a></main>",
    title: "Optical Technician",
    location: "Austin, TX",
    finalUrl: "https://example.com/careers",
  });
  assert.equal(result.outcome, "soft_fail");
  assert.equal(result.reasonCodes[0], "generic_careers_page");
});

test("404 and 410 responses are hard failures", async () => {
  for (const status of [404, 410]) {
    const result = await verifyExternalApplication({
      job: {
        title: "Optometrist",
        external_apply_url: "https://example.com/jobs/123",
      },
      resolveHost: PUBLIC_DNS,
      fetchImpl: async () => new Response("gone", { status }),
    });
    assert.equal(result.check.outcome, "hard_fail");
    assert.equal(result.check.reasonCodes[0], `http_${status}`);
  }
});

test("detects redirect loops without following indefinitely", async () => {
  const result = await verifyExternalApplication({
    job: {
      title: "Optometrist",
      external_apply_url: "https://example.com/jobs/one",
    },
    resolveHost: PUBLIC_DNS,
    fetchImpl: async (url) =>
      new Response(null, {
        status: 302,
        headers: {
          location: url.endsWith("/one") ? "/jobs/two" : "/jobs/one",
        },
      }),
  });
  assert.equal(result.check.outcome, "hard_fail");
  assert.equal(result.check.reasonCodes[0], "redirect_loop");
});

test("dead domains are hard failures and transient DNS errors are inconclusive", async () => {
  const dead = await verifyExternalApplication({
    job: {
      title: "Optometrist",
      external_apply_url: "https://dead.example/jobs/1",
    },
    resolveHost: async () => {
      const error = new Error("not found");
      error.code = "ENOTFOUND";
      throw error;
    },
    fetchImpl: async () => {
      throw new Error("fetch should not run");
    },
  });
  assert.equal(dead.check.outcome, "hard_fail");
  assert.equal(dead.check.reasonCodes[0], "dead_domain");

  const transient = await verifyExternalApplication({
    job: {
      title: "Optometrist",
      external_apply_url: "https://slow.example/jobs/1",
    },
    resolveHost: async () => {
      const error = new Error("retry");
      error.code = "EAI_AGAIN";
      throw error;
    },
    fetchImpl: async () => {
      throw new Error("fetch should not run");
    },
  });
  assert.equal(transient.check.outcome, "inconclusive");
  assert.equal(transient.check.reasonCodes[0], "dns_inconclusive");
});

test("matching live job page passes URL and position verification", async () => {
  const result = await verifyExternalApplication({
    job: {
      title: "Optical Technician",
      location: "Austin, TX",
      external_apply_url: "https://example.com/jobs/optical-tech-austin",
    },
    resolveHost: PUBLIC_DNS,
    fetchImpl: async () =>
      new Response(
        "<main><h1>Optical Technician</h1><p>Join our Austin eye care team.</p></main>",
        { status: 200, headers: { "content-type": "text/html" } }
      ),
  });
  assert.equal(result.applicationDestination.outcome, "pass");
  assert.equal(result.specificPosition.outcome, "pass");
  assert.equal(result.check.outcome, "pass");
});

test("recheck timing follows configurable health policy", () => {
  const now = new Date("2026-07-29T12:00:00.000Z");
  const next = nextVerificationAtFor(
    "broken",
    { scheduleHours: { broken: 2 } },
    now
  );
  assert.equal(next, "2026-07-29T14:00:00.000Z");
});
