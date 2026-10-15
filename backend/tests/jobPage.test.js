const assert = require("node:assert/strict");
const test = require("node:test");
const { createJobPageHandler, renderJobPage } = require("../services/jobPage");

const id = "85a8464f-7bbd-4313-a578-c4817ae69e16";
const job = {
  id,
  title: "Optometrist",
  company: "Example Optical",
  city: "San Juan",
  state: "PR",
  description: "Examine patients and deliver eye care.",
  posted_at: "2026-10-01T12:00:00.000Z",
  seo_eligible: true,
};
const template = '<!doctype html><html><head><title>jobs.vision</title><link rel="canonical" href="https://www.jobs.vision/" /><meta name="description" content="Generic" /></head><body><div id="root"></div></body></html>';

function response() {
  return {
    code: 200,
    headers: {},
    status(code) { this.code = code; return this; },
    set(name, value) { this.headers[name] = value; return this; },
    type(value) { this.headers.type = value; return this; },
    send(value) { this.body = value; return this; },
    end() { return this; },
    redirect(code, value) { this.code = code; this.headers.Location = value; return this; },
  };
}

test("initial HTML has one job canonical, job content, and valid JobPosting", () => {
  const html = renderJobPage(template, job);
  const canonical = `https://www.jobs.vision/jobs/${id}`;
  assert.match(html, /<h1>Optometrist<\/h1>/);
  assert.match(html, /Examine patients and deliver eye care/);
  assert.equal((html.match(/rel="canonical"/g) || []).length, 1);
  assert.ok(html.includes(`rel="canonical" href="${canonical}"`));
  assert.ok(!html.includes('rel="canonical" href="https://www.jobs.vision/"'));
  const json = JSON.parse(html.match(/id="jobposting-jsonld"[^>]*>([^<]+)<\/script>/)[1]);
  assert.equal(json["@type"], "JobPosting");
  assert.equal(json.url, canonical);
  assert.equal(json.identifier.value, id);
  assert.equal(json.description, job.description);
  assert.equal(json.datePosted, job.posted_at);
});

test("missing description remains viewable but receives noindex and no JobPosting", () => {
  const html = renderJobPage(template, { ...job, description: "", seo_eligible: false });
  assert.match(html, /name="robots" content="noindex, follow"/);
  assert.ok(!html.includes('id="jobposting-jsonld"'));
});

test("HTML and structured data escape untrusted listing text", () => {
  const html = renderJobPage(template, {
    ...job,
    title: "<script>alert(1)</script> Optometrist",
    description: "Eye care </script><script>alert(1)</script>",
  });
  assert.ok(!html.includes("<script>alert(1)</script>"));
  assert.match(html, /<h1>alert\(1\) Optometrist<\/h1>/);
});

test("legacy slugs redirect directly and unavailable jobs return real 404", async () => {
  const old = response();
  await createJobPageHandler(async () => job, () => template)({ params: { id, slug: "old-slug" } }, old);
  assert.equal(old.code, 308);
  assert.equal(old.headers.Location, `/jobs/${id}`);

  const missing = response();
  await createJobPageHandler(async () => null, () => template)({ params: { id } }, missing);
  assert.equal(missing.code, 404);
  assert.equal(missing.headers["X-Robots-Tag"], "noindex");
});
