const DEFAULT_SITE_ORIGIN = "https://www.jobs.vision";

export const SITE_ORIGIN = (
  process.env.REACT_APP_SITE_URL ||
  process.env.REACT_APP_PUBLIC_SITE_URL ||
  DEFAULT_SITE_ORIGIN
).replace(/\/+$/, "");

export function plainText(value = "") {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function truncateText(value = "", maxLength = 155) {
  const text = plainText(value);
  if (text.length <= maxLength) return text;
  const clipped = text.slice(0, maxLength - 1);
  const lastSpace = clipped.lastIndexOf(" ");
  return `${(lastSpace > 80 ? clipped.slice(0, lastSpace) : clipped).trim()}...`;
}

export function slugifyJobText(value = "") {
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

export function getJobId(jobOrId) {
  if (!jobOrId) return "";
  if (typeof jobOrId === "string" || typeof jobOrId === "number") return String(jobOrId);
  return String(jobOrId.id || jobOrId._id || "");
}

export function jobSlug(job = {}) {
  return slugifyJobText(
    [
      job.title,
      job.company || job.employer_name || job.practice_name || job.parent_company,
      job.city || job.location,
      job.state,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

export function jobPath(jobOrId, { includeSlug = true } = {}) {
  const id = getJobId(jobOrId);
  if (!id) return "/jobs";

  if (!includeSlug || typeof jobOrId === "string" || typeof jobOrId === "number") {
    return `/jobs/${encodeURIComponent(id)}`;
  }

  return `/jobs/${encodeURIComponent(id)}/${jobSlug(jobOrId)}`;
}

export function absoluteJobUrl(jobOrId, options = {}) {
  return `${SITE_ORIGIN}${jobPath(jobOrId, options)}`;
}

export function displayJobCompany(job = {}) {
  return (
    job.company ||
    job.employer_name ||
    job.practice_name ||
    job.parent_company ||
    "Eye care employer"
  );
}

export function displayJobLocation(job = {}) {
  return String(job.location || [job.city, job.state].filter(Boolean).join(", ")).trim();
}

export function jobSeoTitle(job = {}) {
  const title = plainText(job.title || "Eye care job");
  const company = plainText(displayJobCompany(job));
  const location = plainText(displayJobLocation(job));
  const core = [title, company && `at ${company}`, location && `in ${location}`]
    .filter(Boolean)
    .join(" ");

  return truncateText(`${core} | jobs.vision`, 70);
}

export function jobSeoDescription(job = {}) {
  const title = plainText(job.title || "Eye care job");
  const company = plainText(displayJobCompany(job));
  const location = plainText(displayJobLocation(job));
  const intro = [title, company && `at ${company}`, location && `in ${location}`]
    .filter(Boolean)
    .join(" ");
  const detail = plainText(job.description);

  return truncateText(detail ? `${intro}. ${detail}` : `${intro}. Apply through jobs.vision.`, 155);
}
