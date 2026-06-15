function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

const ESSILORLUXOTTICA_BRANDS = [
  {
    brand: "LensCrafters",
    parentCompany: "EssilorLuxottica",
    patterns: [/\blens\s*crafters\b/i, /\blenscrafters\b/i],
  },
  {
    brand: "Target Optical",
    parentCompany: "EssilorLuxottica",
    patterns: [/\btarget\s+optical\b/i, /\btargetoptical\b/i],
  },
  {
    brand: "Pearle Vision",
    parentCompany: "EssilorLuxottica",
    patterns: [/\bpearle\s+vision\b/i, /\bpearlevision\b/i],
  },
  {
    brand: "For Eyes",
    parentCompany: "EssilorLuxottica",
    patterns: [/\bfor\s+eyes\b/i, /\bforeyes\b/i],
  },
];

const NATIONAL_VISION_BRANDS = [
  {
    brand: "America's Best",
    parentCompany: "National Vision",
    patterns: [
      /\bamerica'?s\s+best\b/i,
      /\bamericasbest\b/i,
      /\bamerica'?s\s+best\s+contacts?\s*&\s*eyeglasses\b/i,
    ],
  },
  {
    brand: "Eyeglass World",
    parentCompany: "National Vision",
    patterns: [/\beyeglass\s+world\b/i, /\beyeglassworld\b/i],
  },
  {
    brand: "Vista Optical - Military",
    parentCompany: "National Vision",
    patterns: [
      /\bvista\s+optical\b.*\bmilitary\b/i,
      /\bmilitary\b.*\bvista\s+optical\b/i,
      /\bvista\s+optical\b.*\bexchange\b/i,
    ],
  },
  {
    brand: "Vista Optical - Fred Meyer",
    parentCompany: "National Vision",
    patterns: [
      /\bvista\s+optical\b.*\bfred\s+meyer\b/i,
      /\bfred\s+meyer\b.*\bvista\s+optical\b/i,
    ],
  },
];

const NATIONAL_VISION_DOCTOR_GROUP = "National Vision Doctor of Optometry";

const NATIONAL_VISION_DIVISION_BRANDS = [
  {
    brand: "America's Best",
    patterns: [/\bambest\b/i, /\bam\s*best\b/i, /\bamerica'?s\s+best\b/i],
  },
  {
    brand: "Eyeglass World",
    patterns: [/\begw\b/i, /\beyeglass\s+world\b/i],
  },
  {
    brand: "Vista Optical - Military",
    patterns: [/\bmilitary\b/i],
  },
  {
    brand: "Vista Optical - Fred Meyer",
    patterns: [/\bfred\s*meyer\b/i, /\bfredmeyer\b/i],
  },
];

const NATIONAL_VISION_STORE_BRANDS = [
  {
    brand: "America's Best",
    patterns: [/\babc\b/i],
  },
  {
    brand: "Eyeglass World",
    patterns: [/\begw\b/i],
  },
  {
    brand: "Vista Optical - Military",
    patterns: [/\bmil\b/i],
  },
  {
    brand: "Vista Optical - Fred Meyer",
    patterns: [/\bfmy\b/i],
  },
];

const NATIONAL_VISION_CONSUMER_BRANDS = [
  {
    brand: "America's Best",
    patterns: [
      /\bamerica'?s\s+best\b/i,
      /\bamerica'?s\s+best\s+contacts?\s*&\s*eyeglasses\b/i,
    ],
  },
  {
    brand: "Eyeglass World",
    patterns: [/\beyeglass\s+world\b/i],
  },
  {
    brand: "Vista Optical - Military",
    patterns: [
      /\bvista\s+optical\b.*\bmilitary\b/i,
      /\bvista\s+optical\b.*\bexchange\b/i,
      /\bmilitary\b.*\bvista\s+optical\b/i,
    ],
  },
  {
    brand: "Vista Optical - Fred Meyer",
    patterns: [
      /\bvista\s+optical\b.*\bfred\s+meyer\b/i,
      /\bfred\s+meyer\b.*\bvista\s+optical\b/i,
    ],
  },
];

function detectBrandEntry(fields = {}, entries = []) {
  const haystack = [
    fields.employerBrand,
    fields.employerName,
    fields.parentCompany,
    fields.practiceName,
    fields.company,
    fields.title,
    fields.description,
    fields.sourceUrl,
    fields.applyUrl,
  ]
    .map(cleanText)
    .filter(Boolean)
    .join(" ");

  for (const entry of entries) {
    if (entry.patterns.some((pattern) => pattern.test(haystack))) {
      return entry;
    }
  }

  return null;
}

function detectEssilorLuxotticaBrand(fields = {}) {
  return detectBrandEntry(fields, ESSILORLUXOTTICA_BRANDS)?.brand || null;
}

function customFieldEntriesFrom(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (Array.isArray(value.customField)) return value.customField;
  if (Array.isArray(value.customFields)) return value.customFields;
  if (value.smartRecruitersDetail) return customFieldEntriesFrom(value.smartRecruitersDetail);
  if (value.smartRecruiters) return customFieldEntriesFrom(value.smartRecruiters);
  if (value.discoveryResult) return customFieldEntriesFrom(value.discoveryResult);
  if (value.sourceDetail) return customFieldEntriesFrom(value.sourceDetail);
  return [];
}

function normalizeCustomLabel(value) {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function customFieldText(entry = {}) {
  return cleanText(
    [
      entry.valueLabel,
      entry.label,
      entry.value,
      entry.valueId,
      entry.id,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function customFieldValues(fields = {}, labels = []) {
  const normalizedLabels = labels.map(normalizeCustomLabel);
  return customFieldEntriesFrom(fields)
    .filter((entry) => normalizedLabels.includes(normalizeCustomLabel(entry.fieldLabel || entry.name)))
    .map(customFieldText)
    .filter(Boolean);
}

function brandFromEntries(values = [], entries = []) {
  const haystack = values.map(cleanText).filter(Boolean).join(" ");
  if (!haystack) return null;
  for (const entry of entries) {
    if (entry.patterns.some((pattern) => pattern.test(haystack))) return entry.brand;
  }
  return null;
}

function hasNationalVisionDetail(fields = {}) {
  const text = [
    fields.parentCompany,
    fields.employerName,
    fields.company,
    fields.sourceUrl,
    fields.applyUrl,
    fields.smartRecruitersDetail?.company?.name,
    fields.smartRecruitersDetail?.company?.identifier,
    fields.smartRecruiters?.company?.name,
    fields.smartRecruiters?.company?.identifier,
  ]
    .map(cleanText)
    .filter(Boolean)
    .join(" ");
  return /national\s+vision/i.test(text) || /\bnationalvision1\b/i.test(text);
}

function isNationalVisionDoctorRole(fields = {}) {
  const values = [
    ...customFieldValues(fields, ["Job Family", "Category 1", "Job Title"]),
    fields.title,
    fields.rawTitle,
    fields.primaryRole,
    fields.roleBadge,
  ]
    .map(cleanText)
    .filter(Boolean)
    .join(" ");

  return /\bdoctor\b/i.test(values) || /\bod\b/i.test(values) || /\boptometrist\b/i.test(values);
}

function inferNationalVisionAttribution(fields = {}) {
  if (!hasNationalVisionDetail(fields)) return null;

  const divisionBrand = brandFromEntries(
    customFieldValues(fields, ["Division"]),
    NATIONAL_VISION_DIVISION_BRANDS
  );
  const storeBrand = brandFromEntries(
    customFieldValues(fields, ["Store/Cost Center", "Store Cost Center"]),
    NATIONAL_VISION_STORE_BRANDS
  );
  const consumerBrand = brandFromEntries(
    customFieldValues(fields, ["Brands", "Brand"]),
    NATIONAL_VISION_CONSUMER_BRANDS
  );
  const detectedBrand = detectBrandEntry(fields, NATIONAL_VISION_BRANDS)?.brand || null;
  const employerBrand = divisionBrand || storeBrand || consumerBrand || detectedBrand || null;
  const practiceName = isNationalVisionDoctorRole(fields)
    ? NATIONAL_VISION_DOCTOR_GROUP
    : null;

  if (!employerBrand && !practiceName && !/national\s+vision/i.test(cleanText(fields.parentCompany || fields.employerName || fields.company))) {
    return null;
  }

  return {
    parentCompany: "National Vision",
    employerBrand,
    practiceName,
  };
}

const RETAIL_OPTICAL_BRANDS = [
  {
    brand: "Costco Optical",
    parentCompany: "Costco Wholesale",
    parentPatterns: [/\bcostco\b/i],
    brandPatterns: [/\bcostco\s+optical\b/i],
    opticalRolePatterns: [/\boptical\b/i, /\boptician\b/i, /\boptometrist\b/i],
  },
  {
    brand: "Sam's Club Optical",
    parentCompany: "Walmart Inc.",
    parentPatterns: [/\bsam'?s\s+club\b/i, /\bsams\s+club\b/i, /\bwalmart\b/i],
    brandPatterns: [/\bsam'?s\s+club\s+optical\b/i, /\bsams\s+club\s+optical\b/i],
    opticalRolePatterns: [/\boptical\b/i, /\boptician\b/i, /\boptometrist\b/i],
  },
  {
    brand: "Walmart Vision Center",
    parentCompany: "Walmart Inc.",
    parentPatterns: [/\bwalmart\b/i],
    brandPatterns: [/\bwalmart\s+vision\s+centers?\b/i, /\bwalmart\s+optical\b/i],
    opticalRolePatterns: [/\bvision\s+center\b/i, /\boptical\b/i, /\boptician\b/i, /\boptometrist\b/i],
  },
];

function detectRetailOpticalAttribution(fields = {}) {
  const parentHaystack = [
    fields.employerName,
    fields.company,
    fields.parentCompany,
  ]
    .map(cleanText)
    .filter(Boolean)
    .join(" ");

  const fullHaystack = [
    parentHaystack,
    fields.employerBrand,
    fields.title,
    fields.description,
    fields.sourceUrl,
    fields.applyUrl,
  ]
    .map(cleanText)
    .filter(Boolean)
    .join(" ");

  for (const entry of RETAIL_OPTICAL_BRANDS) {
    const explicitBrand = entry.brandPatterns.some((pattern) => pattern.test(fullHaystack));
    const parentMatch = entry.parentPatterns.some((pattern) => pattern.test(parentHaystack));
    const opticalRoleMatch = entry.opticalRolePatterns.some((pattern) => pattern.test(fullHaystack));

    if (explicitBrand || (parentMatch && opticalRoleMatch)) {
      return {
        employerBrand: entry.brand,
        parentCompany: entry.parentCompany,
      };
    }
  }

  return null;
}

function sameName(a, b) {
  const left = cleanText(a).toLowerCase();
  const right = cleanText(b).toLowerCase();
  return Boolean(left && right && left === right);
}

function isGenericParentPracticeCandidate(candidate) {
  return (
    /essilor\s*luxottica/i.test(candidate) ||
    /national\s+vision/i.test(candidate) ||
    /costco\s+wholesale/i.test(candidate) ||
    /^walmart$/i.test(candidate)
  );
}

function inferPracticeName(fields = {}, { parentCompany = null, employerBrand = null } = {}) {
  const explicitPractice = cleanText(fields.practiceName || fields.practice_name);
  if (explicitPractice && !isGenericParentPracticeCandidate(explicitPractice)) {
    return explicitPractice;
  }

  const candidates = [
    fields.venueName,
    fields.venue_name,
    fields.company,
    fields.employerName,
  ]
    .map(cleanText)
    .filter(Boolean);

  for (const candidate of candidates) {
    if (sameName(candidate, parentCompany) || sameName(candidate, employerBrand)) continue;
    if (isGenericParentPracticeCandidate(candidate)) continue;
    return candidate;
  }

  if (!employerBrand && candidates[0] && !isGenericParentPracticeCandidate(candidates[0])) {
    return candidates[0];
  }
  return null;
}

function inferEmployerAttribution(fields = {}) {
  const employerName = cleanText(fields.employerName);
  const company = cleanText(fields.company);
  const existingBrand = cleanText(fields.employerBrand) || null;
  const essilorEntry = detectBrandEntry(fields, ESSILORLUXOTTICA_BRANDS);
  const nationalVisionEntry = detectBrandEntry(fields, NATIONAL_VISION_BRANDS);
  const nationalVisionAttribution = inferNationalVisionAttribution(fields);
  const retailOpticalAttribution = detectRetailOpticalAttribution(fields);
  const parentCompany =
    cleanText(
      essilorEntry?.parentCompany ||
        nationalVisionAttribution?.parentCompany ||
        nationalVisionEntry?.parentCompany ||
        retailOpticalAttribution?.parentCompany ||
        fields.parentCompany ||
        employerName ||
        company
    ) || null;
  const parentLooksEssilor = /essilor\s*luxottica/i.test(parentCompany || "");
  const parentLooksNationalVision = /national\s+vision/i.test(parentCompany || "");
  const employerBrand =
    existingBrand ||
    (parentLooksEssilor || essilorEntry ? essilorEntry?.brand : null) ||
    (parentLooksNationalVision || nationalVisionAttribution
      ? nationalVisionAttribution?.employerBrand
      : null) ||
    (parentLooksNationalVision || nationalVisionEntry ? nationalVisionEntry?.brand : null) ||
    retailOpticalAttribution?.employerBrand ||
    null;
  const practiceName =
    nationalVisionAttribution?.practiceName ||
    inferPracticeName(fields, { parentCompany, employerBrand });

  return {
    parentCompany,
    employerBrand,
    practiceName,
    displayCompany: employerBrand || practiceName || company || employerName || parentCompany || null,
  };
}

module.exports = {
  detectEssilorLuxotticaBrand,
  detectBrandEntry,
  inferNationalVisionAttribution,
  detectRetailOpticalAttribution,
  inferEmployerAttribution,
};
