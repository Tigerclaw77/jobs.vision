// CommonJS-compatible so the current Express app can load this without a TS build step.
const eyecareJobDiscoveryConfig = {
  industryKey: "eyecare",
  industryTags: {
    ophthalmology: ["ophthalmology", "ophthalmologist", "ophthalmic", "retina", "glaucoma", "cataract"],
    optometry: ["optometry", "optometrist", "therapeutic optometrist", "doctor of optometry"],
    optical: ["optical", "optician", "optical sales", "frames", "lenses", "contact lens"],
    surgery: ["surgery", "surgical", "asc", "operating room", "scrub", "cataract surgery"],
    practice_operations: ["practice manager", "administrator", "front desk", "patient coordinator", "billing"],
  },
  roleKeywordSets: {
    optometrist: ["optometrist", "doctor of optometry", "od ", "therapeutic optometrist"],
    optician: ["optician", "licensed optician", "dispensing optician"],
    ophthalmic_technician: [
      "ophthalmic technician",
      "ophthalmic tech",
      "optometric technician",
      "eye care technician",
      "scribe",
      "workup technician",
    ],
    practice_manager: ["practice manager", "office manager", "administrator", "clinic manager"],
    optical_sales: ["optical sales", "frame stylist", "eyewear consultant", "optical associate"],
    contact_lens_technician: ["contact lens technician", "contact lens specialist", "contact lens fitter"],
    ophthalmology_adjacent: [
      "ophthalmologist",
      "surgeon",
      "registered nurse",
      "rn",
      "scrub tech",
      "surgical coordinator",
      "retina",
      "glaucoma",
    ],
  },
  includeIfAnyKeywordMatches: [
    "ophthalmology",
    "ophthalmic",
    "optometry",
    "optometrist",
    "optician",
    "optical",
    "eye care",
    "eyecare",
    "retina",
    "glaucoma",
    "cataract",
  ],
};

module.exports = eyecareJobDiscoveryConfig;
