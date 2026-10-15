const SITE_ORIGIN = "https://www.jobs.vision";

function plainText(value = "") {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(?:nbsp|#160|#xA0);/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isIndexableJob(job = {}) {
  const arrangements = job.work_arrangements || [];
  const remote =
    job.location_precision === "remote" ||
    (Array.isArray(arrangements) && arrangements.includes("remote")) ||
    job.work_arrangement === "remote";
  const postedAt = job.posted_at || job.created_at;
  return Boolean(
    job.id &&
    (!job.status || job.status === "active") &&
    job.is_archived !== true &&
    plainText(job.title) &&
    plainText(displayJobCompany(job)) &&
    plainText(job.description) &&
    postedAt &&
    !Number.isNaN(Date.parse(postedAt)) &&
    (remote || plainText(job.city || job.location))
  );
}

function displayJobCompany(job = {}) {
  const brand = plainText(job.employer_brand || job.venue_brand);
  if (/^lenscrafters$/i.test(brand)) {
    const venue = [job.venue_brand, job.venue_name, job.practice_name, job.company, job.title, job.description]
      .map(plainText).join(" ");
    if (/\bmacy'?s\b/i.test(venue)) return "LensCrafters at Macy's";
  }
  return job.employer_brand || job.practice_name || job.venue_brand || job.company ||
    job.employer_name || job.venue_name || job.parent_company || "";
}

function jobPath(job = {}) {
  const id = String(job.id || job._id || "").trim();
  if (!id) return "/jobs";
  // The immutable ID is the public canonical URL. Employer names and titles
  // change, so a descriptive slug cannot be a stable job identifier.
  return `/jobs/${encodeURIComponent(id)}`;
}

function indexableJobUrls(jobs = [], origin = SITE_ORIGIN) {
  return jobs.filter(isIndexableJob).map((job) => ({
    job,
    url: `${origin}${jobPath(job)}`,
  }));
}

module.exports = {
  SITE_ORIGIN,
  displayJobCompany,
  jobPath,
  isIndexableJob,
  indexableJobUrls,
  plainText,
};
