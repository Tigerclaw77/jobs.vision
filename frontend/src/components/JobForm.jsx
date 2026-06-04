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

import { createJob, updateJob } from "../utils/api";
import {
  COMPENSATION_TYPE_OPTIONS,
  EMPLOYMENT_TYPE_OPTIONS,
  OPPORTUNITY_TYPE_OPTIONS,
  PRACTICE_TYPE_OPTIONS,
  ROLE_OPTIONS,
  WORK_ARRANGEMENT_OPTIONS,
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

const defaultValues = {
  title: "",
  company: "",
  location: "",
  role_type: "optometrist",
  opportunity_types: [],
  practice_type: "",
  employment_types: [],
  work_arrangements: [],
  hours_per_week: "",
  compensation_type: "",
  salary_min: "",
  salary_max: "",
  hourly_min: "",
  hourly_max: "",
  daily_rate: "",
  compensation_notes: "",
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
  const role = normalizeRole(raw.role_type || raw.role) || defaultValues.role_type;
  return {
    ...defaultValues,
    ...raw,
    role_type: role,
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
  const numericHours = Number(job.hours);
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
    hours_per_week: job.hours && !Number.isNaN(numericHours) ? String(job.hours) : "",
    compensation_type: job.compensation_type || "",
    salary_min: job.salary_min ?? salary.salary_min,
    salary_max: job.salary_max ?? salary.salary_max,
    hourly_min: job.hourly_min ?? "",
    hourly_max: job.hourly_max ?? "",
    daily_rate: job.daily_rate ?? "",
    compensation_notes: job.compensation_notes || "",
    description: job.description || "",
    tags: Array.isArray(job.tag_ids) ? job.tag_ids : Array.isArray(job.tags) ? job.tags : [],
  };
}

function validate(values) {
  const errors = {};
  if (!values.title.trim()) errors.title = "Job title is required.";
  if (!values.company.trim()) errors.company = "Company is required.";
  if (!values.location.trim()) errors.location = "City/State (or Remote) is required.";
  if (!values.role_type) errors.role_type = "Role is required.";
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
  if (values.hours_per_week && Number.isNaN(Number(values.hours_per_week))) {
    errors.hours_per_week = "Enter a number.";
  }
  ["hourly_min", "hourly_max", "daily_rate"].forEach((field) => {
    if (values[field] && Number.isNaN(Number(values[field]))) {
      errors[field] = "Enter a number.";
    }
  });
  if (values.hourly_min && values.hourly_max && Number(values.hourly_min) > Number(values.hourly_max)) {
    errors.hourly_max = "Max must be >= Min.";
  }
  if (values.compensation_type === "annual_salary" && !values.salary_min && !values.salary_max) {
    errors.salary_min = "Enter at least one salary value.";
  }
  if (values.compensation_type === "hourly_wage" && !values.hourly_min && !values.hourly_max) {
    errors.hourly_min = "Enter at least one hourly value.";
  }
  if (values.compensation_type === "per_diem" && !values.daily_rate) {
    errors.daily_rate = "Enter a daily rate.";
  }
  if (
    ["production_based", "other"].includes(values.compensation_type) &&
    !values.compensation_notes.trim()
  ) {
    errors.compensation_notes = "Enter compensation details.";
  }
  return errors;
}

function MultiSelectField({ label, labelId, value, onChange, options }) {
  return (
    <FormControl fullWidth>
      <InputLabel id={labelId}>{label}</InputLabel>
      <Select
        labelId={labelId}
        multiple
        label={label}
        value={value || []}
        onChange={onChange}
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
    </FormControl>
  );
}

export default function JobForm({ jobToEdit = null, onCreated, onSuccess }) {
  const editingJobId = jobToEdit?.id || jobToEdit?._id || null;
  const isEditing = Boolean(editingJobId);
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

  useEffect(() => {
    if (!jobToEdit) return;
    setValues(valuesFromJob(jobToEdit));
    setErrors({});
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
  };

  const handleRoleChange = (e) => {
    const role = e?.target?.value || "";
    setValues((prev) => ({
      ...prev,
      role_type: role,
      opportunity_types: role === "optometrist" ? prev.opportunity_types : [],
    }));
  };

  const handleMultiChange = (field) => (e) => {
    const v = e?.target?.value ?? [];
    setValues((prev) => ({ ...prev, [field]: Array.isArray(v) ? v : String(v).split(",") }));
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

  const addTag = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const raw = e.target.value.trim();
      if (!raw) return;
      if (!values.tags.includes(raw)) {
        setValues((p) => ({ ...p, tags: [...p.tags, raw] }));
      }
      e.target.value = "";
    }
  };

  const removeTag = (tag) => {
    setValues((p) => ({ ...p, tags: p.tags.filter((t) => t !== tag) }));
  };

  const saveDraft = () => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(values));
      setMessage("Draft saved locally.");
      setTimeout(() => setMessage(""), 1500);
    } catch {
      setMessage("Could not save draft.");
      setTimeout(() => setMessage(""), 2000);
    }
  };

  const clearDraft = () => {
    setValues(jobToEdit ? valuesFromJob(jobToEdit) : defaultValues);
    setErrors({});
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {}
    setMessage(isEditing ? "Reset." : "Cleared.");
    setTimeout(() => setMessage(""), 1000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nextErrors = validate(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setMessage("Please fix the highlighted fields.");
      setTimeout(() => setMessage(""), 2000);
      return;
    }
    setSubmitting(true);
    setMessage("");

    const { city, state } = splitLocation(values.location);
    const opportunityTypes =
      values.role_type === "optometrist" ? values.opportunity_types || [] : [];
    const employmentTypes = values.employment_types || [];
    const workArrangements = values.work_arrangements || [];
    const compensation = compensationPayload(values);

    const payload = {
      title: values.title.trim(),
      company: values.company.trim(),
      employer_name: values.company.trim(),
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
      hours: values.hours_per_week ? String(Number(values.hours_per_week)) : null,
      ...compensation,
      description: values.description.trim(),
      tag_ids: values.tags,
    };

    try {
      if (!isEditing || hasLocationChanged(jobToEdit, payload)) {
        if (GOOGLE_MAPS_API_KEY) {
          const coords = await geocodeJobPayload(payload);
          payload.latitude = coords.latitude;
          payload.longitude = coords.longitude;
        }
      }

      const result = isEditing
        ? await updateJob(editingJobId, payload)
        : await createJob(payload);
      const savedJob = result?.job || result;

      // Success
      setMessage(isEditing ? "Job updated!" : "Job saved!");
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {}
      if (onCreated) onCreated(savedJob || null);
      if (onSuccess) onSuccess(savedJob || null);
      if (!isEditing) setValues(defaultValues);
      setErrors({});
    } catch (err) {
      console.error("Submit failed:", err);
      setMessage(err?.response?.data?.error || err?.message || "Failed to save job.");
    } finally {
      setSubmitting(false);
      setTimeout(() => setMessage(""), 2000);
    }
  };

  return (
    <Box className="recruiter-job-form-page">
      <Box
        component="form"
        onSubmit={handleSubmit}
        className="recruiter-job-form-card"
      >
        <Typography variant="h5" className="recruiter-job-form-title">
          {isEditing ? "Edit Job" : "Add a Job"}
        </Typography>

        <Grid container spacing={2.5}>
        <Grid item xs={12} md={8}>
          <TextField
            label="Job Title*"
            fullWidth
            value={values.title}
            onChange={handleChange("title")}
            error={!!errors.title}
            helperText={errors.title}
          />
        </Grid>

        <Grid item xs={12} md={4}>
          <TextField
            label="Company*"
            fullWidth
            value={values.company}
            onChange={handleChange("company")}
            error={!!errors.company}
            helperText={errors.company}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            label="Location* (City, ST or Remote)"
            fullWidth
            value={values.location}
            onChange={handleChange("location")}
            error={!!errors.location}
            helperText={errors.location}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <FormControl fullWidth error={!!errors.role_type}>
            <InputLabel id="role-type-label">Role*</InputLabel>
            <Select
              labelId="role-type-label"
              label="Role*"
              value={values.role_type}
              onChange={handleRoleChange}
            >
              {ROLE_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
            {!!errors.role_type && <FormHelperText>{errors.role_type}</FormHelperText>}
          </FormControl>
        </Grid>

        <Grid item xs={12} md={6}>
          <MultiSelectField
            label="Employment Type"
            labelId="employment-type-label"
            value={values.employment_types}
            onChange={handleMultiChange("employment_types")}
            options={EMPLOYMENT_TYPE_OPTIONS}
          />
        </Grid>

        {values.role_type === "optometrist" && (
          <Grid item xs={12} md={6}>
            <MultiSelectField
              label="Opportunity Type"
              labelId="opportunity-type-label"
              value={values.opportunity_types}
              onChange={handleMultiChange("opportunity_types")}
              options={OPPORTUNITY_TYPE_OPTIONS}
            />
          </Grid>
        )}

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
          </FormControl>
        </Grid>

        <Grid item xs={12} md={6}>
          <MultiSelectField
            label="Work Arrangement"
            labelId="work-arrangement-label"
            value={values.work_arrangements}
            onChange={handleMultiChange("work_arrangements")}
            options={WORK_ARRANGEMENT_OPTIONS}
          />
        </Grid>

        <Grid item xs={12} md={4}>
          <TextField
            label="Hours per week"
            fullWidth
            value={values.hours_per_week}
            onChange={handleChange("hours_per_week")}
            error={!!errors.hours_per_week}
            helperText={errors.hours_per_week}
            inputProps={{ inputMode: "numeric" }}
          />
        </Grid>

        <Grid item xs={12} md={4}>
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
          </FormControl>
        </Grid>

        {values.compensation_type === "annual_salary" && (
          <>
            <Grid item xs={6} md={4}>
              <TextField
                label="Salary Min"
                fullWidth
                value={values.salary_min}
                onChange={handleChange("salary_min")}
                error={!!errors.salary_min}
                helperText={errors.salary_min}
                inputProps={{ inputMode: "numeric" }}
              />
            </Grid>
            <Grid item xs={6} md={4}>
              <TextField
                label="Salary Max"
                fullWidth
                value={values.salary_max}
                onChange={handleChange("salary_max")}
                error={!!errors.salary_max}
                helperText={errors.salary_max}
                inputProps={{ inputMode: "numeric" }}
              />
            </Grid>
          </>
        )}

        {values.compensation_type === "hourly_wage" && (
          <>
            <Grid item xs={6} md={4}>
              <TextField
                label="Hourly Min"
                fullWidth
                value={values.hourly_min}
                onChange={handleChange("hourly_min")}
                error={!!errors.hourly_min}
                helperText={errors.hourly_min}
                inputProps={{ inputMode: "numeric" }}
              />
            </Grid>
            <Grid item xs={6} md={4}>
              <TextField
                label="Hourly Max"
                fullWidth
                value={values.hourly_max}
                onChange={handleChange("hourly_max")}
                error={!!errors.hourly_max}
                helperText={errors.hourly_max}
                inputProps={{ inputMode: "numeric" }}
              />
            </Grid>
          </>
        )}

        {values.compensation_type === "per_diem" && (
          <Grid item xs={12} md={4}>
            <TextField
              label="Daily Rate"
              fullWidth
              value={values.daily_rate}
              onChange={handleChange("daily_rate")}
              error={!!errors.daily_rate}
              helperText={errors.daily_rate}
              inputProps={{ inputMode: "numeric" }}
            />
          </Grid>
        )}

        {["production_based", "other"].includes(values.compensation_type) && (
          <Grid item xs={12} md={8}>
            <TextField
              label="Compensation Notes"
              fullWidth
              value={values.compensation_notes}
              onChange={handleChange("compensation_notes")}
              error={!!errors.compensation_notes}
              helperText={errors.compensation_notes}
            />
          </Grid>
        )}

        <Grid item xs={12}>
          <TextField
            label="Description"
            fullWidth
            multiline
            minRows={6}
            value={values.description}
            onChange={handleChange("description")}
          />
        </Grid>

        <Grid item xs={12}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Tags (press Enter to add)
          </Typography>
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1, mb: 1 }}>
            {values.tags.map((t) => (
              <Chip key={t} label={t} onDelete={() => removeTag(t)} />
            ))}
          </Stack>
          <TextField
            placeholder="e.g., pediatrics, scleral lenses, bilingual"
            fullWidth
            onKeyDown={addTag}
          />
        </Grid>

        <Grid item xs={12}>
          <Stack className="recruiter-job-form-actions" direction="row" spacing={1}>
            {!isEditing && (
              <Button type="button" variant="outlined" onClick={saveDraft}>
                Save Draft (Local)
              </Button>
            )}
            <Button type="button" variant="text" color="warning" onClick={clearDraft}>
              {isEditing ? "Reset" : "Clear"}
            </Button>
            <Box sx={{ flexGrow: 1 }} />
            <Button type="submit" variant="contained" disabled={submitting}>
              {submitting ? "Submitting…" : isEditing ? "Update" : "Submit"}
            </Button>
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
      </Box>
    </Box>
  );
}
