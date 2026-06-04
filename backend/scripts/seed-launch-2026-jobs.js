const path = require("node:path");

require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
require("dotenv").config();

const { pool, query } = require("../services/db.js");

const SOURCE = "seed";
const SEED_BATCH = "launch_2026";

const rawJobs = [
  {
    title: "Full-Time Optometrist - Medical Optometry",
    employer: "[DEMO] Houston Eye Center",
    city: "Houston",
    state: "TX",
    latitude: 29.7097,
    longitude: -95.3975,
    role: "optometrist",
    featured: true,
    salary: "$145,000 - $185,000 base plus production",
    tags: ["optometrist", "od-md", "medical-optometry", "houston"],
    description:
      "Busy OD/MD practice seeking an optometrist for comprehensive exams, glaucoma follow-up, diabetic eye care, and pre/post-op co-management. Modern lanes, strong technician support, and a full-time schedule with limited Saturdays.",
  },
  {
    title: "Therapeutic Optometrist",
    employer: "[DEMO] North Dallas Vision Group",
    city: "Dallas",
    state: "TX",
    latitude: 32.7767,
    longitude: -96.797,
    role: "optometrist",
    salary: "$140,000 - $180,000 plus bonus",
    tags: ["optometrist", "private-practice", "dallas"],
    description:
      "Established private practice looking for a therapeutic optometrist to manage primary care, contact lens fits, dry eye, and ocular disease referrals. Four clinical lanes, EHR, OCT, visual field, and experienced opticians onsite.",
  },
  {
    title: "Optometrist - Growing Austin Practice",
    employer: "[DEMO] Austin Vision Associates",
    city: "Austin",
    state: "TX",
    latitude: 30.2672,
    longitude: -97.7431,
    role: "optometrist",
    salary: "$135,000 - $175,000 with relocation assistance",
    tags: ["optometrist", "private-practice", "austin"],
    description:
      "Patient-centered optometry office hiring a full-time OD for routine exams, specialty contact lens interest, myopia management, and medical eye care. Balanced schedule, collaborative staff, and room to grow into a lead provider role.",
  },
  {
    title: "Optometrist - Multi-Location Group",
    employer: "[DEMO] Alamo Eye Partners",
    city: "San Antonio",
    state: "TX",
    latitude: 29.4241,
    longitude: -98.4936,
    role: "optometrist",
    salary: "$138,000 - $178,000 plus productivity",
    tags: ["optometrist", "multi-location", "san-antonio"],
    description:
      "Multi-location group seeks a full-time optometrist for comprehensive exams, anterior segment care, contact lenses, and shared coverage across two nearby clinics. Strong central scheduling and technician support included.",
  },
  {
    title: "Optometrist - Desert Market Growth Role",
    employer: "[DEMO] Desert Vision Group",
    city: "Phoenix",
    state: "AZ",
    latitude: 33.4484,
    longitude: -112.074,
    role: "optometrist",
    salary: "$150,000 - $190,000 plus sign-on bonus",
    tags: ["optometrist", "multi-location", "phoenix"],
    description:
      "Growing Arizona vision group hiring an OD for full-scope care, co-management, dry eye, and contact lenses. New equipment, flexible clinic template, and leadership support for building a long-term patient base.",
  },
  {
    title: "Medical Optometrist",
    employer: "[DEMO] Peachtree Eye Institute",
    city: "Atlanta",
    state: "GA",
    latitude: 33.749,
    longitude: -84.388,
    role: "optometrist",
    salary: "$142,000 - $182,000 plus bonus",
    tags: ["optometrist", "od-md", "atlanta"],
    description:
      "OD/MD clinic seeking an optometrist comfortable with cataract workups, post-op care, dry eye, glaucoma monitoring, and urgent visits. Ideal for a clinician who enjoys medical optometry in a team setting.",
  },
  {
    title: "Optometrist - Coastal Florida Practice",
    employer: "[DEMO] Tampa Bay Family Eye Care",
    city: "Tampa",
    state: "FL",
    latitude: 27.9506,
    longitude: -82.4572,
    role: "optometrist",
    salary: "$135,000 - $170,000 with paid CE",
    tags: ["optometrist", "private-practice", "tampa"],
    description:
      "Family-focused practice hiring a full-time optometrist for comprehensive exams, contact lenses, red eye visits, and co-management. Supportive team, predictable hours, and established patient demand.",
  },
  {
    title: "Optometrist - Mountain Community Practice",
    employer: "[DEMO] Bozeman Vision Clinic",
    city: "Bozeman",
    state: "MT",
    latitude: 45.677,
    longitude: -111.0429,
    role: "optometrist",
    salary: "$130,000 - $165,000 plus relocation",
    tags: ["optometrist", "private-practice", "bozeman"],
    description:
      "Community optometry clinic seeking an OD for primary care, contact lenses, ocular disease monitoring, and co-management. Great fit for someone who wants a broad scope and a close patient community.",
  },
  {
    title: "Optometrist - Alaska Primary Care",
    employer: "[DEMO] Anchorage Eye Health",
    city: "Anchorage",
    state: "AK",
    latitude: 61.2181,
    longitude: -149.9003,
    role: "optometrist",
    salary: "$155,000 - $205,000 plus relocation",
    tags: ["optometrist", "medical-optometry", "anchorage"],
    description:
      "Full-time optometrist needed for comprehensive care, ocular disease management, contact lenses, and urgent eye visits. Practice offers strong support staff and relocation assistance for the right clinician.",
  },
  {
    title: "Optometrist - Southwest Lifestyle Role",
    employer: "[DEMO] Santa Fe Eye Studio",
    city: "Santa Fe",
    state: "NM",
    latitude: 35.687,
    longitude: -105.9378,
    role: "optometrist",
    salary: "$132,000 - $168,000 plus bonus",
    tags: ["optometrist", "private-practice", "santa-fe"],
    description:
      "Boutique practice hiring an optometrist for primary care, premium optical collaboration, dry eye evaluation, and specialty lens interest. Full-time role with a relationship-driven patient base.",
  },
  {
    title: "Licensed Optician - High-Volume Optical",
    employer: "[DEMO] Houston Optical Co.",
    city: "Sugar Land",
    state: "TX",
    latitude: 29.6197,
    longitude: -95.6349,
    role: "optician",
    salary: "$24 - $32 per hour plus incentives",
    tags: ["optician", "retail-optical", "houston"],
    description:
      "Retail optical team seeking a licensed optician for frame styling, lens recommendations, measurements, adjustments, and patient handoff from exam lanes. Strong product knowledge and polished service expected.",
  },
  {
    title: "Optician - Private Practice",
    employer: "[DEMO] Fort Worth Eye Boutique",
    city: "Fort Worth",
    state: "TX",
    latitude: 32.7555,
    longitude: -97.3308,
    role: "optician",
    salary: "$22 - $30 per hour",
    tags: ["optician", "private-practice", "dfw"],
    description:
      "Private optometry office hiring an optician to guide eyewear selection, explain lens options, verify orders, and deliver a premium patient experience. ABO certification preferred but not required.",
  },
  {
    title: "Optician - Premium Eyewear Sales",
    employer: "[DEMO] Austin Optical Studio",
    city: "Austin",
    state: "TX",
    latitude: 30.2035,
    longitude: -97.841,
    role: "optician",
    salary: "$23 - $31 per hour plus commission",
    tags: ["optician", "private-practice", "austin"],
    description:
      "Optical studio seeking an optician who enjoys frame styling, independent eyewear, lens education, and accurate measurements. Role supports a full-time doctor schedule and loyal patient base.",
  },
  {
    title: "Optician - Multi-Doctor Clinic",
    employer: "[DEMO] San Antonio Vision Works Group",
    city: "San Antonio",
    state: "TX",
    latitude: 29.5075,
    longitude: -98.5756,
    role: "optician",
    salary: "$21 - $29 per hour",
    tags: ["optician", "multi-location", "san-antonio"],
    description:
      "Busy multi-doctor clinic hiring an optician for eyewear sales, lens troubleshooting, repairs, and patient education. Ideal candidate is organized, warm, and comfortable with a steady patient flow.",
  },
  {
    title: "Optician - East Valley Optical",
    employer: "[DEMO] Mesa Family Optical",
    city: "Mesa",
    state: "AZ",
    latitude: 33.4152,
    longitude: -111.8315,
    role: "optician",
    salary: "$22 - $30 per hour",
    tags: ["optician", "retail-optical", "phoenix"],
    description:
      "Full-time optician needed for a growing optical team serving families and specialty lens patients. Responsibilities include frame selection, insurance review, measurements, dispensing, and adjustments.",
  },
  {
    title: "Optician - OD/MD Optical Department",
    employer: "[DEMO] Peachtree Vision Specialists",
    city: "Atlanta",
    state: "GA",
    latitude: 33.749,
    longitude: -84.388,
    role: "optician",
    salary: "$23 - $32 per hour",
    tags: ["optician", "od-md", "atlanta"],
    description:
      "OD/MD practice seeking an optician for a medically oriented optical department. Work includes post-cataract lens education, premium lens options, frame selection, and accurate eyewear delivery.",
  },
  {
    title: "Optician - Coastal Retail Optical",
    employer: "[DEMO] Tampa Optical Market",
    city: "Tampa",
    state: "FL",
    latitude: 27.9506,
    longitude: -82.4572,
    role: "optician",
    salary: "$22 - $30 per hour plus monthly bonus",
    tags: ["optician", "retail-optical", "tampa"],
    description:
      "Retail optical location hiring a full-time optician for sales, measurements, lab coordination, and patient follow-up. Experience with progressive lenses and managed vision plans is helpful.",
  },
  {
    title: "Optician - Community Eye Clinic",
    employer: "[DEMO] Bismarck Family Vision",
    city: "Bismarck",
    state: "ND",
    latitude: 46.8083,
    longitude: -100.7837,
    role: "optician",
    salary: "$20 - $27 per hour",
    tags: ["optician", "private-practice", "bismarck"],
    description:
      "Community practice seeking an optician to support frame styling, order entry, repairs, and dispensing. Friendly patient communication and attention to detail are the top priorities.",
  },
  {
    title: "Optician - Independent Optical",
    employer: "[DEMO] Burlington Optical House",
    city: "Burlington",
    state: "VT",
    latitude: 44.4759,
    longitude: -73.2121,
    role: "optician",
    salary: "$21 - $29 per hour",
    tags: ["optician", "private-practice", "burlington"],
    description:
      "Independent optical shop looking for an optician who can handle frame selection, measurements, adjustments, vendor follow-up, and a warm patient experience from start to finish.",
  },
  {
    title: "Optician - Santa Fe Optical Gallery",
    employer: "[DEMO] High Desert Optical Gallery",
    city: "Santa Fe",
    state: "NM",
    latitude: 35.687,
    longitude: -105.9378,
    role: "optician",
    salary: "$22 - $30 per hour",
    tags: ["optician", "premium-optical", "santa-fe"],
    description:
      "Full-time optician needed for a design-forward optical gallery. Role includes frame styling, premium lens consultation, lab coordination, repairs, and long-term patient relationship building.",
  },
  {
    title: "Ophthalmic Technician - Retina and Cataract",
    employer: "[DEMO] Houston Retina and Cataract",
    city: "Katy",
    state: "TX",
    latitude: 29.7858,
    longitude: -95.8245,
    role: "ophthalmic technician",
    salary: "$22 - $30 per hour",
    tags: ["ophthalmic-technician", "od-md", "houston"],
    description:
      "Ophthalmology practice hiring a technician for workups, OCT, visual fields, fundus photos, histories, dilation, and scribing support. Experience preferred, but strong clinical curiosity matters.",
  },
  {
    title: "Ophthalmic Technician - Plano Clinic",
    employer: "[DEMO] North Texas Eye Institute",
    city: "Plano",
    state: "TX",
    latitude: 33.0198,
    longitude: -96.6989,
    role: "ophthalmic technician",
    salary: "$21 - $29 per hour",
    tags: ["ophthalmic-technician", "od-md", "dfw"],
    description:
      "Multi-specialty clinic seeking an ophthalmic technician for preliminary testing, diagnostic imaging, patient histories, lensometry, and provider support. COA or COT a plus.",
  },
  {
    title: "Ophthalmic Technician - Dry Eye and Specialty Testing",
    employer: "[DEMO] Austin Eye Health Group",
    city: "Round Rock",
    state: "TX",
    latitude: 30.5083,
    longitude: -97.6789,
    role: "ophthalmic technician",
    salary: "$20 - $28 per hour",
    tags: ["ophthalmic-technician", "private-practice", "austin"],
    description:
      "Optometry practice hiring a technician for pretesting, specialty testing, dry eye workups, contact lens training, and patient education. Great role for someone who likes a hands-on clinical environment.",
  },
  {
    title: "Ophthalmic Technician - Surgical Co-Management",
    employer: "[DEMO] Alamo Cataract Partners",
    city: "San Antonio",
    state: "TX",
    latitude: 29.647,
    longitude: -98.4705,
    role: "ophthalmic technician",
    salary: "$21 - $30 per hour",
    tags: ["ophthalmic-technician", "od-md", "san-antonio"],
    description:
      "OD/MD team seeking a technician for cataract evaluations, IOL testing, OCT, visual field, and scribing. Strong training environment with opportunities for certification support.",
  },
  {
    title: "Ophthalmic Technician - Scottsdale Specialty Clinic",
    employer: "[DEMO] Scottsdale Eye Specialists",
    city: "Scottsdale",
    state: "AZ",
    latitude: 33.4942,
    longitude: -111.9261,
    role: "ophthalmic technician",
    salary: "$22 - $31 per hour",
    tags: ["ophthalmic-technician", "od-md", "phoenix"],
    description:
      "Specialty clinic hiring an ophthalmic technician to support cataract, glaucoma, and dry eye providers. Duties include workups, imaging, patient education, and procedure room support.",
  },
  {
    title: "Ophthalmic Technician - Atlanta Metro",
    employer: "[DEMO] Marietta Eye Partners",
    city: "Marietta",
    state: "GA",
    latitude: 33.9526,
    longitude: -84.5499,
    role: "ophthalmic technician",
    salary: "$20 - $28 per hour",
    tags: ["ophthalmic-technician", "multi-location", "atlanta"],
    description:
      "Growing metro Atlanta group seeking a technician for patient workups, OCT, topography, contact lens training, and EHR documentation. Full-time schedule with rotating clinic coverage.",
  },
  {
    title: "Ophthalmic Technician - Tampa Clinic",
    employer: "[DEMO] Tampa Bay Eye Specialists",
    city: "Tampa",
    state: "FL",
    latitude: 27.9506,
    longitude: -82.4572,
    role: "ophthalmic technician",
    salary: "$20 - $29 per hour",
    tags: ["ophthalmic-technician", "od-md", "tampa"],
    description:
      "Ophthalmology clinic hiring a technician for patient histories, acuities, pressure checks, diagnostic testing, and procedure preparation. Certification is valued but not required.",
  },
  {
    title: "Ophthalmic Technician - Mountain Clinic",
    employer: "[DEMO] Bozeman Eye Health",
    city: "Bozeman",
    state: "MT",
    latitude: 45.677,
    longitude: -111.0429,
    role: "ophthalmic technician",
    salary: "$19 - $27 per hour",
    tags: ["ophthalmic-technician", "private-practice", "bozeman"],
    description:
      "Community clinic seeking a full-time ophthalmic technician for pretesting, OCT, visual fields, contact lens instruction, and patient flow support. Training available for a motivated learner.",
  },
  {
    title: "Ophthalmic Technician - Northern Plains Eye Care",
    employer: "[DEMO] Bismarck Eye Associates",
    city: "Bismarck",
    state: "ND",
    latitude: 46.8083,
    longitude: -100.7837,
    role: "ophthalmic technician",
    salary: "$19 - $27 per hour",
    tags: ["ophthalmic-technician", "private-practice", "bismarck"],
    description:
      "Full-time technician needed for a broad-scope clinic covering pretesting, imaging, histories, contact lens support, and provider assistance. Ideal for someone who enjoys varied clinical days.",
  },
  {
    title: "Ophthalmic Technician - Anchorage Specialty Team",
    employer: "[DEMO] Anchorage Vision Specialists",
    city: "Anchorage",
    state: "AK",
    latitude: 61.2181,
    longitude: -149.9003,
    role: "ophthalmic technician",
    salary: "$23 - $33 per hour plus relocation assistance",
    tags: ["ophthalmic-technician", "od-md", "anchorage"],
    description:
      "Specialty clinic hiring an ophthalmic technician for diagnostic workups, imaging, patient education, and scribing. Full-time role with strong benefits and relocation support.",
  },
  {
    title: "Practice Manager - Multi-Location Optometry",
    employer: "[DEMO] Houston Vision Partners",
    city: "The Woodlands",
    state: "TX",
    latitude: 30.1658,
    longitude: -95.4613,
    role: "practice manager",
    salary: "$75,000 - $95,000 plus bonus",
    tags: ["practice-manager", "multi-location", "houston"],
    description:
      "Multi-location optometry group hiring a practice manager to oversee scheduling, staff coaching, KPI reporting, inventory coordination, and patient experience across two northern Houston clinics.",
  },
  {
    title: "Practice Administrator - DFW Eye Clinic",
    employer: "[DEMO] DFW Eye Care Network",
    city: "Irving",
    state: "TX",
    latitude: 32.814,
    longitude: -96.9489,
    role: "practice manager",
    salary: "$78,000 - $105,000",
    tags: ["practice-manager", "od-md", "dfw"],
    description:
      "OD/MD group seeking an administrator to manage daily operations, provider templates, billing coordination, team performance, and patient service standards. Eye care management experience strongly preferred.",
  },
  {
    title: "Practice Manager - Austin Private Practice",
    employer: "[DEMO] Lake Austin Eye Care",
    city: "Cedar Park",
    state: "TX",
    latitude: 30.5052,
    longitude: -97.8203,
    role: "practice manager",
    salary: "$70,000 - $90,000",
    tags: ["practice-manager", "private-practice", "austin"],
    description:
      "Private practice hiring a manager for front desk leadership, optical coordination, team scheduling, claims workflow, vendor communication, and patient experience improvement.",
  },
  {
    title: "Practice Manager - San Antonio Vision Group",
    employer: "[DEMO] Stone Oak Vision Group",
    city: "Alamo Heights",
    state: "TX",
    latitude: 29.4844,
    longitude: -98.4658,
    role: "practice manager",
    salary: "$72,000 - $92,000 plus bonus",
    tags: ["practice-manager", "multi-location", "san-antonio"],
    description:
      "Growing vision group seeking a manager for day-to-day operations, staff training, revenue cycle coordination, optical performance, and clinic flow. Full-time leadership role with clear metrics.",
  },
  {
    title: "Practice Administrator - Phoenix Metro",
    employer: "[DEMO] Valley Eye Management Group",
    city: "Phoenix",
    state: "AZ",
    latitude: 33.4484,
    longitude: -112.074,
    role: "practice manager",
    salary: "$82,000 - $110,000",
    tags: ["practice-manager", "multi-location", "phoenix"],
    description:
      "Multi-location eye care group hiring an administrator to oversee operations, staffing plans, patient access, provider schedules, inventory, and management reporting across the Phoenix metro.",
  },
  {
    title: "Practice Manager - Specialty Eye Clinic",
    employer: "[DEMO] Atlanta Eye Management Partners",
    city: "Atlanta",
    state: "GA",
    latitude: 33.749,
    longitude: -84.388,
    role: "practice manager",
    salary: "$78,000 - $102,000",
    tags: ["practice-manager", "od-md", "atlanta"],
    description:
      "Specialty clinic seeking a manager for clinic operations, technician schedules, physician template support, billing follow-up, team development, and patient satisfaction tracking.",
  },
  {
    title: "Practice Manager - Tampa Bay Optical and Clinic",
    employer: "[DEMO] St. Petersburg Vision Group",
    city: "St. Petersburg",
    state: "FL",
    latitude: 27.7676,
    longitude: -82.6403,
    role: "practice manager",
    salary: "$70,000 - $92,000 plus bonus",
    tags: ["practice-manager", "retail-optical", "tampa"],
    description:
      "Clinic and optical manager needed for staff coaching, patient scheduling, optical sales support, inventory processes, vendor relations, and day-to-day operational leadership.",
  },
  {
    title: "Practice Administrator - Independent Eye Care",
    employer: "[DEMO] Burlington Eye Care Collective",
    city: "Burlington",
    state: "VT",
    latitude: 44.4759,
    longitude: -73.2121,
    role: "practice manager",
    salary: "$68,000 - $88,000",
    tags: ["practice-manager", "private-practice", "burlington"],
    description:
      "Independent practice hiring an administrator to manage front desk operations, patient communications, claims follow-up, optical coordination, and team routines in a close-knit clinic.",
  },
  {
    title: "Practice Manager - Bozeman Growth Role",
    employer: "[DEMO] Gallatin Valley Eye Care",
    city: "Bozeman",
    state: "MT",
    latitude: 45.677,
    longitude: -111.0429,
    role: "practice manager",
    salary: "$66,000 - $86,000",
    tags: ["practice-manager", "private-practice", "bozeman"],
    description:
      "Growing community practice seeking a manager to improve scheduling, team communication, optical workflow, vendor ordering, and patient service. Eye care experience preferred.",
  },
  {
    title: "Practice Administrator - Anchorage Eye Group",
    employer: "[DEMO] Anchorage Eye Group",
    city: "Anchorage",
    state: "AK",
    latitude: 61.2181,
    longitude: -149.9003,
    role: "practice manager",
    salary: "$82,000 - $112,000 plus relocation assistance",
    tags: ["practice-manager", "od-md", "anchorage"],
    description:
      "Specialty eye care group hiring an administrator for clinical operations, hiring coordination, provider templates, compliance routines, vendor management, and team development.",
  },
];

const partnershipOpportunityTitles = new Set([
  "Optometrist - Growing Austin Practice",
  "Optometrist - Southwest Lifestyle Role",
]);

const practiceAcquisitionTitles = new Set(["Optometrist - Mountain Community Practice"]);

const corporateLeaseTitles = new Set(["Optometrist - Desert Market Growth Role"]);

const partTimeTitles = new Set([
  "Optician - Independent Optical",
  "Ophthalmic Technician - Northern Plains Eye Care",
]);

const perDiemFillInTitles = new Set([
  "Optician - Community Eye Clinic",
  "Ophthalmic Technician - Dry Eye and Specialty Testing",
]);

const remoteTitles = new Set([
  "Practice Manager - Multi-Location Optometry",
  "Practice Administrator - Phoenix Metro",
]);

const hybridTitles = new Set([
  "Optometrist - Multi-Location Group",
  "Practice Administrator - DFW Eye Clinic",
  "Practice Manager - San Antonio Vision Group",
  "Practice Manager - Specialty Eye Clinic",
]);

const associate1099Titles = new Set([
  "Therapeutic Optometrist",
  "Optician - Community Eye Clinic",
  "Ophthalmic Technician - Dry Eye and Specialty Testing",
]);

function opportunityTypeFor(job) {
  if (practiceAcquisitionTitles.has(job.title)) return "practice_acquisition";
  if (partnershipOpportunityTitles.has(job.title)) return "partnership_opportunity";
  if (corporateLeaseTitles.has(job.title)) return "corporate_lease";
  if (associate1099Titles.has(job.title)) return "associate_1099";
  if (job.tags.includes("retail-optical") || job.tags.includes("multi-location")) {
    return "corporate_employment";
  }
  return "associate_w2";
}

function practiceTypeFor(job) {
  if (job.tags.includes("od-md") || job.tags.includes("medical-optometry")) return "od_md";
  if (job.tags.includes("retail-optical") || job.tags.includes("multi-location")) return "corporate";
  return "private_practice";
}

function employmentTypeFor(job) {
  if (perDiemFillInTitles.has(job.title)) return "per_diem_fill_in";
  if (partTimeTitles.has(job.title)) return "part_time";
  return "full_time";
}

function workArrangementFor(job) {
  if (remoteTitles.has(job.title)) return "remote";
  if (hybridTitles.has(job.title)) return "hybrid";
  return "on_site";
}

function hoursFor(job) {
  if (job.employment_type === "per_diem_fill_in") return "8";
  return job.employment_type === "part_time" ? "24" : "40";
}

function canonicalRoleFor(job) {
  if (job.role === "ophthalmic technician") return "ophthalmic_technician";
  if (job.role === "practice manager") return "practice_manager";
  return job.role;
}

function opportunityTypesFor(job) {
  return canonicalRoleFor(job) === "optometrist" ? [opportunityTypeFor(job)] : [];
}

function employmentTypesFor(job) {
  const types = [employmentTypeFor(job)];
  if (job.title === "Optician - Independent Optical") types.push("full_time");
  if (job.title === "Optometrist - Multi-Location Group") types.push("part_time");
  return [...new Set(types)];
}

function workArrangementsFor(job) {
  const arrangements = [workArrangementFor(job)];
  if (hybridTitles.has(job.title)) arrangements.push("on_site");
  return [...new Set(arrangements)];
}

function parseMoneyRange(salary = "") {
  const numbers = String(salary)
    .match(/\d[\d,]*/g)
    ?.map((value) => Number(value.replace(/,/g, "")))
    .filter(Number.isFinite) || [];
  return {
    min: numbers[0] ?? null,
    max: numbers[1] ?? null,
  };
}

function compensationFor(job) {
  const range = parseMoneyRange(job.salary);
  if (perDiemFillInTitles.has(job.title)) {
    return {
      compensation_type: "per_diem",
      salary_min: null,
      salary_max: null,
      hourly_min: null,
      hourly_max: null,
      daily_rate: canonicalRoleFor(job) === "optometrist" ? 650 : 275,
      compensation_notes: null,
    };
  }
  if (job.title === "Optometrist - Multi-Location Group") {
    return {
      compensation_type: "production_based",
      salary_min: null,
      salary_max: null,
      hourly_min: null,
      hourly_max: null,
      daily_rate: null,
      compensation_notes: "Base + production",
    };
  }
  if (/per hour/i.test(job.salary)) {
    return {
      compensation_type: "hourly_wage",
      salary_min: null,
      salary_max: null,
      hourly_min: range.min,
      hourly_max: range.max,
      daily_rate: null,
      compensation_notes: null,
    };
  }
  return {
    compensation_type: "annual_salary",
    salary_min: range.min,
    salary_max: range.max,
    hourly_min: null,
    hourly_max: null,
    daily_rate: null,
    compensation_notes: null,
  };
}

const jobs = rawJobs.map((job) => ({
  ...job,
  role: canonicalRoleFor(job),
  opportunity_types: opportunityTypesFor(job),
  opportunity_type: opportunityTypesFor(job)[0] || null,
  practice_type: practiceTypeFor(job),
  employment_types: employmentTypesFor(job),
  employment_type: employmentTypesFor(job)[0],
  work_arrangements: workArrangementsFor(job),
  work_arrangement: workArrangementsFor(job)[0],
  ...compensationFor(job),
}));

function assertSeedData() {
  if (jobs.length !== 40) throw new Error(`Expected 40 jobs, found ${jobs.length}.`);

  const allowedOpportunityTypes = new Set([
    "associate_w2",
    "associate_1099",
    "corporate_employment",
    "corporate_lease",
    "partnership_opportunity",
    "practice_acquisition",
  ]);
  const allowedPracticeTypes = new Set(["private_practice", "corporate", "od_md"]);
  const allowedEmploymentTypes = new Set(["full_time", "part_time", "per_diem_fill_in"]);
  const allowedWorkArrangements = new Set(["on_site", "hybrid", "remote"]);
  const allowedCompensationTypes = new Set([
    "annual_salary",
    "hourly_wage",
    "per_diem",
    "production_based",
    "other",
  ]);
  const distributions = {
    opportunity_type: {},
    practice_type: {},
    employment_type: {},
    work_arrangement: {},
    compensation_type: {},
  };

  const counts = jobs.reduce((acc, job) => {
    acc[job.role] = (acc[job.role] || 0) + 1;
    if (!job.employer.startsWith("[DEMO]")) {
      throw new Error(`Employer must start with [DEMO]: ${job.employer}`);
    }
    if (job.role === "optometrist" && !allowedOpportunityTypes.has(job.opportunity_type)) {
      throw new Error(`Invalid opportunity_type for ${job.title}: ${job.opportunity_type}`);
    }
    if (job.role !== "optometrist" && (job.opportunity_type || job.opportunity_types.length)) {
      throw new Error(`Non-optometrist seed job cannot have opportunity_type: ${job.title}`);
    }
    if (!allowedPracticeTypes.has(job.practice_type)) {
      throw new Error(`Invalid practice_type for ${job.title}: ${job.practice_type}`);
    }
    if (!job.employment_types.every((type) => allowedEmploymentTypes.has(type))) {
      throw new Error(`Invalid employment_type for ${job.title}: ${job.employment_type}`);
    }
    if (!job.work_arrangements.every((type) => allowedWorkArrangements.has(type))) {
      throw new Error(`Invalid work_arrangement for ${job.title}: ${job.work_arrangement}`);
    }
    if (!allowedCompensationTypes.has(job.compensation_type)) {
      throw new Error(`Invalid compensation_type for ${job.title}: ${job.compensation_type}`);
    }
    job.opportunity_types.forEach((type) => {
      distributions.opportunity_type[type] = (distributions.opportunity_type[type] || 0) + 1;
    });
    distributions.practice_type[job.practice_type] =
      (distributions.practice_type[job.practice_type] || 0) + 1;
    job.employment_types.forEach((type) => {
      distributions.employment_type[type] = (distributions.employment_type[type] || 0) + 1;
    });
    job.work_arrangements.forEach((type) => {
      distributions.work_arrangement[type] = (distributions.work_arrangement[type] || 0) + 1;
    });
    distributions.compensation_type[job.compensation_type] =
      (distributions.compensation_type[job.compensation_type] || 0) + 1;
    return acc;
  }, {});

  const expected = {
    optometrist: 10,
    optician: 10,
    ophthalmic_technician: 10,
    practice_manager: 10,
  };

  for (const [role, count] of Object.entries(expected)) {
    if (counts[role] !== count) {
      throw new Error(`Expected ${count} ${role} jobs, found ${counts[role] || 0}.`);
    }
  }

  for (const type of allowedOpportunityTypes) {
    if (!distributions.opportunity_type[type]) {
      throw new Error(`Expected at least one seed job with opportunity_type=${type}.`);
    }
  }
  for (const type of allowedPracticeTypes) {
    if (!distributions.practice_type[type]) {
      throw new Error(`Expected at least one seed job with practice_type=${type}.`);
    }
  }
  for (const type of allowedEmploymentTypes) {
    if (!distributions.employment_type[type]) {
      throw new Error(`Expected at least one seed job with employment_type=${type}.`);
    }
  }
  for (const type of allowedWorkArrangements) {
    if (!distributions.work_arrangement[type]) {
      throw new Error(`Expected at least one seed job with work_arrangement=${type}.`);
    }
  }
  for (const type of ["annual_salary", "hourly_wage", "per_diem", "production_based"]) {
    if (!distributions.compensation_type[type]) {
      throw new Error(`Expected at least one seed job with compensation_type=${type}.`);
    }
  }

  const featuredHoustonJobs = jobs.filter(
    (job) =>
      job.featured === true &&
      job.state === "TX" &&
      (job.city === "Houston" || job.tags.includes("houston"))
  );
  if (featuredHoustonJobs.length !== 1) {
    throw new Error(
      `Expected exactly one featured Houston launch seed job, found ${featuredHoustonJobs.length}.`
    );
  }
}

async function ensureSeedColumns() {
  await query("alter table public.jobs add column if not exists source text");
  await query("alter table public.jobs add column if not exists seed_batch text");
  await query("alter table public.jobs add column if not exists opportunity_type text");
  await query("alter table public.jobs add column if not exists opportunity_types text[] not null default '{}'");
  await query("alter table public.jobs add column if not exists practice_type text");
  await query("alter table public.jobs add column if not exists employment_type text");
  await query("alter table public.jobs add column if not exists employment_types text[] not null default '{}'");
  await query("alter table public.jobs add column if not exists work_arrangement text");
  await query("alter table public.jobs add column if not exists work_arrangements text[] not null default '{}'");
  await query("alter table public.jobs add column if not exists compensation_type text");
  await query("alter table public.jobs add column if not exists salary_min numeric(12,2)");
  await query("alter table public.jobs add column if not exists salary_max numeric(12,2)");
  await query("alter table public.jobs add column if not exists hourly_min numeric(10,2)");
  await query("alter table public.jobs add column if not exists hourly_max numeric(10,2)");
  await query("alter table public.jobs add column if not exists daily_rate numeric(10,2)");
  await query("alter table public.jobs add column if not exists compensation_notes text");
  await query("alter table public.jobs add column if not exists featured boolean not null default false");
}

async function seedJobs() {
  assertSeedData();
  await ensureSeedColumns();

  await query("begin");
  try {
    await query("delete from public.jobs where source = $1 and seed_batch = $2", [
      SOURCE,
      SEED_BATCH,
    ]);

    const text = `
      insert into public.jobs (
        title,
        description,
        company,
        employer_name,
        location,
        city,
        state,
        latitude,
        longitude,
        role,
        hours,
        type,
        opportunity_type,
        opportunity_types,
        practice_type,
        employment_type,
        employment_types,
        work_arrangement,
        work_arrangements,
        compensation_type,
        salary_min,
        salary_max,
        hourly_min,
        hourly_max,
        daily_rate,
        compensation_notes,
        salary,
        tag_ids,
        status,
        is_archived,
        featured,
        employer_brand_verified,
        posted_at,
        first_activated_at,
        last_activated_at,
        source,
        seed_batch,
        updated_at
      )
      values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14::text[], $15, $16, $17::text[], $18, $19::text[],
        $20, $21, $22, $23, $24, $25, $26, $27, $28::text[],
        'active', false, $29, false, now(), now(), now(), $30, $31, now()
      )
    `;

    for (const job of jobs) {
      await query(text, [
        job.title,
        job.description,
        job.employer,
        job.employer,
        `${job.city}, ${job.state}`,
        job.city,
        job.state,
        job.latitude,
        job.longitude,
        job.role,
        hoursFor(job),
        job.employment_type,
        job.opportunity_type,
        job.opportunity_types,
        job.practice_type,
        job.employment_type,
        job.employment_types,
        job.work_arrangement,
        job.work_arrangements,
        job.compensation_type,
        job.salary_min,
        job.salary_max,
        job.hourly_min,
        job.hourly_max,
        job.daily_rate,
        job.compensation_notes,
        job.salary,
        job.tags,
        job.featured === true,
        SOURCE,
        SEED_BATCH,
      ]);
    }

    await query("commit");
  } catch (err) {
    await query("rollback");
    throw err;
  }

  const result = await query(
    `
      select role, count(*)::int as count
      from public.jobs
      where source = $1
        and seed_batch = $2
        and status = 'active'
        and is_archived = false
        and employer_name like '[DEMO]%'
      group by role
      order by role
    `,
    [SOURCE, SEED_BATCH]
  );

  console.log(`Seeded ${jobs.length} launch jobs.`);
  console.table(result.rows);
  console.log("Cleanup query:");
  console.log("DELETE FROM public.jobs WHERE source = 'seed';");
}

seedJobs()
  .catch((err) => {
    console.error("Seed launch jobs failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
