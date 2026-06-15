export const JOB_SORT_MODES = {
  BEST_MATCH: "best_match",
  NEWEST: "newest",
  DISTANCE: "distance",
  SALARY: "salary",
};

const SORT_WEIGHTS = {
  [JOB_SORT_MODES.BEST_MATCH]: {
    relevance: 1.4,
    distance: 1,
    freshness: 0.5,
    promotion: 0.45,
    salary: 0,
  },
  [JOB_SORT_MODES.NEWEST]: {
    relevance: 0.45,
    distance: 0.2,
    freshness: 3,
    promotion: 0.25,
    salary: 0,
  },
  [JOB_SORT_MODES.DISTANCE]: {
    relevance: 0.35,
    distance: 5,
    freshness: 0.15,
    promotion: 0.1,
    salary: 0,
  },
  [JOB_SORT_MODES.SALARY]: {
    relevance: 0.55,
    distance: 0.25,
    freshness: 0.2,
    promotion: 0.2,
    salary: 3,
  },
};

function normalizeText(value = "") {
  return String(value || "").trim().toLowerCase();
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map(normalizeText);
  if (!value) return [];
  return String(value).split(",").map(normalizeText).filter(Boolean);
}

function getTimestamp(job = {}) {
  const raw = job.posted_at || job.createdAt || job.created_at || job.updated_at;
  const time = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

function listingTier(job = {}) {
  if (job.listing_tier) return normalizeText(job.listing_tier);
  if (job.featured) return "featured";
  if (job.listing_source === "imported" || job.source === "discovery" || job.source === "imported") {
    return "imported";
  }
  return "standard_paid";
}

export function normalizeSortMode(value) {
  const normalized = normalizeText(value).replace(/-/g, "_");
  if (normalized === "best" || normalized === "best_match") return JOB_SORT_MODES.BEST_MATCH;
  if (normalized === JOB_SORT_MODES.NEWEST) return JOB_SORT_MODES.NEWEST;
  if (normalized === JOB_SORT_MODES.DISTANCE) return JOB_SORT_MODES.DISTANCE;
  if (normalized === JOB_SORT_MODES.SALARY) return JOB_SORT_MODES.SALARY;
  return JOB_SORT_MODES.BEST_MATCH;
}

export function relevanceScore(job = {}, filters = {}) {
  const q = normalizeText(filters.q);
  const company = normalizeText(filters.company);
  const roleFilters = normalizeArray(filters.roles);
  const employmentFilters = normalizeArray(filters.employmentTypes);
  const workFilters = normalizeArray(filters.workArrangements);
  const opportunityFilters = normalizeArray(filters.opportunityTypes);
  const practiceFilters = normalizeArray(filters.practiceTypes);

  let score = 0;
  const role = normalizeText(job.role);
  const employmentValues = normalizeArray(job.employment_types || job.employment_type || job.type);
  const workValues = normalizeArray(job.work_arrangements || job.work_arrangement);
  const opportunityValues = normalizeArray(job.opportunity_types || job.opportunity_type);
  const practiceType = normalizeText(job.practice_type);

  if (q) {
    const title = normalizeText(job.title);
    const employer = normalizeText(
      [job.company, job.employer_brand, job.practice_name, job.parent_company, job.employer_name]
        .filter(Boolean)
        .join(" ")
    );
    const location = normalizeText(job.location);
    const description = normalizeText(job.description);
    if (title === q) score += 120;
    else if (title.includes(q)) score += 95;
    if (role && (role === q || role.includes(q))) score += 75;
    if (employer && employer.includes(q)) score += 35;
    if (location && location.includes(q)) score += 20;
    if (description && description.includes(q)) score += 12;
  }

  if (
    company &&
    normalizeText(
      [job.company, job.employer_brand, job.practice_name, job.parent_company, job.employer_name]
        .filter(Boolean)
        .join(" ")
    ).includes(company)
  ) {
    score += 35;
  }
  if (roleFilters.length && roleFilters.includes(role)) score += 45;
  if (employmentFilters.length && employmentValues.some((value) => employmentFilters.includes(value))) {
    score += 25;
  }
  if (workFilters.length && workValues.some((value) => workFilters.includes(value))) {
    score += 18;
  }
  if (opportunityFilters.length && opportunityValues.some((value) => opportunityFilters.includes(value))) {
    score += 22;
  }
  if (practiceFilters.length && practiceFilters.includes(practiceType)) score += 18;

  return score;
}

export function distanceScore(job = {}, { searchCenter, radiusMi, getPosition } = {}) {
  if (!searchCenter || typeof getPosition !== "function") {
    return { score: 0, distanceMi: Infinity };
  }

  const position = getPosition(job);
  if (!position) return { score: 0, distanceMi: Infinity };

  const distanceMi = Number(position.distanceMi);
  const distance = Number.isFinite(distanceMi) ? distanceMi : Infinity;
  if (!Number.isFinite(distance)) return { score: 0, distanceMi: Infinity };

  const radius = Math.max(1, Number(radiusMi) || 25);
  return {
    score: Math.max(0, 60 * (1 - Math.min(distance, radius) / radius)),
    distanceMi: distance,
  };
}

export function freshnessScore(job = {}, now = Date.now()) {
  const timestamp = getTimestamp(job);
  if (!timestamp) return 0;
  const ageDays = Math.max(0, (now - timestamp) / 86_400_000);
  return Math.max(0, 18 * (1 - Math.min(ageDays, 60) / 60));
}

export function promotionScore(job = {}) {
  const tier = listingTier(job);
  let score = 0;

  if (tier === "sponsor") score += 24;
  else if (tier === "featured") score += 18;
  else if (tier === "standard_paid") score += 8;
  else if (tier === "imported") score -= 4;

  if (job.featured && tier !== "featured" && tier !== "sponsor") score += 10;
  if (job.source === "seed" || job.seed_batch) score -= 3;

  return score;
}

export function salaryScore(job = {}) {
  const values = [
    job.salary_max,
    job.salary_min,
    job.hourly_max != null ? Number(job.hourly_max) * 2080 : null,
    job.hourly_min != null ? Number(job.hourly_min) * 2080 : null,
    job.daily_rate != null ? Number(job.daily_rate) * 240 : null,
  ]
    .map(Number)
    .filter((value) => Number.isFinite(value) && value > 0);
  if (!values.length) return 0;
  return Math.min(40, Math.max(...values) / 5000);
}

export function rankingComponents(job = {}, context = {}) {
  const distance = distanceScore(job, context);
  return {
    relevance: relevanceScore(job, context.filters || {}),
    distance: distance.score,
    distanceMi: distance.distanceMi,
    freshness: freshnessScore(job, context.now),
    promotion: promotionScore(job),
    salary: salaryScore(job),
  };
}

export function rankingScore(job = {}, context = {}) {
  const sortMode = normalizeSortMode(context.sortMode);
  const weights = SORT_WEIGHTS[sortMode] || SORT_WEIGHTS[JOB_SORT_MODES.BEST_MATCH];
  const components = rankingComponents(job, context);
  const total =
    components.relevance * weights.relevance +
    components.distance * weights.distance +
    components.freshness * weights.freshness +
    components.promotion * weights.promotion +
    components.salary * weights.salary;

  return { ...components, total };
}

function compareRanked(left, right, sortMode) {
  const a = left.score;
  const b = right.score;
  const mode = normalizeSortMode(sortMode);

  const byTotal = b.total - a.total;
  if (Math.abs(byTotal) > 0.0001) return byTotal;

  if (mode === JOB_SORT_MODES.DISTANCE) {
    const byDistance = a.distanceMi - b.distanceMi;
    if (Number.isFinite(byDistance) && Math.abs(byDistance) > 0.0001) return byDistance;
  }

  return (
    b.relevance - a.relevance ||
    b.promotion - a.promotion ||
    b.freshness - a.freshness ||
    getTimestamp(right.job) - getTimestamp(left.job) ||
    normalizeText(left.job.title).localeCompare(normalizeText(right.job.title))
  );
}

export function rankJobs(jobs = [], context = {}) {
  const sortMode = normalizeSortMode(context.sortMode);
  return [...jobs]
    .map((job) => {
      const score = rankingScore(job, { ...context, sortMode });
      return { job, score };
    })
    .sort((left, right) => compareRanked(left, right, sortMode))
    .map(({ job, score }) => ({
      ...job,
      ranking_score: Number(score.total.toFixed(3)),
      ranking_components: {
        relevance: Number(score.relevance.toFixed(3)),
        distance: Number(score.distance.toFixed(3)),
        freshness: Number(score.freshness.toFixed(3)),
        promotion: Number(score.promotion.toFixed(3)),
        salary: Number(score.salary.toFixed(3)),
      },
      distance_mi: Number.isFinite(score.distanceMi) ? Number(score.distanceMi.toFixed(2)) : null,
    }));
}
