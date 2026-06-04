export const ROLE_OPTIONS = [
  { value: "optometrist", label: "Optometrist" },
  { value: "optician", label: "Optician" },
  { value: "ophthalmic_technician", label: "Ophthalmic Technician" },
  { value: "optical_lab", label: "Optical Lab" },
  { value: "front_desk", label: "Front Desk" },
  { value: "practice_manager", label: "Practice Manager" },
  { value: "other", label: "Other" },
];

export const OPPORTUNITY_TYPE_OPTIONS = [
  { value: "associate_w2", label: "Associate (W-2)" },
  { value: "associate_1099", label: "Associate (1099)" },
  { value: "corporate_employment", label: "Corporate Employment" },
  { value: "corporate_lease", label: "Corporate Lease" },
  { value: "partnership_opportunity", label: "Partnership Opportunity" },
  { value: "practice_acquisition", label: "Practice Acquisition" },
];

export const EMPLOYMENT_TYPE_OPTIONS = [
  { value: "full_time", label: "Full-Time" },
  { value: "part_time", label: "Part-Time" },
  { value: "per_diem_fill_in", label: "Per Diem / Fill-In" },
];

export const WORK_ARRANGEMENT_OPTIONS = [
  { value: "on_site", label: "On-Site" },
  { value: "hybrid", label: "Hybrid" },
  { value: "remote", label: "Remote" },
];

export const PRACTICE_TYPE_OPTIONS = [
  { value: "private_practice", label: "Private Practice" },
  { value: "corporate", label: "Corporate" },
  { value: "od_md", label: "OD/MD" },
];

export const COMPENSATION_TYPE_OPTIONS = [
  { value: "annual_salary", label: "Annual Salary" },
  { value: "hourly_wage", label: "Hourly Wage" },
  { value: "per_diem", label: "Per Diem" },
  { value: "production_based", label: "Production Based" },
  { value: "other", label: "Other" },
];

const optionMap = (options) =>
  options.reduce((acc, option) => ({ ...acc, [option.value]: option.label }), {});

export const ROLE_LABELS = optionMap(ROLE_OPTIONS);
export const OPPORTUNITY_TYPE_LABELS = optionMap(OPPORTUNITY_TYPE_OPTIONS);
export const EMPLOYMENT_TYPE_LABELS = optionMap(EMPLOYMENT_TYPE_OPTIONS);
export const WORK_ARRANGEMENT_LABELS = optionMap(WORK_ARRANGEMENT_OPTIONS);
export const PRACTICE_TYPE_LABELS = optionMap(PRACTICE_TYPE_OPTIONS);
export const COMPENSATION_TYPE_LABELS = optionMap(COMPENSATION_TYPE_OPTIONS);

export function normalizeKey(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[()]/g, "")
    .replace(/[/-]+/g, " ")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ");
}

export function normalizeToken(value = "") {
  return normalizeKey(value).replace(/\s+/g, "_");
}

export function normalizeRole(value = "") {
  const aliases = {
    optometrist: "optometrist",
    od: "optometrist",
    doctor: "optometrist",
    optician: "optician",
    tech: "ophthalmic_technician",
    technician: "ophthalmic_technician",
    "ophthalmic tech": "ophthalmic_technician",
    "ophthalmic technician": "ophthalmic_technician",
    ophthalmic_technician: "ophthalmic_technician",
    "optical lab": "optical_lab",
    optical_lab: "optical_lab",
    "front desk": "front_desk",
    front_desk: "front_desk",
    manager: "practice_manager",
    "practice manager": "practice_manager",
    practice_manager: "practice_manager",
    other: "other",
  };
  return aliases[normalizeKey(value)] || "";
}

export function normalizeMultiValue(value, normalizer = normalizeToken) {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
    ? value.split(",")
    : value
    ? [value]
    : [];
  return raw.map((item) => normalizer(item)).filter(Boolean);
}

export function labelsForValues(labels, values) {
  return normalizeMultiValue(values).map((value) => labels[value] || value.replace(/_/g, " "));
}

export function formatMoney(value) {
  if (value === null || value === undefined || value === "") return "";
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  return `$${number.toLocaleString()}`;
}

export function compensationSummary(job = {}) {
  const type = job.compensation_type;
  if (type === "annual_salary") {
    const min = formatMoney(job.salary_min);
    const max = formatMoney(job.salary_max);
    if (min && max) return `${min} - ${max}`;
    if (min) return `From ${min}`;
    if (max) return `Up to ${max}`;
  }
  if (type === "hourly_wage") {
    const min = formatMoney(job.hourly_min);
    const max = formatMoney(job.hourly_max);
    if (min && max) return `${min} - ${max}/hr`;
    if (min) return `From ${min}/hr`;
    if (max) return `Up to ${max}/hr`;
  }
  if (type === "per_diem") {
    const daily = formatMoney(job.daily_rate);
    if (daily) return `${daily}/day`;
  }
  if (type === "production_based" || type === "other") {
    return job.compensation_notes || "";
  }
  return job.salary || "";
}
