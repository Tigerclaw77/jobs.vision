export const JOB_TAG_TAXONOMY = [
  {
    category: "Clinical Focus",
    tags: [
      { value: "vision_therapy", label: "Vision Therapy" },
      { value: "scleral_lenses", label: "Scleral Lenses" },
      { value: "dry_eye", label: "Dry Eye" },
      { value: "pediatrics", label: "Pediatrics" },
      { value: "myopia_management", label: "Myopia Management" },
      { value: "glaucoma", label: "Glaucoma" },
      { value: "retina", label: "Retina" },
      { value: "low_vision", label: "Low Vision" },
      { value: "medical_optometry", label: "Medical Optometry" },
      { value: "specialty_contact_lenses", label: "Specialty Contact Lenses" },
    ],
  },
  {
    category: "Skills & Languages",
    tags: [
      { value: "bilingual_spanish", label: "Bilingual Spanish" },
      { value: "bilingual", label: "Bilingual" },
      { value: "scribing_experience", label: "Scribing Experience" },
      { value: "coding_billing", label: "Coding & Billing" },
      { value: "optical_sales", label: "Optical Sales" },
      { value: "contact_lens_fitting", label: "Contact Lens Fitting" },
    ],
  },
  {
    category: "Practice Setting",
    tags: [
      { value: "private_practice", label: "Private Practice" },
      { value: "retail_optical", label: "Retail Optical" },
      { value: "od_md", label: "OD/MD" },
      { value: "multi_location_group", label: "Multi-Location Group" },
      { value: "mobile", label: "Mobile" },
      { value: "academic", label: "Academic" },
    ],
  },
  {
    category: "Patient Population",
    tags: [
      { value: "family_practice", label: "Family Practice" },
      { value: "geriatric", label: "Geriatric" },
      { value: "medical_heavy", label: "Medical-Heavy" },
      { value: "primary_care", label: "Primary Care" },
    ],
  },
];

export const JOB_TAG_OPTIONS = JOB_TAG_TAXONOMY.flatMap((group) =>
  group.tags.map((tag) => ({
    ...tag,
    id: tag.value,
    category: group.category,
  }))
);

export const JOB_TAG_ALIASES = {
  "bilingual spanish": "bilingual_spanish",
  spanish: "bilingual_spanish",
  "coding and billing": "coding_billing",
  "coding billing": "coding_billing",
  "contact lenses": "contact_lens_fitting",
  "contact lens": "contact_lens_fitting",
  "dry-eye": "dry_eye",
  dryeye: "dry_eye",
  "lowvision": "low_vision",
  "medical optometry": "medical_optometry",
  "myopia control": "myopia_management",
  "myopia management": "myopia_management",
  "od md": "od_md",
  "od/md": "od_md",
  "retail": "retail_optical",
  "scleral lens": "scleral_lenses",
  "scleral lenses": "scleral_lenses",
  sclerals: "scleral_lenses",
  "specialty contacts": "specialty_contact_lenses",
  "vision therapy": "vision_therapy",
};

const tagById = new Map(JOB_TAG_OPTIONS.map((tag) => [tag.value, tag]));
const tagByLabel = new Map(
  JOB_TAG_OPTIONS.map((tag) => [normalizeJobTagKey(tag.label), tag.value])
);

export function normalizeJobTagKey(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[/-]+/g, " ")
    .replace(/[_]+/g, " ")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ");
}

export function normalizeJobTagToken(value = "") {
  return normalizeJobTagKey(value).replace(/\s+/g, "_");
}

export function resolveJobTag(input) {
  const key = normalizeJobTagKey(input);
  if (!key) return null;
  const token = normalizeJobTagToken(key);
  return JOB_TAG_ALIASES[key] || JOB_TAG_ALIASES[token] || tagByLabel.get(key) || tagById.get(token)?.value || null;
}

export function canonicalizeJobTagInput(input) {
  return resolveJobTag(input) || normalizeJobTagToken(input);
}

export function displayJobTagLabel(value = "") {
  const resolved = resolveJobTag(value) || normalizeJobTagToken(value);
  if (tagById.has(resolved)) return tagById.get(resolved).label;
  return String(value || resolved)
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function canUseJobTag(tagId, orgId, restrictedTags = {}) {
  const set = restrictedTags[tagId];
  if (!set) return true;
  return set.has(orgId);
}

export function displayTagsForOrg(orgId, restrictedTags = {}) {
  return JOB_TAG_OPTIONS.filter((tag) => canUseJobTag(tag.value, orgId, restrictedTags));
}
