const { cleanText, stableLower } = require("./utils");

const ROLE_BADGES = new Set([
  "OD",
  "OPTICIAN",
  "TECH",
  "MANAGER",
  "OPTICAL",
  "FRONT_DESK",
  "OMD",
  "OTHER",
  "UNKNOWN",
]);
const APPROVABLE_BADGES = new Set(["OD", "OPTICIAN", "TECH", "MANAGER", "OPTICAL", "FRONT_DESK"]);

function hasAny(text, patterns = []) {
  return patterns.some((pattern) => {
    if (pattern instanceof RegExp) return pattern.test(text);
    return text.includes(stableLower(pattern));
  });
}

function displayEmploymentType(value) {
  const labels = {
    full_time: "Full-Time",
    part_time: "Part-Time",
    per_diem_fill_in: "Per Diem / Fill-In",
  };
  return labels[value] || null;
}

function detectSpecialty(text) {
  const specialties = [];
  const specialtyPatterns = [
    ["Glaucoma", [/\bglaucoma\b/]],
    ["Cornea", [/\bcornea\b/, /\bcorneal\b/]],
    ["Retina", [/\bretina\b/, /\bretinal\b/]],
    ["Pediatrics", [/\bpediatric(s)?\b/, /\bchildren'?s vision\b/]],
    ["Cataract", [/\bcataract\b/]],
    ["Medical", [/\bmedical optometry\b/, /\bmedical eye care\b/]],
    ["Primary Care", [/\bprimary care\b/, /\bcomprehensive eye care\b/, /\bcomprehensive ophthalmology\b/]],
  ];

  for (const [label, patterns] of specialtyPatterns) {
    if (hasAny(text, patterns)) specialties.push(label);
  }

  return specialties.length ? specialties.join(", ") : null;
}

function detectPracticeType(text) {
  if (hasAny(text, ["private practice", "family eye care", "independent practice"])) {
    return "Private Practice";
  }
  if (
    hasAny(text, [
      "corporate",
      "retail optical",
      "national vision",
      "lenscrafters",
      "visionworks",
      "costco optical",
      "costco wholesale",
      "sam's club optical",
      "sams club optical",
      "walmart vision center",
      "walmart optical",
    ])
  ) {
    return "Corporate";
  }
  if (hasAny(text, ["od/md", "ophthalmology", "ophthalmologist", "surgery center", "retina", "glaucoma", "cataract"])) {
    return "OD/MD";
  }
  return null;
}

function hasEyecareContext(text) {
  return hasAny(text, [
    /\bamerican vision partners\b/,
    /\bamerica'?s best\b/,
    /\bclarkson eyecare\b/,
    /\bcostco optical\b/,
    /\bcostco wholesale\b/,
    /\beye ?south\b/,
    /\beyeglass world\b/,
    /\blenscrafters\b/,
    /\bmyeyedr\b/,
    /\bnational vision\b/,
    /\bpearle vision\b/,
    /\bsam'?s club optical\b/,
    /\bsams club optical\b/,
    /\btarget optical\b/,
    /\bvision innovation partners\b/,
    /\bvisionworks\b/,
    /\bwalmart vision centers?\b/,
    /\bwalmart optical\b/,
    /\bophthalmology\b/,
    /\bophthalmic\b/,
    /\boptometry\b/,
    /\boptometric\b/,
    /\boptometrist\b/,
    /\boptician\b/,
    /\boptical\b/,
    /\beye clinic\b/,
    /\beye\s?care\b/,
    /\beyecare\b/,
    /\bvision\b/,
    /\bvision center\b/,
    /\bretina\b/,
    /\bglaucoma\b/,
    /\bcataract\b/,
  ]);
}

function detectNonJobPage(titleText) {
  const title = titleText.trim();
  const nonJobTitles = new Set([
    "access the internal applicant portal",
    "benefits",
    "corporate",
    "jobvite vs icims",
    "jobvite vs smartrecruiters",
    "lab & distribution center",
    "od career opportunities",
    "od referral program",
    "overview",
    "retail careers",
    "set up a job alert",
    "skip to content",
    "view independent practices by state",
    "what is a sublease?",
  ]);

  if (
    nonJobTitles.has(title) ||
    hasAny(title, [
      /^job alerts?$/,
      /^career(s)?$/,
      /^careers home$/,
      /^search jobs$/,
      /^view all jobs$/,
      /^join our talent community$/,
    ])
  ) {
    return {
      badge: "OTHER",
      primaryRole: "Other",
      secondaryRole: "Non-job page",
      confidence: 99,
      source: "navigation_or_informational",
    };
  }

  return null;
}

function detectNursingRole(titleText, fullText) {
  const isNursingTitle = hasAny(titleText, [
    /\bregistered nurse\b/,
    /\bnurse practitioner\b/,
    /\bnursing assistant\b/,
    /\bsurgical rn\b/,
    /\bor nurse\b/,
    /\bpacu nurse\b/,
    /\bpre[-\s]?op nurse\b/,
    /\brecovery nurse\b/,
    /\bperioperative nurse\b/,
    /\bnurse\b/,
    /\bcrna\b/,
    /\brn\b/,
    /\blpn\b/,
    /\blvn\b/,
    /\bcna\b/,
    /\bnp\b/,
  ]);

  if (!isNursingTitle) return null;

  return {
    badge: "OTHER",
    primaryRole: "Other",
    secondaryRole: "Nursing",
    confidence: 96,
    source: "generic_nursing",
  };
}

function detectFrontDeskRole(titleText, fullText) {
  const hasFrontDeskTitle = hasAny(titleText, [
    /\bfront desk\b/,
    /\bfront office\b/,
    /\breceptionist\b/,
    /\bpatient care coordinator\b/,
    /\bpatient services representative\b/,
    /\bpatient services specialist\b/,
    /\bpatient service representative\b/,
    /\bpatient service specialist\b/,
    /\bpatient access representative\b/,
    /\bpatient coordinator\b/,
    /\bpatient care associate\b/,
    /\bscheduling coordinator\b/,
    /\bscheduling specialist\b/,
    /\bscheduler\b/,
    /\bappointment scheduler\b/,
    /\bcall center representative\b/,
    /\bcall center scheduling specialist\b/,
    /\bmedical records coordinator\b/,
    /\bauthorization specialist\b/,
    /\bauthorization coordinator\b/,
    /\bauthorization team supervisor\b/,
    /\bpayment posting specialist\b/,
    /\bar specialist\b/,
    /\bpatient ar specialist\b/,
    /\badministrative assistant\b/,
    /\bcustomer resolution specialist\b/,
    /\bprovider enrollment specialist\b/,
    /\bpremium surgery counselor\b/,
    /\bsurgery coordinator\b/,
    /\bsurgical coordinator\b/,
  ]);

  if (!hasFrontDeskTitle) return null;

  if (hasEyecareContext(fullText)) {
    return {
      badge: "FRONT_DESK",
      primaryRole: "Front Desk",
      secondaryRole: "Patient-facing admin",
      confidence: 96,
      source: "eyecare_front_desk",
    };
  }

  return {
    badge: "OTHER",
    primaryRole: "Other",
    secondaryRole: "Patient-facing admin",
    confidence: 66,
    source: "generic_patient_admin",
  };
}

function detectOpticalRole(titleText, fullText) {
  if (
    hasAny(titleText, [
      /\boptical sales associate\b/,
      /\bsales associate\s*[-–—]\s*optical\b/,
      /\boptical team member\b/,
      /\boptical retail associate\b/,
      /\boptical associate\b/,
      /\boptical clerk\b/,
      /\boptical lab member service clerk\b/,
      /\boptical lab member service assistant\b/,
      /\bassistant manager\s*[-–—]\s*optical\b/,
      /\boptical manager\b/,
      /\bmanager\s*[-–—]\s*optical\b/,
      /\boptical sales\b/,
      /\beyewear consultant\b/,
      /\bframe stylist\b/,
      /\boptical lab\b/,
      /\blab technician\b/,
      /\blab manager\b/,
    ])
  ) {
    return {
      badge: "OPTICAL",
      primaryRole: "Optical",
      secondaryRole: null,
      confidence: 96,
      source: "optical_title",
    };
  }

  if (
    hasEyecareContext(fullText) &&
    hasAny(titleText, [
      /\bsales associate\s*[-–—]\s*training provided\b/,
      /\bsales associate\s*[-–—]\s*training provided\s*[-–—]\s*entry level into medical industry\b/,
    ])
  ) {
    return {
      badge: "OPTICAL",
      primaryRole: "Optical",
      secondaryRole: "Optical Sales",
      confidence: 96,
      source: "optical_retail_training",
    };
  }

  return null;
}

function detectCorporateBackOfficeRole(titleText) {
  if (
    hasAny(titleText, [
      /\bauthorization manager\b/,
      /\bcertified coder\b/,
      /\bcredit balance specialist\b/,
      /\brevenue cycle\b/,
      /\brcm billing manager\b/,
      /\bsenior revenue cycle specialist\b/,
      /\bmedical billing specialist\b/,
      /\bsenior financial analyst\b/,
      /\bmarketing operations manager\b/,
      /\bproject manager,\s*de novo construction\b/,
      /\bde novo construction\b/,
      /\bregional vice president\b/,
      /\bphysician liaison\b/,
      /\bpremium services mgr\b/,
    ])
  ) {
    return {
      badge: "OTHER",
      primaryRole: "Other",
      secondaryRole: "Corporate back office",
      confidence: 97,
      source: "corporate_back_office",
    };
  }

  return null;
}

function detectEyecareAdministrativeRole(titleText, fullText) {
  const hasAdminCoordinationTitle = hasAny(titleText, [
    /\bsurgical coordinator\b/,
    /\bsurgery coordinator\b/,
    /\bsurgical counselor\b/,
    /\bsurgery counselor\b/,
    /\bsurgery scheduler\b/,
    /\bsurgical scheduler\b/,
    /\binsurance coordinator\b/,
    /\bprior authorization coordinator\b/,
    /\bpatient counselor\b/,
  ]);
  const hasAdminLeadershipTitle = hasAny(titleText, [
    /\bsurgical coordinator supervisor\b/,
    /\bsurgery coordinator supervisor\b/,
    /\bclinic administrator\b/,
    /\bpractice administrator\b/,
  ]);

  if (!hasAdminCoordinationTitle && !hasAdminLeadershipTitle) return null;

  if (!hasEyecareContext(fullText)) {
    return {
      badge: "OTHER",
      primaryRole: "Other",
      secondaryRole: hasAdminLeadershipTitle ? "Administrative leadership" : "Administrative coordination",
      confidence: 70,
      source: "generic_admin_coordination",
    };
  }

  if (hasAdminLeadershipTitle) {
    return {
      badge: "MANAGER",
      primaryRole: "Manager",
      secondaryRole: "Administrative leadership",
      confidence: 96,
      source: "eyecare_admin_management",
    };
  }

  return {
    badge: "FRONT_DESK",
    primaryRole: "Front Desk",
    secondaryRole: "Patient-facing admin",
    confidence: 96,
    source: "eyecare_admin_coordination",
  };
}

function detectTechnicianRole(titleText, fullText) {
  if (
    hasAny(titleText, [
      /\bophthalmic technician\b/,
      /\bophthalmic tech\b/,
      /\bophthalmic assistant\b/,
      /\bophthalmic medical assistant\b/,
      /\boptometric technician\b/,
      /\boptometric assistant\b/,
      /\boptical technician\b/,
      /\beye care technician\b/,
      /\beye care assistant\b/,
      /\bworkup technician\b/,
      /\bcontact lens technician\b/,
      /\bpre[-\s]?tester\b/,
      /\bdoctor assistant\b/,
      /\bdr\.?\s+assistant\b/,
      /\bdoctor assistant\s*\/\s*pre[-\s]?tester\b/,
      /\bscribe\b/,
    ])
  ) {
    return {
      badge: "TECH",
      primaryRole: "Technician",
      secondaryRole: "Ophthalmic Technician",
      confidence: 96,
      source: "tech_title",
    };
  }

  if (
    hasEyecareContext(fullText) &&
    hasAny(titleText, [
      /\bscrub tech\b/,
      /\bscrub technician\b/,
      /\bcertified scrub tech\b/,
      /\bsurgical technician\b/,
      /\bsurgical tech\b/,
      /\bsterile processing technician\b/,
      /\bspd technician\b/,
      /\bsurgery assistant\b/,
      /\bclinical services specialist\b/,
      /\bclinical research assistant\b/,
    ])
  ) {
    return {
      badge: "TECH",
      primaryRole: "Technician",
      secondaryRole: "Ophthalmic Support",
      confidence: 95,
      source: "eyecare_surgical_support",
    };
  }

  return null;
}

function detectGenericClinicalSupport(titleText, fullText) {
  const hasGenericClinicalSupport = hasAny(titleText, [
    /\bmedical assistant\b/,
    /\bclinical assistant\b/,
    /\bpatient care technician\b/,
    /\bpatient care associate\b/,
  ]);

  if (!hasGenericClinicalSupport) return null;

  if (
    hasAny(titleText, [
      /\bophthalmic medical assistant\b/,
      /\bophthalmic assistant\b/,
      /\boptometric assistant\b/,
      /\beye care assistant\b/,
    ]) ||
    hasEyecareContext(fullText)
  ) {
    return {
      badge: "TECH",
      primaryRole: "Technician",
      secondaryRole: "Ophthalmic Assistant",
      confidence: 78,
      source: "eyecare_clinical_support",
    };
  }

  return {
    badge: "OTHER",
    primaryRole: "Other",
    secondaryRole: "Clinical support",
    confidence: 70,
    source: "generic_healthcare_support",
  };
}

function hasNonProviderTitleSignal(titleText) {
  return hasAny(titleText, [
    /\bassistant\b/,
    /\btechnician\b/,
    /\btech\b/,
    /\bcoordinator\b/,
    /\bscheduler\b/,
    /\bcounselor\b/,
    /\bsales\b/,
    /\bmanager\b/,
    /\badministrator\b/,
    /\brecruiter\b/,
    /\bliaison\b/,
    /\bscribe\b/,
    /\boptician\b/,
    /\bfront office\b/,
    /\bfront desk\b/,
  ]);
}

function detectTitleRole(titleText) {
  if (
    hasAny(titleText, [
      /\bophthalmologist\b/,
      /\bophthalmology physician\b/,
      /\bophthalmic surgeon\b/,
      /\b(vitreoretinal|retina|retinal|cornea|corneal|glaucoma|cataract|oculoplastic)\s+surgeon\b/,
      /\b(comprehensive|general|medical)\s+ophthalmologist\b/,
    ])
  ) {
    return {
      badge: "OMD",
      primaryRole: "OMD",
      secondaryRole: "Ophthalmologist",
      confidence: 99,
      source: "title",
    };
  }

  if (
    hasAny(titleText, [
      /\boptometrist\b/,
      /\bdoctor of optometry\b/,
      /\btherapeutic optometrist\b/,
      /\boptometric physician\b/,
      /\bo\.d\.\b/,
      /\bod\b/,
    ])
  ) {
    if (hasNonProviderTitleSignal(titleText)) {
      return null;
    }

    return {
      badge: "OD",
      primaryRole: "OD",
      secondaryRole: "Optometrist",
      confidence: 98,
      source: "title",
    };
  }

  if (
    hasAny(titleText, [
      /\bvision center manager\b/,
      /\bcertified optical manager\b/,
      /\boptical manager\b/,
      /\bmanager\s*[-â€“â€”]\s*optical\b/,
      /\bmanager\b.*\b(vision center|optical)\b/,
    ])
  ) {
    return {
      badge: "MANAGER",
      primaryRole: "Manager",
      secondaryRole: "Optical Manager",
      confidence: 96,
      source: "title",
    };
  }

  if (
    hasAny(titleText, [
      /\boptician\b/,
      /\blicensed optician\b/,
      /\bdispensing optician\b/,
      /\boptical apprentice\b/,
      /\bapprentice optician\b/,
      /\boptician\b.*\bapprentice\b/,
    ])
  ) {
    return {
      badge: "OPTICIAN",
      primaryRole: "Optician",
      secondaryRole: null,
      confidence: 96,
      source: "title",
    };
  }

  if (hasAny(titleText, [/\bpractice manager\b/, /\boffice manager\b/, /\badministrator\b/, /\bclinic manager\b/])) {
    return {
      badge: "MANAGER",
      primaryRole: "Manager",
      secondaryRole: "Practice Manager",
      confidence: 94,
      source: "title",
    };
  }

  return null;
}

function detectRequirementSignals(fullText) {
  const od = hasAny(fullText, [
    /\bdoctor of optometry\b/,
    /\boptometric license\b/,
    /\boptometry license\b/,
    /\blicensed optometrist\b/,
    /\bstate od license\b/,
    /\bod license\b/,
    /\bo\.d\. degree\b/,
    /\bod degree\b/,
  ]);
  const omd = hasAny(fullText, [
    /\bboard certified ophthalmologist\b/,
    /\bboard eligible ophthalmologist\b/,
    /\bbe\/bc ophthalmologist\b/,
    /\bophthalmology residency\b/,
    /\bfellowship trained ophthalmologist\b/,
    /\bfellowship-trained ophthalmologist\b/,
    /\bmd\/do\b/,
    /\bm\.d\.\b/,
    /\bd\.o\.\b/,
    /\bmedical degree\b/,
    /\bamerican board of ophthalmology\b/,
    /\bophthalmologist license\b/,
  ]);

  return { od, omd };
}

function detectAmbiguousSpecialtyTitle(titleText) {
  return hasAny(titleText, [
    /\b(glaucoma|cornea|corneal|retina|retinal|pediatric|medical|comprehensive)\s+specialist\b/,
    /\bspecialist\s+-?\s+(glaucoma|cornea|corneal|retina|retinal|pediatric|medical)\b/,
  ]);
}

function roleFromSignals(titleText, fullText, roleTags = []) {
  const tags = new Set(roleTags || []);
  const nonJobPage = detectNonJobPage(titleText);
  const titleRole = detectTitleRole(titleText);
  const technicianRole = detectTechnicianRole(titleText, fullText);
  const opticalRole = detectOpticalRole(titleText, fullText);
  const corporateBackOfficeRole = detectCorporateBackOfficeRole(titleText);
  const requirementSignals = detectRequirementSignals(fullText);
  const ambiguousSpecialtyTitle = detectAmbiguousSpecialtyTitle(titleText);
  const nursingRole = detectNursingRole(titleText, fullText);
  const frontDeskRole = detectFrontDeskRole(titleText, fullText);
  const eyecareAdministrativeRole = detectEyecareAdministrativeRole(titleText, fullText);
  const genericClinicalSupportRole = detectGenericClinicalSupport(titleText, fullText);

  if (nonJobPage) return nonJobPage;
  if (nursingRole) return nursingRole;
  if (corporateBackOfficeRole) return corporateBackOfficeRole;
  if (eyecareAdministrativeRole) return eyecareAdministrativeRole;
  if (titleRole) return titleRole;
  if (technicianRole) return technicianRole;
  if (frontDeskRole) return frontDeskRole;
  if (opticalRole) return opticalRole;
  if (genericClinicalSupportRole) return genericClinicalSupportRole;

  if (ambiguousSpecialtyTitle && requirementSignals.omd && !requirementSignals.od) {
    return {
      badge: "OMD",
      primaryRole: "OMD",
      secondaryRole: "Ophthalmologist",
      confidence: 92,
      source: "requirements",
    };
  }

  if (ambiguousSpecialtyTitle && requirementSignals.od && !requirementSignals.omd) {
    return {
      badge: "OD",
      primaryRole: "OD",
      secondaryRole: "Optometrist",
      confidence: 90,
      source: "requirements",
    };
  }

  if (ambiguousSpecialtyTitle) {
    return {
      badge: "UNKNOWN",
      primaryRole: "Unknown",
      secondaryRole: null,
      confidence: requirementSignals.omd || requirementSignals.od ? 72 : 65,
      source: "ambiguous_specialty_title",
    };
  }

  if (requirementSignals.omd && !requirementSignals.od) {
    return {
      badge: "OMD",
      primaryRole: "OMD",
      secondaryRole: "Ophthalmologist",
      confidence: 92,
      source: "requirements",
    };
  }

  if (requirementSignals.od && !requirementSignals.omd) {
    return {
      badge: "OD",
      primaryRole: "OD",
      secondaryRole: "Optometrist",
      confidence: 91,
      source: "requirements",
    };
  }

  if (requirementSignals.od && requirementSignals.omd) {
    return {
      badge: "UNKNOWN",
      primaryRole: "Unknown",
      secondaryRole: null,
      confidence: 70,
      source: "conflicting_requirements",
    };
  }

  if (tags.has("optician")) {
    return { badge: "OPTICIAN", primaryRole: "Optician", secondaryRole: null, confidence: 78, source: "tags" };
  }
  if (tags.has("ophthalmic_technician") || tags.has("contact_lens_technician")) {
    return { badge: "TECH", primaryRole: "Technician", secondaryRole: "Ophthalmic Technician", confidence: 78, source: "tags" };
  }
  if (tags.has("practice_manager")) {
    return { badge: "MANAGER", primaryRole: "Manager", secondaryRole: "Practice Manager", confidence: 76, source: "tags" };
  }
  if (tags.has("front_desk")) {
    return { badge: "FRONT_DESK", primaryRole: "Front Desk", secondaryRole: "Patient-facing admin", confidence: 75, source: "tags" };
  }
  if (tags.has("optical_sales")) {
    return { badge: "OPTICAL", primaryRole: "Optical", secondaryRole: null, confidence: 75, source: "tags" };
  }

  return {
    badge: "UNKNOWN",
    primaryRole: "Unknown",
    secondaryRole: null,
    confidence: 55,
    source: "unknown",
  };
}

function reasonForClassification({ role, specialty }) {
  if (role.badge === "OMD") {
    return role.source === "title"
      ? "Job title identifies the hiring target as an ophthalmologist or surgical specialist."
      : "Licensure or training requirements point to an ophthalmologist or surgical specialist role.";
  }
  if (role.badge === "OD") {
    return role.source === "title"
      ? "Job title identifies the hiring target as an optometrist."
      : "Optometry degree or licensure requirements point to an optometrist role.";
  }
  if (role.source === "eyecare_clinical_support") {
    return "Clinical support role has clear eye care context.";
  }
  if (role.source === "eyecare_surgical_support") {
    return "Eye care surgical or clinical support role.";
  }
  if (role.badge === "TECH") {
    return "Direct ophthalmic technician hiring position.";
  }
  if (role.badge === "OPTICIAN") {
    return "Direct optician or optical dispensing hiring position.";
  }
  if (role.source === "eyecare_admin_management") {
    return "Eye care administrative leadership position.";
  }
  if (role.badge === "MANAGER") {
    return "Eye care practice management position.";
  }
  if (role.badge === "OPTICAL") {
    return "Optical role relevant to optometry and optical hiring.";
  }
  if (role.badge === "FRONT_DESK") {
    return role.source === "eyecare_front_desk" || role.source === "eyecare_admin_coordination" || role.source === "tags"
      ? "Eye care front-desk or patient-facing administrative role."
      : "Patient-facing administrative role requires eyecare context before approval.";
  }
  if (role.source === "generic_nursing") {
    return "Nursing role, not an optometry / optical / ophthalmic job.";
  }
  if (role.source === "navigation_or_informational") {
    return "Career-site navigation or informational page, not an individual job posting.";
  }
  if (role.source === "corporate_back_office") {
    return "Corporate, financial, billing, administrative, construction, or executive role outside the intended jobs.vision marketplace.";
  }
  if (role.source === "generic_patient_admin") {
    return "Patient-facing administrative title lacks clear optometry, optical, or ophthalmic context.";
  }
  if (role.source === "generic_admin_coordination") {
    return "Administrative coordination title lacks clear optometry, optical, or ophthalmic context.";
  }
  if (role.source === "generic_healthcare_support") {
    return "Generic healthcare support role lacks clear optometry, optical, or ophthalmic context.";
  }
  if (role.source === "ambiguous_specialty_title") {
    return `${specialty || "Specialty"} title is ambiguous without clear OD or OMD hiring requirements.`;
  }
  if (role.source === "conflicting_requirements") {
    return "Posting contains conflicting OD and OMD signals; review manually before approving.";
  }
  return "Insufficient hiring-target signals to confidently classify this posting.";
}

function recommendationForRole(role) {
  if (role.badge === "OTHER") {
    const rejectSources = new Set(["generic_nursing", "navigation_or_informational", "corporate_back_office"]);
    return {
      jobsVisionRelevant: rejectSources.has(role.source) ? false : null,
      recommendation: rejectSources.has(role.source) ? "reject" : "review",
    };
  }

  if (APPROVABLE_BADGES.has(role.badge)) {
    return {
      jobsVisionRelevant: true,
      recommendation: "approve",
    };
  }
  if (role.badge === "OMD") {
    return {
      jobsVisionRelevant: false,
      recommendation: "reject",
    };
  }
  return {
    jobsVisionRelevant: null,
    recommendation: "review",
  };
}

function classifyJobForReview(job = {}) {
  const title = cleanText(job.title || job.rawTitle || "");
  const company = cleanText(job.company || job.employerName || "");
  const description = cleanText(job.description || job.rawDescription || "");
  const location = cleanText(job.location || job.rawLocation || "");
  const titleText = stableLower(title);
  const fullText = stableLower([title, company, location, description].filter(Boolean).join(" "));
  const role = roleFromSignals(titleText, fullText, job.roleTags || []);
  const specialty = detectSpecialty(fullText);
  const practiceType = detectPracticeType(fullText);
  const { jobsVisionRelevant, recommendation } = recommendationForRole(role);
  const confidenceScore = Math.max(0, Math.min(100, Number(role.confidence) || 0));

  return {
    primaryRole: role.primaryRole,
    secondaryRole: role.secondaryRole,
    specialty,
    employmentType: displayEmploymentType(job.employmentType) || null,
    practiceType,
    compensationSummary: cleanText(job.compensation) || null,
    jobsVisionRelevant,
    recommendation,
    recommendationReason: reasonForClassification({
      role,
      specialty,
    }),
    confidenceScore,
    roleBadge: ROLE_BADGES.has(role.badge) ? role.badge : "UNKNOWN",
  };
}

module.exports = {
  classifyJobForReview,
};
