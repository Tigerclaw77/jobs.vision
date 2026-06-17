export const ROLE_OPTIONS = [
  { value: "optometrist", label: "Optometrist" },
  { value: "optician", label: "Optician" },
  { value: "ophthalmic_technician", label: "Tech" },
  { value: "optical_lab", label: "Optical Lab" },
  { value: "front_desk", label: "Front Desk" },
  { value: "practice_manager", label: "Manager" },
  { value: "optical_manager", label: "Manager" },
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
  { value: "family_practice", label: "Family Practice" },
  { value: "retail_optical", label: "Retail Optical" },
  { value: "od_md", label: "OD/MD" },
  { value: "multi_location_group", label: "Multi-Location Group" },
  { value: "academic", label: "Academic" },
  { value: "nonprofit", label: "Nonprofit" },
  { value: "government", label: "Government" },
];

export const CLINICAL_FOCUS_OPTIONS = [
  { value: "dry_eye", label: "Dry Eye" },
  { value: "myopia_management", label: "Myopia Management" },
  { value: "specialty_contact_lenses", label: "Specialty Contact Lenses" },
  { value: "vision_therapy", label: "Vision Therapy" },
  { value: "medical_optometry", label: "Medical Optometry" },
  { value: "pediatrics", label: "Pediatrics" },
  { value: "glaucoma", label: "Glaucoma" },
  { value: "low_vision", label: "Low Vision" },
  { value: "primary_care", label: "Primary Care" },
  { value: "refractive_surgical_comanagement", label: "Refractive / Surgical Co-Management" },
  { value: "scleral_lenses", label: "Scleral Lenses" },
  { value: "ocular_disease", label: "Ocular Disease" },
];

export const BENEFIT_FLAG_OPTIONS = [
  { value: "sign_on_bonus", label: "Sign-on Bonus" },
  { value: "ce_allowance", label: "CE Allowance" },
  { value: "relocation_assistance", label: "Relocation Assistance" },
  { value: "student_loan_assistance", label: "Student Loan Assistance" },
];

export const SATURDAY_SCHEDULE_OPTIONS = [
  { value: "none", label: "No Saturdays" },
  { value: "occasional", label: "Occasional Saturdays" },
  { value: "alternating", label: "Alternating Saturdays" },
  { value: "most", label: "Most Saturdays" },
  { value: "every", label: "Every Saturday" },
];

export const BRAND_FILTER_OPTIONS = [
  { value: "America's Best", label: "America's Best" },
  { value: "Eyeglass World", label: "Eyeglass World" },
  { value: "LensCrafters", label: "LensCrafters" },
  { value: "Target Optical", label: "Target Optical" },
  { value: "Pearle Vision", label: "Pearle Vision" },
  { value: "For Eyes", label: "For Eyes" },
  { value: "Vista Optical", label: "Vista Optical" },
];

export const BRAND_FILTER_ALIASES = {
  "Vista Optical": ["Vista Optical - Military", "Vista Optical - Fred Meyer"],
};

export const COMPENSATION_TYPE_OPTIONS = [
  { value: "annual_salary", label: "Annual Salary" },
  { value: "hourly_wage", label: "Hourly Wage" },
  { value: "per_diem", label: "Per Diem" },
  { value: "production_based", label: "Production Based" },
  { value: "other", label: "Other" },
];

export const LISTING_OPPORTUNITY_TYPE_OPTIONS = [
  { value: "job", label: "Job" },
  { value: "practice_sale", label: "Practice Sale" },
  { value: "partnership", label: "Partnership" },
  { value: "lease", label: "Lease" },
];

export const LISTING_TIER_OPTIONS = [
  { value: "imported", label: "Imported" },
  { value: "standard_paid", label: "Standard Paid" },
  { value: "featured", label: "Featured" },
  { value: "sponsor", label: "Sponsor" },
];

export const LOCATION_PRECISION_OPTIONS = [
  { value: "exact", label: "Exact" },
  { value: "facility", label: "Facility" },
  { value: "city", label: "City" },
  { value: "metro", label: "Metro" },
  { value: "state", label: "State" },
  { value: "remote", label: "Remote" },
  { value: "multiple", label: "Multiple" },
  { value: "unknown", label: "Unknown" },
];

const optionMap = (options) =>
  options.reduce((acc, option) => ({ ...acc, [option.value]: option.label }), {});

export const ROLE_LABELS = optionMap(ROLE_OPTIONS);
export const OPPORTUNITY_TYPE_LABELS = optionMap(OPPORTUNITY_TYPE_OPTIONS);
export const EMPLOYMENT_TYPE_LABELS = optionMap(EMPLOYMENT_TYPE_OPTIONS);
export const WORK_ARRANGEMENT_LABELS = optionMap(WORK_ARRANGEMENT_OPTIONS);
export const PRACTICE_TYPE_LABELS = optionMap(PRACTICE_TYPE_OPTIONS);
export const CLINICAL_FOCUS_LABELS = optionMap(CLINICAL_FOCUS_OPTIONS);
export const BENEFIT_FLAG_LABELS = optionMap(BENEFIT_FLAG_OPTIONS);
export const SATURDAY_SCHEDULE_LABELS = optionMap(SATURDAY_SCHEDULE_OPTIONS);
export const BRAND_FILTER_LABELS = optionMap(BRAND_FILTER_OPTIONS);
export const COMPENSATION_TYPE_LABELS = optionMap(COMPENSATION_TYPE_OPTIONS);
export const LISTING_OPPORTUNITY_TYPE_LABELS = optionMap(LISTING_OPPORTUNITY_TYPE_OPTIONS);
export const LISTING_TIER_LABELS = optionMap(LISTING_TIER_OPTIONS);
export const LOCATION_PRECISION_LABELS = optionMap(LOCATION_PRECISION_OPTIONS);

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
    "optical manager": "optical_manager",
    optical_manager: "optical_manager",
    "vision center manager": "optical_manager",
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

export function expandBrandFilterValues(values = []) {
  const raw = Array.isArray(values)
    ? values
    : typeof values === "string"
    ? values.split(",")
    : values
    ? [values]
    : [];

  return Array.from(
    new Set(
      raw
        .map((value) => String(value || "").trim())
        .filter(Boolean)
        .flatMap((value) => BRAND_FILTER_ALIASES[value] || [value])
    )
  );
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
