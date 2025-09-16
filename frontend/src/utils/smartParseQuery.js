// src/utils/smartParseQuery.js

/**
 * Build quick lookup structures from the job list.
 * - companies: Map(lower -> canonical)
 * - roles: Set of lowercased roles
 * - cities: Set of lowercased city strings (and "city, st" if present)
 */
export function buildLookupFromJobs(jobs = []) {
  const companies = new Map();
  const roles = new Set();
  const cities = new Set();

  for (const j of jobs) {
    if (j?.company) {
      const canon = String(j.company).trim();
      companies.set(canon.toLowerCase(), canon);
    }
    if (j?.role) roles.add(String(j.role).toLowerCase());

    if (j?.location) {
      const loc = String(j.location).toLowerCase().trim();
      cities.add(loc);
      // also add first token (city) to help catches like "dallas"
      const cityOnly = loc.split(",")[0]?.trim();
      if (cityOnly) cities.add(cityOnly);
    }
  }

  return { companies, roles, cities };
}

/**
 * Very light NLP:
 *  - Recognize common hours/role synonyms
 *  - Try to match multi-word companies/cities by substring
 *  - Return tags + qClean with leftovers
 *
 * Returns:
 *  {
 *    result: { qClean, company?, role?, hours?, location? },
 *    tags:   [{type, value, label}]
 *  }
 */
export function smartParseQuery(q = "", lookup = { companies:new Map(), roles:new Set(), cities:new Set() }) {
  let raw = " " + String(q).toLowerCase().trim() + " ";
  const found = { };
  const tags = [];

  const add = (type, value, label = value) => {
    if (!found[type]) {
      found[type] = value;
      tags.push({ type, value, label });
    }
  };

  // --- hours synonyms ---
  const HOURS_MAP = [
    { re: /\b(f\/?t|full[\s-]?time)\b/, val: "full-time", label: "Full-time" },
    { re: /\b(p\/?t|part[\s-]?time)\b/, val: "part-time", label: "Part-time" },
    { re: /\b(prn|per[-\s]?diem)\b/, val: "prn", label: "PRN" },
  ];
  for (const h of HOURS_MAP) {
    if (h.re.test(raw)) {
      add("hours", h.val, h.label);
      raw = raw.replace(h.re, " ");
      break;
    }
  }

  // --- role synonyms ---
  const ROLE_MAP = [
    { re: /\bopt(om(etrist)?)?\b/, val: "optometrist", label: "Optometrist" },
    { re: /\boph(th(al(mologist)?)?)?\b/, val: "ophthalmologist", label: "Ophthalmologist" },
    { re: /\btech(nician)?\b/, val: "technician", label: "Technician" },
    { re: /\bass(is(ta)?)?nt\b/, val: "assistant", label: "Vision Assistant" },
    { re: /\bfront\s*desk\b/, val: "front desk", label: "Front Desk" },
  ];
  for (const r of ROLE_MAP) {
    if (r.re.test(raw)) {
      add("role", r.val, r.label);
      raw = raw.replace(r.re, " ");
      break;
    }
  }

  // --- companies from lookup (greedy multi-word search) ---
  // e.g., "target optical", "lenscrafters", etc.
  for (const [lower, canon] of lookup.companies.entries()) {
    const re = new RegExp(`\\b${escapeReg(lower)}\\b`);
    if (re.test(raw)) {
      add("company", lower, canon);
      raw = raw.replace(re, " ");
      break;
    }
  }
  // also catch "target" when your canonical is "Target Optical"
  if (!found.company) {
    for (const [lower, canon] of lookup.companies.entries()) {
      const firstWord = lower.split(" ")[0];
      if (firstWord && new RegExp(`\\b${escapeReg(firstWord)}\\b`).test(raw)) {
        add("company", lower, canon);
        raw = raw.replace(new RegExp(`\\b${escapeReg(firstWord)}\\b`), " ");
        break;
      }
    }
  }

  // --- city / location from lookup ---
  for (const loc of lookup.cities.values()) {
    const re = new RegExp(`\\b${escapeReg(loc)}\\b`);
    if (re.test(raw)) {
      add("location", loc, titleCase(loc));
      raw = raw.replace(re, " ");
      break;
    }
  }

  // cleanup leftover free-text
  const qClean = raw.replace(/\s+/g, " ").trim();

  const result = { qClean };
  if (found.company)  result.company  = found.company;
  if (found.role)     result.role     = found.role;
  if (found.hours)    result.hours    = found.hours;
  if (found.location) result.location = found.location;

  return { result, tags };
}

// ---------- helpers ----------
function escapeReg(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function titleCase(s) {
  return s
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ");
}
