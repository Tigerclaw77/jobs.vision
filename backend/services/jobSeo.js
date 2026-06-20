function plainText(value = "") {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugifyJobText(value = "") {
  const slug = String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[\u2019']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");

  return slug || "job";
}

function displayJobCompany(job = {}) {
  return (
    job.company ||
    job.employer_name ||
    job.practice_name ||
    job.parent_company ||
    "eye-care-employer"
  );
}

function jobSlug(job = {}) {
  return slugifyJobText(
    [
      job.title,
      displayJobCompany(job),
      job.city || job.location,
      job.state,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function jobPath(job = {}) {
  const id = String(job.id || job._id || "").trim();
  if (!id) return "/jobs";
  return `/jobs/${encodeURIComponent(id)}/${jobSlug(job)}`;
}

module.exports = {
  displayJobCompany,
  jobPath,
  jobSlug,
  plainText,
  slugifyJobText,
};
