const test = require("node:test");
const assert = require("node:assert/strict");
const {
  descriptionFingerprint,
  evaluateImportQuality,
  malformedHtmlSignals,
} = require("../services/jobImportQuality");

const GOOD_DESCRIPTION = `
  <article>
    <h1>Optical Technician</h1>
    <p>Support patients, prepare exam rooms, and work with an experienced eye care team.</p>
    <p>This full-time role includes training, benefits, and a predictable weekday schedule.</p>
  </article>
`;

test("passes a complete import with a valid application URL", () => {
  const quality = evaluateImportQuality({
    description: GOOD_DESCRIPTION,
    applyUrl: "https://example.com/jobs/optical-technician",
  });
  assert.equal(quality.status, "passed");
  assert.equal(quality.score, 100);
  assert.deepEqual(quality.reasonCodes, []);
  assert.equal(quality.fingerprint.length, 64);
});

test("rejects a missing application destination", () => {
  const quality = evaluateImportQuality({ description: GOOD_DESCRIPTION });
  assert.equal(quality.status, "rejected");
  assert.ok(quality.reasonCodes.includes("missing_or_invalid_apply_url"));
});

test("rejects obvious expired or filled language", () => {
  for (const description of [
    "This job posting has expired.",
    "This position has been filled.",
    "We are no longer accepting applications.",
  ]) {
    const quality = evaluateImportQuality({
      description,
      applyUrl: "https://example.com/jobs/closed",
    });
    assert.equal(quality.status, "rejected");
  }
});

test("quarantines malformed HTML", () => {
  const quality = evaluateImportQuality({
    description: "<div><section><p>Eye care role</div>",
    applyUrl: "https://example.com/jobs/1",
  });
  assert.equal(quality.status, "quarantined");
  assert.ok(quality.reasonCodes.includes("malformed_html"));
  assert.equal(malformedHtmlSignals("<div><section><p>Text</div>").malformed, true);
});

test("quarantines scraped navigation-heavy descriptions", () => {
  const quality = evaluateImportQuality({
    description: `
      <nav>
        Home About Us Contact Us Search Jobs View All Jobs Sign In Create Account
        Privacy Policy Cookie Settings Terms of Use
      </nav>
      <p>Optician</p>
    `,
    applyUrl: "https://example.com/jobs/2",
  });
  assert.equal(quality.status, "quarantined");
  assert.ok(quality.reasonCodes.includes("scraped_navigation"));
});

test("quarantines confirmed duplicate descriptions", () => {
  const quality = evaluateImportQuality({
    description: GOOD_DESCRIPTION,
    applyUrl: "https://example.com/jobs/3",
    duplicateDescription: true,
  });
  assert.equal(quality.status, "quarantined");
  assert.ok(quality.reasonCodes.includes("duplicate_description"));
});

test("normalization produces stable fingerprints across HTML formatting", () => {
  const first = descriptionFingerprint(
    "<p>Support patients and prepare exam rooms for a busy eye care practice with a great team.</p>"
  );
  const second = descriptionFingerprint(
    "Support patients &amp; prepare exam rooms for a busy eye care practice with a great team."
  );
  assert.equal(first, second);
});

