import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import Seo from "../Seo";
import {
  BENEFIT_FLAG_LABELS,
  CLINICAL_FOCUS_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  OPPORTUNITY_TYPE_LABELS,
  PRACTICE_TYPE_LABELS,
  ROLE_LABELS,
  SATURDAY_SCHEDULE_LABELS,
  WORK_ARRANGEMENT_LABELS,
  compensationSummary,
  labelsForValues,
  normalizeMultiValue,
  normalizeRole,
} from "../../utils/jobTaxonomy";
import {
  absoluteJobUrl,
  displayJobCompany,
  displayJobLocation,
  jobPath,
  jobSeoDescription,
  jobSeoTitle,
  jobSlug,
  plainText,
} from "../../utils/jobSeo";
import {
  fetchPublicJob,
  recordApplyClick,
  recordListingView,
} from "../../utils/api.supabase";
import "./JobDetailPage.css";

function applyUrlFor(job = {}) {
  return job.external_apply_url || job.apply_url || job.applyUrl || "";
}

function applyEmailFor(job = {}) {
  return job.application_email || job.applicationEmail || "";
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function detailLabels(labelMap, values) {
  return labelsForValues(labelMap, values).filter(Boolean);
}

function employmentTypesForJsonLd(job = {}) {
  const map = {
    full_time: "FULL_TIME",
    part_time: "PART_TIME",
    per_diem_fill_in: "TEMPORARY",
  };
  return Array.from(
    new Set(
      normalizeMultiValue(job.employment_types || job.employment_type || job.type)
        .map((value) => map[value])
        .filter(Boolean)
    )
  );
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function baseSalaryForJsonLd(job = {}) {
  const value = {};
  let unitText = "";

  if (job.compensation_type === "annual_salary") {
    value.minValue = numberOrNull(job.salary_min);
    value.maxValue = numberOrNull(job.salary_max);
    unitText = "YEAR";
  } else if (job.compensation_type === "hourly_wage") {
    value.minValue = numberOrNull(job.hourly_min);
    value.maxValue = numberOrNull(job.hourly_max);
    unitText = "HOUR";
  } else if (job.compensation_type === "per_diem") {
    value.value = numberOrNull(job.daily_rate);
    unitText = "DAY";
  }

  Object.keys(value).forEach((key) => {
    if (value[key] == null) delete value[key];
  });

  if (!Object.keys(value).length) return null;
  return {
    "@type": "MonetaryAmount",
    currency: "USD",
    value: {
      "@type": "QuantitativeValue",
      ...value,
      unitText,
    },
  };
}

function compactObject(value = {}) {
  return Object.entries(value).reduce((acc, [key, entry]) => {
    if (entry === null || entry === undefined || entry === "") return acc;
    if (Array.isArray(entry) && entry.length === 0) return acc;
    acc[key] = entry;
    return acc;
  }, {});
}

function jobPostingJsonLd(job = {}, canonical) {
  const company = displayJobCompany(job);
  const location = displayJobLocation(job);
  const workArrangements = normalizeMultiValue(job.work_arrangements || job.work_arrangement);
  const isRemote =
    workArrangements.includes("remote") || job.location_precision === "remote";
  const employmentType = employmentTypesForJsonLd(job);
  const baseSalary = baseSalaryForJsonLd(job);
  const description = plainText(job.description) || jobSeoDescription(job);

  const jsonLd = compactObject({
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: plainText(job.title || "Eye care job"),
    description,
    datePosted: job.posted_at || job.createdAt || job.created_at || undefined,
    employmentType: employmentType.length === 1 ? employmentType[0] : employmentType,
    hiringOrganization: compactObject({
      "@type": "Organization",
      name: company,
      sameAs: job.source_url || undefined,
    }),
    identifier: compactObject({
      "@type": "PropertyValue",
      name: "jobs.vision",
      value: job.id || job._id,
    }),
    jobLocationType: isRemote ? "TELECOMMUTE" : undefined,
    applicantLocationRequirements: isRemote
      ? {
          "@type": "Country",
          name: "United States",
        }
      : undefined,
    jobLocation:
      location && !isRemote
        ? {
            "@type": "Place",
            address: compactObject({
              "@type": "PostalAddress",
              addressLocality: job.city || undefined,
              addressRegion: job.state || undefined,
              addressCountry: "US",
              streetAddress:
                job.location && !job.city && !job.state ? job.location : undefined,
            }),
          }
        : undefined,
    baseSalary: baseSalary || undefined,
    directApply: Boolean(applyUrlFor(job) || applyEmailFor(job)),
    url: canonical,
  });

  return jsonLd;
}

export default function JobDetailPage() {
  const { jobId, slug } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    async function loadJob() {
      setLoading(true);
      setError("");
      try {
        const row = await fetchPublicJob(jobId);
        if (!mounted) return;
        setJob(row);
      } catch (err) {
        if (mounted) {
          setJob(null);
          setError(err?.message || "Unable to load this job.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadJob();
    return () => {
      mounted = false;
    };
  }, [jobId]);

  useEffect(() => {
    const id = job?.id || job?._id;
    if (id) recordListingView(id, { source: "job_detail_page" });
  }, [job?.id, job?._id]);

  useEffect(() => {
    if (!job || !slug) return;
    const canonicalPath = jobPath(job);
    if (location.pathname !== canonicalPath && slug !== jobSlug(job)) {
      navigate(canonicalPath, { replace: true });
    }
  }, [job, location.pathname, navigate, slug]);

  const canonical = job ? absoluteJobUrl(job) : absoluteJobUrl(jobId, { includeSlug: false });
  const seoTitle = job ? jobSeoTitle(job) : "Job Listing | jobs.vision";
  const seoDescription = job
    ? jobSeoDescription(job)
    : "Review an optometry or eye care job listing on jobs.vision.";
  const jsonLd = useMemo(
    () => (job ? jobPostingJsonLd(job, canonical) : null),
    [canonical, job]
  );

  const role = normalizeRole(job?.role) || job?.role;
  const company = job ? displayJobCompany(job) : "";
  const jobLocation = job ? displayJobLocation(job) : "";
  const compensation = job ? compensationSummary(job) : "";
  const applyUrl = job ? applyUrlFor(job) : "";
  const applyEmail = job ? applyEmailFor(job) : "";
  const emailApplyUrl = applyEmail
    ? `mailto:${applyEmail}?subject=${encodeURIComponent(`Application for ${job?.title || "job"}`)}`
    : "";
  const opportunityLabels =
    role === "optometrist"
      ? detailLabels(OPPORTUNITY_TYPE_LABELS, job?.opportunity_types || job?.opportunity_type)
      : [];
  const employmentLabels = detailLabels(
    EMPLOYMENT_TYPE_LABELS,
    job?.employment_types || job?.employment_type || job?.type
  );
  const workLabels = detailLabels(
    WORK_ARRANGEMENT_LABELS,
    job?.work_arrangements || job?.work_arrangement
  );
  const clinicalLabels = detailLabels(CLINICAL_FOCUS_LABELS, job?.clinical_focuses);
  const practiceLabels = detailLabels(
    PRACTICE_TYPE_LABELS,
    job?.practice_types || job?.practice_type
  );
  const benefitLabels = detailLabels(BENEFIT_FLAG_LABELS, job?.benefit_flags);
  const postedAt = formatDate(job?.posted_at || job?.createdAt || job?.created_at);

  function handleApplyClick(destinationType, destination) {
    const id = job?.id || job?._id;
    if (!id) return;
    recordApplyClick(id, {
      destinationType,
      destination,
      source: "job_detail_page",
    });
  }

  return (
    <main className="job-detail-page text-on-dim">
      <Seo
        title={seoTitle}
        description={seoDescription}
        canonical={canonical}
        ogType="article"
        jsonLd={jsonLd}
        noIndex={!loading && Boolean(error)}
      />

      <div className="job-detail-inner">
        <Link className="job-detail-back" to="/jobs">
          Back to Jobs
        </Link>

        {loading ? (
          <section className="job-detail-state" role="status" aria-live="polite">
            Loading job...
          </section>
        ) : null}

        {!loading && error ? (
          <section className="job-detail-state">
            <h1>Job not available</h1>
            <p>{error}</p>
            <Link className="btn-primary" to="/jobs">
              Browse Jobs
            </Link>
          </section>
        ) : null}

        {!loading && job ? (
          <article className="job-detail-layout">
            <header className="job-detail-hero">
              <p className="job-detail-eyebrow">Eye Care Job</p>
              <h1>{job.title || "Eye care job"}</h1>
              <div className="job-detail-meta">
                {company ? <span>{company}</span> : null}
                {jobLocation ? <span>{jobLocation}</span> : null}
                {role ? <span>{ROLE_LABELS[role] || role}</span> : null}
                {postedAt ? <span>Posted {postedAt}</span> : null}
              </div>
              <div className="job-detail-actions">
                {applyUrl ? (
                  <a
                    className="btn-primary"
                    href={applyUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => handleApplyClick("external_url", applyUrl)}
                  >
                    Apply on Employer Site
                  </a>
                ) : null}
                {!applyUrl && emailApplyUrl ? (
                  <a
                    className="btn-primary"
                    href={emailApplyUrl}
                    onClick={() => handleApplyClick("recruiter_email", applyEmail)}
                  >
                    Email Employer
                  </a>
                ) : null}
                {!applyUrl && !emailApplyUrl ? (
                  <span className="job-detail-apply-note">Apply details unavailable</span>
                ) : null}
                <Link className="btn-secondary" to="/jobs">
                  Browse More Jobs
                </Link>
              </div>
            </header>

            <div className="job-detail-content">
              <section className="job-detail-main">
                <h2>Job Description</h2>
                <p>{plainText(job.description) || "No description was provided for this listing."}</p>
              </section>

              <aside className="job-detail-summary" aria-label="Job summary">
                <h2>Job Details</h2>
                <dl>
                  {compensation ? (
                    <>
                      <dt>Compensation</dt>
                      <dd>{compensation}</dd>
                    </>
                  ) : null}
                  {employmentLabels.length ? (
                    <>
                      <dt>Employment</dt>
                      <dd>{employmentLabels.join(", ")}</dd>
                    </>
                  ) : null}
                  {workLabels.length ? (
                    <>
                      <dt>Work Setting</dt>
                      <dd>{workLabels.join(", ")}</dd>
                    </>
                  ) : null}
                  {opportunityLabels.length ? (
                    <>
                      <dt>Opportunity</dt>
                      <dd>{opportunityLabels.join(", ")}</dd>
                    </>
                  ) : null}
                  {practiceLabels.length ? (
                    <>
                      <dt>Practice Type</dt>
                      <dd>{practiceLabels.join(", ")}</dd>
                    </>
                  ) : null}
                  {job.saturday_schedule ? (
                    <>
                      <dt>Saturday Schedule</dt>
                      <dd>
                        {SATURDAY_SCHEDULE_LABELS[job.saturday_schedule] ||
                          job.saturday_schedule}
                      </dd>
                    </>
                  ) : null}
                  {job.sign_on_bonus ? (
                    <>
                      <dt>Sign-on Bonus</dt>
                      <dd>{job.sign_on_bonus}</dd>
                    </>
                  ) : null}
                  {job.ce_allowance ? (
                    <>
                      <dt>CE Allowance</dt>
                      <dd>{job.ce_allowance}</dd>
                    </>
                  ) : null}
                  {job.benefits ? (
                    <>
                      <dt>Benefits</dt>
                      <dd>{job.benefits}</dd>
                    </>
                  ) : null}
                </dl>

                {[clinicalLabels, benefitLabels].some((values) => values.length > 0) ? (
                  <div className="job-detail-tags">
                    {clinicalLabels.map((label) => (
                      <span key={`clinical-${label}`}>{label}</span>
                    ))}
                    {benefitLabels.map((label) => (
                      <span key={`benefit-${label}`}>{label}</span>
                    ))}
                  </div>
                ) : null}
              </aside>
            </div>
          </article>
        ) : null}
      </div>
    </main>
  );
}
