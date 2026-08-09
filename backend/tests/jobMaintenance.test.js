const test = require("node:test");
const assert = require("node:assert/strict");

process.env.DATABASE_URL ||= "postgres://test:test@127.0.0.1:5432/jobs_vision_test";

const {
  failureStateForResult,
  fetchForHealth,
  healthResultForStatus,
} = require("../services/jobMaintenance");

test("healthResultForStatus separates live, terminal, and uncertain responses", () => {
  assert.equal(healthResultForStatus(200), "healthy");
  assert.equal(healthResultForStatus(302), "healthy");
  assert.equal(healthResultForStatus(404), "terminal");
  assert.equal(healthResultForStatus(410), "terminal");
  assert.equal(healthResultForStatus(429), "error");
  assert.equal(healthResultForStatus(503), "error");
});

test("fetchForHealth uses HEAD as the cheap successful path", async () => {
  const methods = [];
  const result = await fetchForHealth("https://example.test/job", {
    fetchImpl: async (_url, options) => {
      methods.push(options.method);
      return { status: 200 };
    },
  });

  assert.deepEqual(methods, ["HEAD"]);
  assert.deepEqual(result, { result: "healthy", statusCode: 200, method: "HEAD" });
});

test("fetchForHealth confirms a failed HEAD with a bounded GET", async () => {
  const methods = [];
  const result = await fetchForHealth("https://example.test/job", {
    fetchImpl: async (_url, options) => {
      methods.push(options.method);
      if (options.method === "HEAD") return { status: 405 };
      return { status: 410, body: { cancel: async () => {} } };
    },
  });

  assert.deepEqual(methods, ["HEAD", "GET"]);
  assert.deepEqual(result, { result: "terminal", statusCode: 410, method: "GET" });
});

test("archiving requires two consecutive terminal checks", () => {
  assert.deepEqual(
    failureStateForResult(
      { health_status: "error", health_failure_count: 4 },
      { result: "terminal" }
    ),
    { failureCount: 1, shouldArchive: false }
  );
  assert.deepEqual(
    failureStateForResult(
      { health_status: "suspect", health_failure_count: 1 },
      { result: "terminal" }
    ),
    { failureCount: 2, shouldArchive: true }
  );
});
