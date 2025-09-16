// constants/jobTags.js

// 1) Your existing grouped categories (keep editable by non-devs)
export const JOB_TAG_CATEGORIES = [
  {
    label: "Clinical Focus",
    tags: ["Glaucoma", "Pediatrics", "Retina", "Dry Eye", "Low Vision", "Medical Optometry"],
  },
  {
    label: "Schedule",
    tags: ["Full-Time", "Part-Time", "Per Diem", "Flexible", "Evenings", "Weekends"],
  },
  {
    label: "Skills & Languages",
    tags: ["Bilingual", "Spanish", "Tech-Savvy", "Sales-Oriented", "Scribing Experience", "Coding & Billing"],
  },
  {
    label: "Practice Setting",
    tags: ["Private Practice", "Retail", "Hospital-Based", "Mobile", "Academic"],
  },
  {
    label: "Location Type",
    tags: ["Urban", "Suburban", "Rural", "Remote Eligible"],
  },
];

// 2) Canonical flat list (use these IDs everywhere in storage/search)
export const JOB_TAGS = JOB_TAG_CATEGORIES.flatMap((cat) =>
  cat.tags.map((label) => ({
    id: slugify(label), // e.g., "Full-Time" -> "full-time"
    label,
    category: cat.label,
  })),
);

// 3) Aliases (misspellings/variants -> canonical id)
export const JOB_TAG_ALIASES = {
  "full time": "full-time",
  ft: "full-time",
  "part time": "part-time",
  pt: "part-time",
  perdiem: "per-diem",
  "per diem": "per-diem",
  remote: "remote-eligible",
  hospital: "hospital-based",
  "dry-eye": "dry-eye",
  "lowvision": "low-vision",
  "tech savvy": "tech-savvy",
  "coding and billing": "coding-billing",
};

// 4) Restricted tags (empty now; add brand/employer later)
export const JOB_TAG_RESTRICTED = {
  // "target-optical": new Set(["luxottica", "target_org"]),
  // "walmart-vision": new Set(["walmart_corp"]),
};

// 5) Lookups + helpers (shared by frontend & backend)
const byId = new Map(JOB_TAGS.map((t) => [t.id, t]));
const byLabelLc = new Map(JOB_TAGS.map((t) => [t.label.toLowerCase(), t.id]));

export function resolveJobTag(input) {
  const q = normalize(input);
  if (!q) return null;
  if (JOB_TAG_ALIASES[q]) return JOB_TAG_ALIASES[q];
  if (byId.has(q)) return q;
  if (byLabelLc.has(q)) return byLabelLc.get(q);
  const hyphen = q.replace(/\s+/g, "-");
  if (byId.has(hyphen)) return hyphen;
  return null;
}

export function canUseJobTag(tagId, orgId) {
  const set = JOB_TAG_RESTRICTED[tagId];
  if (!set) return true;
  return set.has(orgId);
}

export function displayTagsForOrg(orgId) {
  return JOB_TAGS.filter((t) => canUseJobTag(t.id, orgId));
}

// --- utils ---
function slugify(label) {
  return label
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
}

function normalize(s) {
  return String(s || "").toLowerCase().trim().replace(/\s+/g, " ");
}
