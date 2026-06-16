import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  Chip,
  FormControl,
  FormHelperText,
  Grid,
  InputLabel,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import { createJob, createStripeCheckout, fetchUserProfile, publishJob, updateJob } from "../utils/api";
import {
  JOB_TAG_OPTIONS,
  canonicalizeJobTagInput,
  displayJobTagLabel,
} from "../constants/jobTagTaxonomy";
import {
  COMPENSATION_TYPE_OPTIONS,
  EMPLOYMENT_TYPE_OPTIONS,
  OPPORTUNITY_TYPE_OPTIONS,
  PRACTICE_TYPE_OPTIONS,
  ROLE_OPTIONS,
  ROLE_LABELS,
  SATURDAY_SCHEDULE_LABELS,
  SATURDAY_SCHEDULE_OPTIONS,
  WORK_ARRANGEMENT_OPTIONS,
  WORK_ARRANGEMENT_LABELS,
  compensationSummary,
  labelsForValues,
  normalizeMultiValue,
  normalizeRole,
} from "../utils/jobTaxonomy";
import "../styles/jobForm.css";

// Draft storage key
const DRAFT_KEY = "jobFormDraft:v1";
const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
const LOCATION_MAP_ERROR = "We couldn't map this location. Please check the city and state.";
let googleMapsPromise;

const ROLE_REQUIRED_RECRUITER_PLAN = {
  optometrist: "doctor",
  practice_manager: "manager",
  optical_manager: "manager",
  optician: "staff",
  ophthalmic_technician: "staff",
  optical_lab: "staff",
  front_desk: "staff",
  other: "staff",
};

const RECRUITER_PLAN_LABELS = {
  staff: "Staff Position",
  manager: "Manager Position",
  doctor: "Doctor Position",
};

const RECRUITER_POSTING_LABELS = {
  staff: "Staff Posting",
  manager: "Manager Posting",
  doctor: "Doctor Posting",
};

const defaultValues = {
  title: "",
  company: "",
  location: "",
  role_type: "",
  opportunity_types: [],
  practice_type: "",
  employment_types: [],
  work_arrangements: [],
  saturday_schedule: "",
  sign_on_bonus: "",
  relocation_assistance: false,
  benefits: "",
  ce_allowance: "",
  student_loan_assistance: false,
  compensation_type: "",
  salary_min: "",
  salary_max: "",
  hourly_min: "",
  hourly_max: "",
  daily_rate: "",
  compensation_notes: "",
  apply_destination_mode: "default",
  use_default_apply_destination: true,
  external_apply_url: "",
  application_email: "",
  description: "",
  tags: [],
};

function splitLocation(location = "") {
  const parts = String(location).split(",").map((part) => part.trim()).filter(Boolean);
  return {
    city: parts[0] || "",
    state: parts[1] || "",
  };
}

function normalizeOptionValue(value = "", aliases = {}) {
  const normalized = String(value)
    .trim()
    .toLowerCase()
    .replace(/[()]/g, "")
    .replace(/[/-]+/g, " ")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ");
  return aliases[normalized] || "";
}

function normalizeOpportunityValue(value = "") {
  return normalizeOptionValue(value, {
    "associate w2": "associate_w2",
    "associate w 2": "associate_w2",
    "associate position": "associate_w2",
    "associate 1099": "associate_1099",
    "corporate employment": "corporate_employment",
    "corporate lease": "corporate_lease",
    "lease opportunity": "corporate_lease",
    "partnership opportunity": "partnership_opportunity",
    "ownership track": "partnership_opportunity",
    "buy in opportunity": "partnership_opportunity",
    "practice acquisition": "practice_acquisition",
  });
}

function normalizeEmploymentValue(value = "") {
  return normalizeOptionValue(value, {
    "full time": "full_time",
    "part time": "part_time",
    "per diem fill in": "per_diem_fill_in",
    "per diem": "per_diem_fill_in",
    "fill in": "per_diem_fill_in",
    remote: "full_time",
  });
}

function normalizeWorkArrangementValue(value = "") {
  return normalizeOptionValue(value, {
    "on site": "on_site",
    onsite: "on_site",
    hybrid: "hybrid",
    remote: "remote",
  });
}

function cleanGeocodeText(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

function sameText(a, b) {
  return cleanGeocodeText(a).toLowerCase() === cleanGeocodeText(b).toLowerCase();
}

function hasLocationChanged(job, payload) {
  if (!job) return true;
  return (
    !sameText(job.location, payload.location) ||
    !sameText(job.city, payload.city) ||
    !sameText(job.state, payload.state)
  );
}

function loadGoogleMaps(apiKey) {
  if (!apiKey) return Promise.reject(new Error(LOCATION_MAP_ERROR));
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (googleMapsPromise) return googleMapsPromise;

  googleMapsPromise = new Promise((resolve, reject) => {
    const id = "googleMaps";
    const existing = document.getElementById(id);
    if (existing) {
      existing.addEventListener("load", () => resolve(window.google.maps), { once: true });
      existing.addEventListener("error", () => reject(new Error(LOCATION_MAP_ERROR)), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.id = id;
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
    script.onload = () => resolve(window.google.maps);
    script.onerror = () => reject(new Error(LOCATION_MAP_ERROR));
    document.body.appendChild(script);
  });

  return googleMapsPromise;
}

async function geocodeJobPayload(payload) {
  const address = cleanGeocodeText(
    payload.location || [payload.city, payload.state].filter(Boolean).join(", ")
  );
  if (!address) throw new Error(LOCATION_MAP_ERROR);

  const maps = await loadGoogleMaps(GOOGLE_MAPS_API_KEY);
  const geocoder = new maps.Geocoder();

  return new Promise((resolve, reject) => {
    geocoder.geocode(
      { address, componentRestrictions: { country: "US" } },
      (results, status) => {
        const location = results?.[0]?.geometry?.location;
        if (status === "OK" && location) {
          resolve({ latitude: location.lat(), longitude: location.lng() });
          return;
        }
        reject(new Error(LOCATION_MAP_ERROR));
      }
    );
  });
}

function parseSalaryRange(salary) {
  if (salary == null) return { salary_min: "", salary_max: "" };
  const parts = String(salary).match(/\d+(?:\.\d+)?/g) || [];
  return {
    salary_min: parts[0] || "",
    salary_max: parts[1] || "",
  };
}

function numberOrNull(value) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function isHttpUrl(value = "") {
  const text = String(value || "").trim();
  if (!text) return true;
  try {
    const url = new URL(text);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

function isEmail(value = "") {
  const text = String(value || "").trim();
  if (!text) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
}

function postingPaymentCoversRole(payment, role, isAdmin = false) {
  if (isAdmin) return true;
  const normalizedRole = normalizeRole(role);
  if (!normalizedRole) return false;
  const requiredPlan = ROLE_REQUIRED_RECRUITER_PLAN[normalizedRole] || "staff";
  return (
    payment?.active === true &&
    payment?.requiredPlanKey === requiredPlan &&
    normalizeRole(payment?.role || normalizedRole) === normalizedRole
  );
}

function rolePlanRequirementMessage(role) {
  const roleLabel = ROLE_LABELS[role] || "this role";
  const requiredPlan = ROLE_REQUIRED_RECRUITER_PLAN[role] || "staff";
  const requiredLabel = RECRUITER_PLAN_LABELS[requiredPlan] || "matching plan";
  return `${roleLabel} postings require ${requiredLabel} checkout before publishing.`;
}

function profileDefaultDestination(profile = {}) {
  const applyUrl = profile.applicationWebsite || profile.application_website || "";
  const applyEmail =
    profile.applicationEmail ||
    profile.application_email ||
    (profile.applicationUseAccountEmail ?? profile.application_use_account_email ?? true
      ? profile.email || ""
      : "");
  return {
    applyUrl,
    applyEmail,
    hasDestination: Boolean(applyUrl || applyEmail),
  };
}

function profileEmployerName(profile = {}) {
  return (
    profile.company ||
    profile.company_name ||
    profile.practiceName ||
    profile.practice_name ||
    profile.organization ||
    ""
  );
}

function applyDestinationSummary(values, profile = {}) {
  const defaultDestination = profileDefaultDestination(profile);
  const jobUrl = values.external_apply_url?.trim();
  const jobEmail = values.application_email?.trim();
  if (values.apply_destination_mode === "url") {
    return jobUrl ? `Custom apply URL: ${jobUrl}` : "Custom apply URL required before publishing.";
  }
  if (values.apply_destination_mode === "email") {
    return jobEmail ? `Custom apply email: ${jobEmail}` : "Custom apply email required before publishing.";
  }
  if (defaultDestination.applyUrl) {
    return `Recruiter default apply URL: ${defaultDestination.applyUrl}`;
  }
  if (defaultDestination.applyEmail) {
    return `Recruiter default apply email: ${defaultDestination.applyEmail}`;
  }
  return "No recruiter default apply destination is set.";
}

function compensationPayload(values) {
  const base = {
    compensation_type: values.compensation_type || null,
    salary_min: null,
    salary_max: null,
    hourly_min: null,
    hourly_max: null,
    daily_rate: null,
    compensation_notes: null,
  };

  if (values.compensation_type === "annual_salary") {
    base.salary_min = numberOrNull(values.salary_min);
    base.salary_max = numberOrNull(values.salary_max);
  } else if (values.compensation_type === "hourly_wage") {
    base.hourly_min = numberOrNull(values.hourly_min);
    base.hourly_max = numberOrNull(values.hourly_max);
  } else if (values.compensation_type === "per_diem") {
    base.daily_rate = numberOrNull(values.daily_rate);
  } else if (["production_based", "other"].includes(values.compensation_type)) {
    base.compensation_notes = values.compensation_notes.trim() || null;
  }

  return {
    ...base,
    salary: compensationSummary(base) || null,
  };
}

function normalizeDraftValues(raw = {}) {
  const draftValues = { ...raw };
  delete draftValues.hours;
  delete draftValues.hours_per_week;
  const role = normalizeRole(raw.role_type || raw.role) || defaultValues.role_type;
  const applyDestinationMode =
    raw.apply_destination_mode ||
    (raw.external_apply_url ? "url" : raw.application_email ? "email" : "default");
  return {
    ...defaultValues,
    ...draftValues,
    role_type: role,
    apply_destination_mode: applyDestinationMode,
    use_default_apply_destination: applyDestinationMode === "default",
    opportunity_types:
      role === "optometrist"
        ? normalizeMultiValue(raw.opportunity_types || raw.opportunity_type, normalizeOpportunityValue)
        : [],
    employment_types: normalizeMultiValue(
      raw.employment_types || raw.employment_type || raw.type,
      normalizeEmploymentValue
    ),
    work_arrangements: normalizeMultiValue(
      raw.work_arrangements || raw.work_arrangement || raw.onsite_type,
      normalizeWorkArrangementValue
    ),
  };
}

function valuesFromJob(job = {}) {
  const salary = parseSalaryRange(job.salary);
  return {
    ...defaultValues,
    title: job.title || "",
    company: job.employer_name || job.company || "",
    location: job.location || [job.city, job.state].filter(Boolean).join(", "),
    role_type: normalizeRole(job.role) || "",
    opportunity_types:
      normalizeRole(job.role) === "optometrist"
        ? normalizeMultiValue(job.opportunity_types || job.opportunity_type, normalizeOpportunityValue)
        : [],
    practice_type: job.practice_type || "",
    employment_types: normalizeMultiValue(
      job.employment_types || job.employment_type || job.type,
      normalizeEmploymentValue
    ),
    work_arrangements: normalizeMultiValue(
      job.work_arrangements ||
        job.work_arrangement ||
        job.onsite_type ||
        (job.employment_type === "remote" || job.type === "remote" ? "remote" : ""),
      normalizeWorkArrangementValue
    ),
    saturday_schedule: job.saturday_schedule || "",
    sign_on_bonus: job.sign_on_bonus || job.signOnBonus || "",
    relocation_assistance: job.relocation_assistance === true || job.relocationAssistance === true,
    benefits: job.benefits || "",
    ce_allowance: job.ce_allowance || job.ceAllowance || "",
    student_loan_assistance:
      job.student_loan_assistance === true || job.studentLoanAssistance === true,
    compensation_type: job.compensation_type || "",
    salary_min: job.salary_min ?? salary.salary_min,
    salary_max: job.salary_max ?? salary.salary_max,
    hourly_min: job.hourly_min ?? "",
    hourly_max: job.hourly_max ?? "",
    daily_rate: job.daily_rate ?? "",
    compensation_notes: job.compensation_notes || "",
    apply_destination_mode: job.external_apply_url || job.apply_url
      ? "url"
      : job.application_email || job.applicationEmail
      ? "email"
      : "default",
    use_default_apply_destination: !job.external_apply_url && !job.application_email,
    external_apply_url: job.external_apply_url || job.apply_url || "",
    application_email: job.application_email || job.applicationEmail || "",
    description: job.description || "",
    tags: Array.isArray(job.tag_ids) ? job.tag_ids : Array.isArray(job.tags) ? job.tags : [],
  };
}

function validate(values, { requireApplyDestination = false, profile = {} } = {}) {
  const errors = {};
  if (!values.title.trim()) errors.title = "Job title is required.";
  if (!values.location.trim()) errors.location = "City/State (or Remote) is required.";
  if (!values.role_type) errors.role_type = "Role is required.";
  if (!values.employment_types?.length) {
    errors.employment_types = "Employment type is required.";
  }
  if (!values.description.trim()) errors.description = "Description is required.";
  if (values.apply_destination_mode === "url" && !values.external_apply_url?.trim()) {
    errors.external_apply_url = "Enter an apply URL.";
  } else if (!isHttpUrl(values.external_apply_url)) {
    errors.external_apply_url = "Use a full URL beginning with http:// or https://.";
  }
  if (values.apply_destination_mode === "email" && !values.application_email?.trim()) {
    errors.application_email = "Enter an apply email.";
  } else if (!isEmail(values.application_email)) {
    errors.application_email = "Enter a valid email address.";
  }
  if (requireApplyDestination) {
    const defaultDestination = profileDefaultDestination(profile);
    const hasDestination = Boolean(
      values.external_apply_url?.trim() ||
        values.application_email?.trim() ||
        (values.use_default_apply_destination && defaultDestination.hasDestination)
    );
    if (!hasDestination) {
      errors.apply_destination = "Add an apply URL or apply email before publishing.";
    }
  }
  if (values.salary_min && Number.isNaN(Number(values.salary_min))) {
    errors.salary_min = "Enter a number.";
  }
  if (values.salary_max && Number.isNaN(Number(values.salary_max))) {
    errors.salary_max = "Enter a number.";
  }
  if (values.salary_min && values.salary_max) {
    const min = Number(values.salary_min);
    const max = Number(values.salary_max);
    if (min > max) errors.salary_max = "Max must be ≥ Min.";
  }
  ["hourly_min", "hourly_max", "daily_rate"].forEach((field) => {
    if (values[field] && Number.isNaN(Number(values[field]))) {
      errors[field] = "Enter a number.";
    }
  });
  if (values.hourly_min && values.hourly_max && Number(values.hourly_min) > Number(values.hourly_max)) {
    errors.hourly_max = "Max must be >= Min.";
  }
  return errors;
}

function MultiSelectField({
  label,
  labelId,
  value,
  onChange,
  onBlur,
  options,
  error = false,
  helperText = "",
}) {
  return (
    <FormControl fullWidth error={error}>
      <InputLabel id={labelId}>{label}</InputLabel>
      <Select
        labelId={labelId}
        multiple
        label={label}
        value={value || []}
        onChange={onChange}
        onBlur={onBlur}
        renderValue={(selected) => (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
            {labelsForValues(
              options.reduce((acc, option) => ({ ...acc, [option.value]: option.label }), {}),
              selected
            ).map((labelText) => (
              <Chip key={labelText} label={labelText} size="small" />
            ))}
          </Box>
        )}
      >
        {options.map((opt) => (
          <MenuItem key={opt.value} value={opt.value}>
            <Checkbox checked={(value || []).includes(opt.value)} />
            <ListItemText primary={opt.label} />
          </MenuItem>
        ))}
      </Select>
      {helperText ? <FormHelperText>{helperText}</FormHelperText> : null}
    </FormControl>
  );
}

export default function JobForm({
  jobToEdit = null,
  onCreated,
  onSuccess,
  isAdmin = false,
}) {
  const editingJobId = jobToEdit?.id || jobToEdit?._id || null;
  const isEditing = Boolean(editingJobId);
  const roleLocked =
    isEditing &&
    (Boolean(jobToEdit?.first_activated_at || jobToEdit?.firstActivatedAt) ||
      !["draft", ""].includes(String(jobToEdit?.status || "").toLowerCase()));
  const [values, setValues] = useState(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      return raw ? normalizeDraftValues(JSON.parse(raw)) : defaultValues;
    } catch {
      return defaultValues;
    }
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [profile, setProfile] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [savedJob, setSavedJob] = useState(jobToEdit || null);
  const [touched, setTouched] = useState({});
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetchUserProfile()
      .then((res) => {
        if (!mounted) return;
        setProfile(res.profile || res);
      })
      .catch(() => {
        if (mounted) setProfile(null);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!jobToEdit) return;
    setValues(valuesFromJob(jobToEdit));
    setSavedJob(jobToEdit);
    setErrors({});
    setTouched({});
    setAttemptedSubmit(false);
  }, [jobToEdit]);

  // Autosave (debounced)
  useEffect(() => {
    if (isEditing) return undefined;
    const id = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(values));
      } catch {}
    }, 300);
    return () => clearTimeout(id);
  }, [values, isEditing]);

  const handleChange = (field) => (e) => {
    const v = e?.target?.value ?? e;
    setValues((prev) => ({ ...prev, [field]: v }));
    if (
      errors[field] ||
      ["external_apply_url", "application_email"].includes(field)
    ) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        if (["external_apply_url", "application_email"].includes(field)) {
          delete next.apply_destination;
        }
        return next;
      });
    }
  };

  const handleBlur = (field) => () => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    setErrors(validate(values, { requireApplyDestination: false, profile }));
  };

  const showError = (field) => Boolean(errors[field] && (attemptedSubmit || touched[field]));

  const helperTextFor = (field, fallback = "") => (showError(field) ? errors[field] : fallback);

  const markAttempted = () => {
    setAttemptedSubmit(true);
  };

  const handleRoleChange = (e) => {
    if (roleLocked) return;
    const role = e?.target?.value || "";
    setValues((prev) => ({
      ...prev,
      role_type: role,
      opportunity_types: role === "optometrist" ? prev.opportunity_types : [],
    }));
    if (errors.role_type) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.role_type;
        return next;
      });
    }
  };

  const handleMultiChange = (field) => (e) => {
    const v = e?.target?.value ?? [];
    setValues((prev) => ({ ...prev, [field]: Array.isArray(v) ? v : String(v).split(",") }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleCompensationTypeChange = (e) => {
    const compensationType = e?.target?.value || "";
    setValues((prev) => ({
      ...prev,
      compensation_type: compensationType,
      salary_min: "",
      salary_max: "",
      hourly_min: "",
      hourly_max: "",
      daily_rate: "",
      compensation_notes: "",
    }));
  };

  const handleApplyDestinationModeChange = (mode) => {
    setValues((prev) => ({
      ...prev,
      apply_destination_mode: mode,
      use_default_apply_destination: mode === "default",
      external_apply_url: mode === "url" ? prev.external_apply_url : "",
      application_email: mode === "email" ? prev.application_email : "",
    }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next.apply_destination;
      delete next.external_apply_url;
      delete next.application_email;
      return next;
    });
  };

  const addTag = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const raw = e.target.value.trim();
      if (!raw) return;
      const tagId = canonicalizeJobTagInput(raw);
      if (tagId && !values.tags.includes(tagId)) {
        setValues((p) => ({ ...p, tags: [...p.tags, tagId] }));
      }
      e.target.value = "";
    }
  };

  const removeTag = (tag) => {
    setValues((p) => ({ ...p, tags: p.tags.filter((t) => t !== tag) }));
  };

  const clearDraft = () => {
    setValues(jobToEdit ? valuesFromJob(jobToEdit) : defaultValues);
    setErrors({});
    setTouched({});
    setAttemptedSubmit(false);
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {}
    setMessage(isEditing ? "Reset." : "Cleared.");
    setTimeout(() => setMessage(""), 1000);
  };

  const buildPayload = () => {
    const { city, state } = splitLocation(values.location);
    const opportunityTypes =
      values.role_type === "optometrist" ? values.opportunity_types || [] : [];
    const employmentTypes = values.employment_types || [];
    const workArrangements = values.work_arrangements || [];
    const compensation = compensationPayload(values);
    const employerName = values.company.trim() || String(profileEmployerName(profile || {})).trim();

    return {
      title: values.title.trim(),
      company: employerName || null,
      employer_name: employerName || null,
      location: values.location.trim(),
      city,
      state,
      role: values.role_type,
      type: employmentTypes[0] || null,
      opportunity_type: opportunityTypes[0] || null,
      opportunity_types: opportunityTypes,
      practice_type: values.practice_type || null,
      employment_type: employmentTypes[0] || null,
      employment_types: employmentTypes,
      work_arrangement: workArrangements[0] || null,
      work_arrangements: workArrangements,
      saturday_schedule: values.saturday_schedule || null,
      sign_on_bonus: values.sign_on_bonus.trim() || null,
      relocation_assistance: Boolean(values.relocation_assistance),
      benefits: values.benefits.trim() || null,
      ce_allowance: values.ce_allowance.trim() || null,
      student_loan_assistance: Boolean(values.student_loan_assistance),
      ...compensation,
      use_default_apply_destination: Boolean(values.use_default_apply_destination),
      external_apply_url: values.external_apply_url.trim() || null,
      application_email: values.application_email.trim() || null,
      description: values.description.trim(),
      tag_ids: values.tags,
    };
  };

  const hydrateCoordinates = async (payload, { required = false } = {}) => {
    if (!required && !GOOGLE_MAPS_API_KEY) return payload;
    if (!isEditing || hasLocationChanged(jobToEdit, payload)) {
      if (GOOGLE_MAPS_API_KEY) {
        const coords = await geocodeJobPayload(payload);
        payload.latitude = coords.latitude;
        payload.longitude = coords.longitude;
      }
    }
    return payload;
  };

  const handlePreview = (e) => {
    e.preventDefault();
    markAttempted();
    const nextErrors = validate(values, { requireApplyDestination: true, profile });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setMessage("Please fix the highlighted fields.");
      setTimeout(() => setMessage(""), 2000);
      return;
    }
    setShowPreview(true);
    setMessage("");
  };

  const saveServerDraft = async () => {
    markAttempted();
    const nextErrors = validate(values, { requireApplyDestination: true, profile });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setMessage("Please fix the highlighted fields.");
      setTimeout(() => setMessage(""), 2000);
      return null;
    }

    setSubmitting(true);
    setMessage("");
    try {
      const draftJobId = editingJobId || savedJob?.id || savedJob?._id || null;
      const draftPayload = {
        ...buildPayload(),
        publish: false,
        save_as_draft: true,
      };
      if (!draftJobId) draftPayload.status = "draft";
      const payload = await hydrateCoordinates(draftPayload, { required: false });
      const result = draftJobId
        ? await updateJob(draftJobId, payload)
        : await createJob(payload);
      const nextJob = result?.job || result;

      setSavedJob(nextJob || null);
      setMessage("Posting saved. Continue to checkout when it is ready.");
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {}
      if (onCreated) onCreated(nextJob || null);
      setErrors({});
      return nextJob || null;
    } catch (err) {
      console.error("Posting save failed:", err);
      setMessage(err?.response?.data?.error || err?.message || "Failed to save this posting.");
      return null;
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveDraft = async (e) => {
    if (e) e.preventDefault();
    await saveServerDraft();
  };

  const handlePublish = async (e) => {
    if (e) e.preventDefault();
    markAttempted();
    const nextErrors = validate(values, { requireApplyDestination: true, profile });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setMessage("Please fix the highlighted fields before publishing.");
      return;
    }
    if (!postingPaymentActive) {
      setMessage(rolePlanRequirementMessage(values.role_type));
      return;
    }

    setSubmitting(true);
    setMessage("");
    try {
      const payload = await hydrateCoordinates(buildPayload(), { required: true });
      const currentJob = savedJob || (isEditing ? jobToEdit : null) || (await saveServerDraft());
      const jobId = currentJob?.id || currentJob?._id || editingJobId;
      if (!jobId) throw new Error("Save this posting before publishing.");
      await updateJob(jobId, payload);
      const result = await publishJob(jobId, payload);
      const nextJob = result?.job || result;
      setSavedJob(nextJob || null);
      setMessage(result?.message || "Job published.");
      setShowPreview(false);
      if (onSuccess) onSuccess(nextJob || null);
    } catch (err) {
      console.error("Publish failed:", err);
      setMessage(err?.response?.data?.error || err?.message || "Failed to publish job.");
    } finally {
      setSubmitting(false);
    }
  };

  const destinationSummary = applyDestinationSummary(values, profile || {});
  const defaultDestination = profileDefaultDestination(profile || {});
  const currentPayment = savedJob?.payment || jobToEdit?.payment || null;
  const postingPaymentActive = postingPaymentCoversRole(
    currentPayment,
    values.role_type,
    isAdmin
  );
  const previewUsesApplyUrl = Boolean(
    values.external_apply_url?.trim() ||
      (!values.application_email?.trim() &&
        values.use_default_apply_destination &&
        defaultDestination.applyUrl)
  );
  const paymentRequired = Boolean(values.role_type) && !postingPaymentActive;
  const publishBlockedMessage = paymentRequired
    ? rolePlanRequirementMessage(values.role_type)
    : "";
  const publishActionBlocked = paymentRequired;
  const roleLabel = ROLE_LABELS[values.role_type] || "Select position type";
  const previewCompany = values.company.trim() || profileEmployerName(profile || {});
  const previewCompensation = compensationSummary({
    compensation_type: values.compensation_type,
    salary_min: values.salary_min,
    salary_max: values.salary_max,
    hourly_min: values.hourly_min,
    hourly_max: values.hourly_max,
    daily_rate: values.daily_rate,
    compensation_notes: values.compensation_notes,
  });
  const previewEmployment = labelsForValues(
    EMPLOYMENT_TYPE_OPTIONS.reduce((acc, option) => ({ ...acc, [option.value]: option.label }), {}),
    values.employment_types
  ).join(", ");
  const previewWorkSetting = labelsForValues(WORK_ARRANGEMENT_LABELS, values.work_arrangements).join(", ");
  const previewSchedule = SATURDAY_SCHEDULE_LABELS[values.saturday_schedule] || "";
  const previewHighlights = [
    values.sign_on_bonus && `Sign-on bonus: ${values.sign_on_bonus}`,
    values.relocation_assistance && "Relocation assistance",
    values.ce_allowance && `CE allowance: ${values.ce_allowance}`,
    values.student_loan_assistance && "Student loan assistance",
  ].filter(Boolean);
  const canShowPostingFields = Boolean(values.role_type);
  const requiredPlanKey = ROLE_REQUIRED_RECRUITER_PLAN[values.role_type] || "staff";
  const checkoutRequired = paymentRequired;
  const checkoutPostingLabel = RECRUITER_POSTING_LABELS[requiredPlanKey] || "Posting";
  const checkoutButtonLabel = `Continue with ${checkoutPostingLabel}`;

  const handleCheckout = async (e) => {
    if (e) e.preventDefault();
    if (!checkoutRequired) return;

    setCheckoutLoading(true);
    try {
      const draft = await saveServerDraft();
      if (!draft) return;
      const jobId = draft.id || draft._id;
      if (!jobId) throw new Error("Save this posting before checkout.");

      setMessage(`Posting saved. Starting checkout for ${checkoutPostingLabel}.`);
      const { url } = await createStripeCheckout(requiredPlanKey, { jobId });
      if (!url) throw new Error("Stripe did not return a checkout URL.");
      window.location.assign(url);
    } catch (err) {
      console.error("Checkout failed:", err);
      setMessage(err?.response?.data?.error || err?.message || "Unable to start checkout.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <Box className="recruiter-job-form-page">
      <Box
        component="form"
        onSubmit={handlePreview}
        className="recruiter-job-form-card"
      >
        <Typography variant="h5" className="recruiter-job-form-title">
          {isEditing ? "Edit Job" : "Post a Job"}
        </Typography>

        {showPreview && (
          <Box className="recruiter-job-preview" aria-live="polite">
            <Typography variant="subtitle2">Preview</Typography>
            <div className="recruiter-preview-grid">
              <div className="recruiter-preview-card job-card">
                <div className="job-content">
                  <h3 className="job-title">{values.title || roleLabel}</h3>
                  {previewCompany ? <p className="job-company">{previewCompany}</p> : null}
                  {values.location ? <p className="job-location">{values.location}</p> : null}
                  <div className="job-meta">
                    {previewEmployment ? <span>{previewEmployment}</span> : null}
                    {previewWorkSetting ? <span>{previewWorkSetting}</span> : null}
                    {previewCompensation ? <span>{previewCompensation}</span> : null}
                  </div>
                </div>
              </div>

              <div className="recruiter-preview-modal">
                <h3>{values.title || roleLabel}</h3>
                {previewCompany ? <p className="modal-company">{previewCompany}</p> : null}
                {values.location ? <p className="modal-location">{values.location}</p> : null}
                {previewEmployment ? <p className="modal-employment">{previewEmployment}</p> : null}
                {previewCompensation ? <p className="modal-compensation">{previewCompensation}</p> : null}
                <section className="modal-description-block" aria-label="Preview job description">
                  <h4>Description</h4>
                  <div className="modal-description-scroll" tabIndex={0}>
                    <p className="modal-desc">{values.description}</p>
                  </div>
                </section>
                <div className="modal-job-details">
                  <p><strong>Role:</strong> {roleLabel}</p>
                  {previewWorkSetting ? <p><strong>Work Setting:</strong> {previewWorkSetting}</p> : null}
                  {previewSchedule ? <p><strong>Saturday Schedule:</strong> {previewSchedule}</p> : null}
                  {values.practice_type ? (
                    <p><strong>Practice Type:</strong> {values.practice_type.replace(/_/g, " ")}</p>
                  ) : null}
                  {previewHighlights.map((item) => (
                    <p key={item}>{item}</p>
                  ))}
                  {values.benefits ? <p><strong>Benefits:</strong> {values.benefits}</p> : null}
                </div>
                <div className="modal-actions recruiter-preview-actions">
                  <button type="button" className="btn-primary">
                    {previewUsesApplyUrl ? "Apply on Employer Site" : "Apply by Email"}
                  </button>
                  <button type="button" className="btn-secondary">Close</button>
                </div>
              </div>
            </div>
            <p>{destinationSummary}</p>
            {publishBlockedMessage ? (
              <div className="recruiter-job-plan-required">
                <strong>{checkoutRequired ? "Checkout Required" : "Publishing Blocked"}</strong>
                <span>{publishBlockedMessage}</span>
                {checkoutRequired ? (
                  <button type="button" onClick={handleCheckout} disabled={checkoutLoading || submitting}>
                    {checkoutLoading ? "Starting Checkout..." : checkoutButtonLabel}
                  </button>
                ) : null}
              </div>
            ) : null}
          </Box>
        )}

        <Box className="recruiter-position-step">
          <Typography variant="subtitle2">Step 1: Select Position Type</Typography>
          <div className="recruiter-position-options">
            {ROLE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={values.role_type === option.value ? "selected" : ""}
                onClick={() => handleRoleChange({ target: { value: option.value } })}
                disabled={roleLocked}
              >
                {option.label}
              </button>
            ))}
          </div>
          {roleLocked ? (
            <p>Role category is locked after publication. Create a new posting for a different role.</p>
          ) : (
            <p>Checkout is based on this position type.</p>
          )}
          {!!errors.role_type && <p className="recruiter-job-form-error">{errors.role_type}</p>}
        </Box>

        {canShowPostingFields ? (
        <Grid container spacing={2.5}>
        <Grid item xs={12} md={8}>
          <TextField
            label="Job Title*"
            fullWidth
            value={values.title}
            onChange={handleChange("title")}
            onBlur={handleBlur("title")}
            error={showError("title")}
            helperText={helperTextFor("title")}
          />
        </Grid>

        <Grid item xs={12} md={4}>
          <TextField
            label="Practice / Company Name"
            fullWidth
            value={values.company}
            onChange={handleChange("company")}
            helperText={
              profileEmployerName(profile || {})
                ? `Optional. Blank uses ${profileEmployerName(profile || {})}.`
                : "Optional. Add a default in your recruiter profile."
            }
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            label="Location* (City, ST or Remote)"
            fullWidth
            value={values.location}
            onChange={handleChange("location")}
            onBlur={handleBlur("location")}
            error={showError("location")}
            helperText={helperTextFor("location")}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <MultiSelectField
            label="Employment Type*"
            labelId="employment-type-label"
            value={values.employment_types}
            onChange={handleMultiChange("employment_types")}
            onBlur={handleBlur("employment_types")}
            options={EMPLOYMENT_TYPE_OPTIONS}
            error={showError("employment_types")}
            helperText={helperTextFor("employment_types")}
          />
        </Grid>

        <Grid item xs={12}>
          <Box className="recruiter-search-details">
            <Typography variant="subtitle2">Details Candidates Search For</Typography>
            <Typography variant="body2">
              These fields help the right candidates find the posting.
            </Typography>

            <Grid container spacing={2}>
              {values.role_type === "optometrist" && (
                <Grid item xs={12} md={6}>
                  <MultiSelectField
                    label="Opportunity Type"
                    labelId="opportunity-type-label"
                    value={values.opportunity_types}
                    onChange={handleMultiChange("opportunity_types")}
                    options={OPPORTUNITY_TYPE_OPTIONS}
                    helperText="Recommended for optometrist postings."
                  />
                </Grid>
              )}

              {values.role_type === "optometrist" && (
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel id="practice-type-label">Practice Type</InputLabel>
                    <Select
                      labelId="practice-type-label"
                      label="Practice Type"
                      value={values.practice_type}
                      onChange={handleChange("practice_type")}
                    >
                      <MenuItem value="">Optional</MenuItem>
                      {PRACTICE_TYPE_OPTIONS.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </MenuItem>
                      ))}
                    </Select>
                    <FormHelperText>Recommended for optometrist postings.</FormHelperText>
                  </FormControl>
                </Grid>
              )}

              <Grid item xs={12} md={6}>
                <MultiSelectField
                  label="Work Setting"
                  labelId="work-setting-label"
                  value={values.work_arrangements}
                  onChange={handleMultiChange("work_arrangements")}
                  options={WORK_ARRANGEMENT_OPTIONS}
                  helperText="Optional. Candidates can filter for on-site, hybrid, or remote work."
                />
              </Grid>

              {values.role_type === "optometrist" && (
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel id="saturday-schedule-label">Saturday Schedule</InputLabel>
                    <Select
                      labelId="saturday-schedule-label"
                      label="Saturday Schedule"
                      value={values.saturday_schedule}
                      onChange={handleChange("saturday_schedule")}
                    >
                      <MenuItem value="">Optional</MenuItem>
                      {SATURDAY_SCHEDULE_OPTIONS.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </MenuItem>
                      ))}
                    </Select>
                    <FormHelperText>Recommended for optometrist postings.</FormHelperText>
                  </FormControl>
                </Grid>
              )}

              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel id="compensation-type-label">Compensation Type</InputLabel>
                  <Select
                    labelId="compensation-type-label"
                    label="Compensation Type"
                    value={values.compensation_type}
                    onChange={handleCompensationTypeChange}
                  >
                    <MenuItem value="">Optional</MenuItem>
                    {COMPENSATION_TYPE_OPTIONS.map((opt) => (
                      <MenuItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </MenuItem>
                    ))}
                  </Select>
                  <FormHelperText>Optional. Pay transparency can improve candidate response.</FormHelperText>
                </FormControl>
              </Grid>

              {values.compensation_type === "annual_salary" && (
                <>
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Salary Min"
                      fullWidth
                      value={values.salary_min}
                      onChange={handleChange("salary_min")}
                      onBlur={handleBlur("salary_min")}
                      error={showError("salary_min")}
                      helperText={helperTextFor("salary_min")}
                      inputProps={{ inputMode: "numeric" }}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Salary Max"
                      fullWidth
                      value={values.salary_max}
                      onChange={handleChange("salary_max")}
                      onBlur={handleBlur("salary_max")}
                      error={showError("salary_max")}
                      helperText={helperTextFor("salary_max")}
                      inputProps={{ inputMode: "numeric" }}
                    />
                  </Grid>
                </>
              )}

              {values.compensation_type === "hourly_wage" && (
                <>
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Hourly Min"
                      fullWidth
                      value={values.hourly_min}
                      onChange={handleChange("hourly_min")}
                      onBlur={handleBlur("hourly_min")}
                      error={showError("hourly_min")}
                      helperText={helperTextFor("hourly_min")}
                      inputProps={{ inputMode: "numeric" }}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Hourly Max"
                      fullWidth
                      value={values.hourly_max}
                      onChange={handleChange("hourly_max")}
                      onBlur={handleBlur("hourly_max")}
                      error={showError("hourly_max")}
                      helperText={helperTextFor("hourly_max")}
                      inputProps={{ inputMode: "numeric" }}
                    />
                  </Grid>
                </>
              )}

              {values.compensation_type === "per_diem" && (
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Daily Rate"
                    fullWidth
                    value={values.daily_rate}
                    onChange={handleChange("daily_rate")}
                    onBlur={handleBlur("daily_rate")}
                    error={showError("daily_rate")}
                    helperText={helperTextFor("daily_rate")}
                    inputProps={{ inputMode: "numeric" }}
                  />
                </Grid>
              )}

              {["production_based", "other"].includes(values.compensation_type) && (
                <Grid item xs={12}>
                  <TextField
                    label="Compensation Notes"
                    fullWidth
                    value={values.compensation_notes}
                    onChange={handleChange("compensation_notes")}
                    helperText="Optional. Example: Base plus production bonus."
                  />
                </Grid>
              )}
            </Grid>
          </Box>
        </Grid>

        <Grid item xs={12}>
          <TextField
            label="Description*"
            fullWidth
            multiline
            minRows={6}
            value={values.description}
            onChange={handleChange("description")}
            onBlur={handleBlur("description")}
            error={showError("description")}
            helperText={helperTextFor("description", "Paste the essentials: responsibilities, schedule, requirements, and why someone should apply.")}
          />
        </Grid>

        <Grid item xs={12}>
          <Box className="recruiter-apply-destination">
            <Typography variant="subtitle2">Application Destination</Typography>
            <div className="recruiter-apply-options" role="radiogroup" aria-label="Application destination">
              <label className="recruiter-apply-option">
                <input
                  type="radio"
                  name="apply_destination_mode"
                  value="default"
                  checked={values.apply_destination_mode === "default"}
                  onChange={() => handleApplyDestinationModeChange("default")}
                />
                <span>
                  <strong>Use Account Apply Method</strong>
                  <small>Best for practices with one careers page or hiring inbox.</small>
                </span>
              </label>
              <label className="recruiter-apply-option">
                <input
                  type="radio"
                  name="apply_destination_mode"
                  value="url"
                  checked={values.apply_destination_mode === "url"}
                  onChange={() => handleApplyDestinationModeChange("url")}
                />
                <span>
                  <strong>Custom Apply URL</strong>
                  <small>Use a unique employer-hosted page for this opening.</small>
                </span>
              </label>
              <label className="recruiter-apply-option">
                <input
                  type="radio"
                  name="apply_destination_mode"
                  value="email"
                  checked={values.apply_destination_mode === "email"}
                  onChange={() => handleApplyDestinationModeChange("email")}
                />
                <span>
                  <strong>Custom Apply Email</strong>
                  <small>Send applicants directly to a job-specific inbox.</small>
                </span>
              </label>
            </div>

            {values.apply_destination_mode === "default" ? (
              <div className="recruiter-apply-summary">
                <span>Account Apply Method:</span>
                {defaultDestination.applyUrl ? (
                  <a href={defaultDestination.applyUrl} target="_blank" rel="noreferrer">
                    {defaultDestination.applyUrl}
                  </a>
                ) : defaultDestination.applyEmail ? (
                  <a href={`mailto:${defaultDestination.applyEmail}`}>{defaultDestination.applyEmail}</a>
                ) : (
                  <strong>No default set. Choose a custom URL or email for this posting.</strong>
                )}
              </div>
            ) : null}

            {values.apply_destination_mode === "url" ? (
              <TextField
                label="Custom Apply URL*"
                fullWidth
                value={values.external_apply_url}
                onChange={handleChange("external_apply_url")}
                onBlur={handleBlur("external_apply_url")}
                error={showError("external_apply_url")}
                helperText={helperTextFor("external_apply_url", "Use the candidate-facing job page, not an internal ATS API URL.")}
                placeholder="https://example.com/careers/job"
              />
            ) : null}

            {values.apply_destination_mode === "email" ? (
              <TextField
                label="Custom Apply Email*"
                fullWidth
                value={values.application_email}
                onChange={handleChange("application_email")}
                onBlur={handleBlur("application_email")}
                error={showError("application_email")}
                helperText={helperTextFor("application_email", "Applicants will be instructed to email this address.")}
                placeholder="hiring@example.com"
              />
            ) : null}

            <Typography variant="body2" className="recruiter-apply-current">
              {destinationSummary}
            </Typography>
            {showError("apply_destination") ? (
              <Typography variant="body2" className="recruiter-job-form-error">
                {errors.apply_destination}
              </Typography>
            ) : null}
          </Box>
        </Grid>

        <Grid item xs={12}>
          <details className="recruiter-additional-details">
            <summary>
              <span>Optional Extras</span>
              <small>Optional benefits, bonuses, relocation, and search tags.</small>
            </summary>

            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Sign-on Bonus"
                  fullWidth
                  value={values.sign_on_bonus}
                  onChange={handleChange("sign_on_bonus")}
                  placeholder="e.g., $10,000"
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  label="CE Allowance"
                  fullWidth
                  value={values.ce_allowance}
                  onChange={handleChange("ce_allowance")}
                  placeholder="e.g., $1,500 annually"
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <label className="recruiter-apply-default recruiter-job-checkbox">
                  <input
                    type="checkbox"
                    checked={values.relocation_assistance}
                    onChange={(event) =>
                      setValues((prev) => ({
                        ...prev,
                        relocation_assistance: event.target.checked,
                      }))
                    }
                  />
                  <span>Relocation Assistance</span>
                </label>
              </Grid>

              <Grid item xs={12} md={4}>
                <label className="recruiter-apply-default recruiter-job-checkbox">
                  <input
                    type="checkbox"
                    checked={values.student_loan_assistance}
                    onChange={(event) =>
                      setValues((prev) => ({
                        ...prev,
                        student_loan_assistance: event.target.checked,
                      }))
                    }
                  />
                  <span>Student Loan Assistance</span>
                </label>
              </Grid>

              <Grid item xs={12}>
                <TextField
                  label="Benefits"
                  fullWidth
                  multiline
                  minRows={2}
                  value={values.benefits}
                  onChange={handleChange("benefits")}
                  placeholder="Health insurance, PTO, 401(k), bonus structure..."
                />
              </Grid>

              <Grid item xs={12}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Tags (press Enter to add)
                </Typography>
                <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1, mb: 1 }}>
                  {values.tags.map((t) => (
                    <Chip
                      key={t}
                      className="recruiter-job-tag-chip"
                      label={displayJobTagLabel(t)}
                      title={t}
                      onDelete={() => removeTag(t)}
                    />
                  ))}
                </Stack>
                <TextField
                  placeholder="e.g., pediatrics, scleral lenses, bilingual Spanish"
                  fullWidth
                  onKeyDown={addTag}
                  helperText={`Optional. Uses ${JOB_TAG_OPTIONS.length} approved taxonomy tags and can improve matching.`}
                />
              </Grid>
            </Grid>
          </details>
        </Grid>

        <Grid item xs={12}>
          <Stack className="recruiter-job-form-actions" direction="row" spacing={1}>
            <Button type="button" variant="outlined" onClick={handleSaveDraft} disabled={submitting}>
              Save for Later
            </Button>
            <Button type="button" variant="text" color="warning" onClick={clearDraft}>
              {isEditing ? "Reset" : "Clear"}
            </Button>
            <Box sx={{ flexGrow: 1 }} />
            <Button type="submit" variant="outlined" disabled={submitting}>
              Preview Posting
            </Button>
            {checkoutRequired ? (
              <Button
                type="button"
                variant="contained"
                disabled={submitting || checkoutLoading}
                onClick={handleCheckout}
              >
                {checkoutLoading ? "Starting Checkout..." : checkoutButtonLabel}
              </Button>
            ) : publishActionBlocked ? (
              <Button type="button" variant="contained" disabled>
                Complete Details First
              </Button>
            ) : (
              <Button type="button" variant="contained" disabled={submitting} onClick={handlePublish}>
                {submitting ? "Publishing..." : "Publish"}
              </Button>
            )}
          </Stack>
        </Grid>

        {message && (
          <Grid item xs={12}>
            <Typography variant="body2" sx={{ mt: 1 }}>
              {message}
            </Typography>
          </Grid>
        )}
        </Grid>
        ) : (
          <Typography variant="body2" className="recruiter-position-empty">
            Select a position type to configure the posting.
          </Typography>
        )}
      </Box>
    </Box>
  );
}
