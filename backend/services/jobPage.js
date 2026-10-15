const fs = require("node:fs");
const path = require("node:path");
const { SITE_ORIGIN, jobPath, plainText } = require("./jobSeo");

const INDEX_PATH = path.join(__dirname, "..", "..", "frontend", "build", "index.html");
const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeJson(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function jobPosting(job, canonical) {
  const company = job.seo_company || job.company || job.employer_name || job.practice_name || job.parent_company;
  const remote =
    job.location_precision === "remote" ||
    job.work_arrangement === "remote" ||
    (Array.isArray(job.work_arrangements) && job.work_arrangements.includes("remote"));
  const location = remote
    ? { jobLocationType: "TELECOMMUTE", applicantLocationRequirements: { "@type": "Country", name: "United States" } }
    : {
        jobLocation: {
          "@type": "Place",
          address: {
            "@type": "PostalAddress",
            addressLocality: job.city || job.location,
            ...(job.state ? { addressRegion: job.state } : {}),
            addressCountry: "US",
          },
        },
      };

  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: plainText(job.title),
    description: plainText(job.description),
    datePosted: job.posted_at || job.created_at,
    hiringOrganization: { "@type": "Organization", name: plainText(company) },
    identifier: { "@type": "PropertyValue", name: "jobs.vision", value: job.id },
    url: canonical,
    ...location,
  };
}

function renderJobPage(template, job) {
  const canonical = `${SITE_ORIGIN}${jobPath(job)}`;
  const company = job.seo_company || job.company || job.employer_name || job.practice_name || job.parent_company || "";
  const location = [job.city || job.location, job.state].filter(Boolean).join(", ");
  const description = plainText(job.description);
  const title = [plainText(job.title), company && `at ${plainText(company)}`, location && `in ${plainText(location)}`, "jobs.vision"]
    .filter(Boolean).join(" ").slice(0, 160);
  const summary = description ? description.slice(0, 155) : `${plainText(job.title)} at ${plainText(company)}.`;
  const indexable = job.seo_eligible === true;

  let html = template
    .replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(title)}</title>`)
    .replace(/<link\s+rel="canonical"\s+href="[^"]*"\s*\/>/i, "")
    .replace(/<meta\s+name="description"[\s\S]*?\/>/i, "")
    .replace(/<meta\s+property="og:(?:type|title|description|url)"[^>]*\/>/gi, "")
    .replace(/<meta\s+name="twitter:(?:title|description)"[^>]*\/>/gi, "");

  const head = [
    `<link rel="canonical" href="${escapeHtml(canonical)}" />`,
    `<meta name="description" content="${escapeHtml(summary)}" />`,
    `<meta name="robots" content="${indexable ? "index, follow" : "noindex, follow"}" />`,
    `<meta property="og:type" content="article" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(summary)}" />`,
    `<meta property="og:url" content="${escapeHtml(canonical)}" />`,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(summary)}" />`,
    ...(indexable
      ? [`<script id="jobposting-jsonld" type="application/ld+json">${safeJson(jobPosting(job, canonical))}</script>`]
      : []),
  ].join("\n");
  html = html.replace("</head>", `${head}\n</head>`);

  const body = [
    '<main class="job-detail-page"><article class="job-detail-inner">',
    `<h1>${escapeHtml(plainText(job.title))}</h1>`,
    `<p>${escapeHtml(company)}${location ? ` · ${escapeHtml(location)}` : ""}</p>`,
    description ? `<section><h2>Job Description</h2><p>${escapeHtml(description)}</p></section>` : "",
    `<a href="/jobs">Browse Jobs</a>`,
    "</article></main>",
  ].join("\n");
  if (!html.includes('<div id="root"></div>')) {
    throw new Error("The frontend HTML template has no React root");
  }
  return html.replace('<div id="root"></div>', `<div id="root">${body}</div>`);
}

function createJobPageHandler(findPublicJob, readTemplate = () => fs.readFileSync(INDEX_PATH, "utf8")) {
  return async function handleJobPage(req, res) {
    const id = String(req.params?.id || "");
    if (!ID_PATTERN.test(id)) return res.status(404).send("Job not available");
    try {
      const job = await findPublicJob(id);
      if (!job) {
        return res.status(404).set("X-Robots-Tag", "noindex").type("text/plain").send("Job not available");
      }
      if (req.params?.slug) return res.redirect(308, jobPath(job));

      const html = renderJobPage(readTemplate(), job);
      return res.status(200)
        .set("Cache-Control", "no-store")
        .set("X-Robots-Tag", job.seo_eligible ? "index, follow" : "noindex, follow")
        .type("html")
        .send(html);
    } catch (error) {
      console.error("Job page rendering failed:", error.message);
      return res.status(503).set("X-Robots-Tag", "noindex").type("text/plain").send("Job temporarily unavailable");
    }
  };
}

module.exports = { createJobPageHandler, renderJobPage, jobPosting };
