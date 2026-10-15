const assert = require("node:assert/strict");
const test = require("node:test");
const { indexableJobUrls, isIndexableJob, jobPath } = require("../services/jobSeo");

const activeJob = {
  id: "85a8464f-7bbd-4313-a578-c4817ae69e16",
  status: "active",
  is_archived: false,
  title: "Optometrist",
  company: "Example Optical",
  city: "San Juan",
  state: "PR",
  posted_at: "2026-10-01T12:00:00.000Z",
  description: "Examine patients and deliver eye care.",
};

test("canonical job URLs depend only on the stable job ID", () => {
  assert.equal(jobPath(activeJob), `/jobs/${activeJob.id}`);
  assert.equal(jobPath({ ...activeJob, title: "Senior Optometrist", company: "New Brand" }), jobPath(activeJob));
});

test("only complete, public job records are indexable", () => {
  assert.equal(isIndexableJob(activeJob), true);
  assert.equal(isIndexableJob({ ...activeJob, description: "<p>&nbsp;</p>" }), false);
  assert.equal(isIndexableJob({ ...activeJob, status: "draft" }), false);
  assert.equal(isIndexableJob({ ...activeJob, is_archived: true }), false);
  assert.equal(isIndexableJob({ ...activeJob, posted_at: null }), false);
  assert.equal(isIndexableJob({ ...activeJob, city: null, location: null }), false);
});

test("sitemap URLs use the exact canonical path and omit incomplete listings", () => {
  assert.deepEqual(indexableJobUrls([
    activeJob,
    { ...activeJob, id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", description: "" },
  ]).map(({ url }) => url), [`https://www.jobs.vision${jobPath(activeJob)}`]);
});
