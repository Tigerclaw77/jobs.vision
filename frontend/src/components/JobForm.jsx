import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  Chip,
  FormControl,
  FormHelperText,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import { createJob, updateJob } from "../utils/api";
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
  opportunity_type: "",
  practice_type: "",
  employment_type: "",
  work_arrangement: "",
  hours_per_week: "",
  salary_min: "",
  salary_max: "",
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

function normalizeRoleValue(value = "") {
  const normalized = String(value).trim().toLowerCase().replace(/[_-]+/g, " ");
  const aliases = {
    tech: "ophthalmic technician",
    technician: "ophthalmic technician",
    "ophthalmic tech": "ophthalmic technician",
    manager: "practice manager",
    "practice manager": "practice manager",
    optometrist: "optometrist",
    optician: "optician",
    "ophthalmic technician": "ophthalmic technician",
  };
  return aliases[normalized] || "";
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

function valuesFromJob(job = {}) {
  const salary = parseSalaryRange(job.salary);
  const numericHours = Number(job.hours);
  return {
    ...defaultValues,
    title: job.title || "",
    company: job.employer_name || job.company || "",
    location: job.location || [job.city, job.state].filter(Boolean).join(", "),
    role_type: normalizeRoleValue(job.role) || "",
    opportunity_type: normalizeOpportunityValue(job.opportunity_type) || "",
    practice_type: job.practice_type || "",
    employment_type: normalizeEmploymentValue(job.employment_type || job.type) || "",
    work_arrangement:
      normalizeWorkArrangementValue(
        job.work_arrangement ||
          job.onsite_type ||
          (job.employment_type === "remote" || job.type === "remote" ? "remote" : "")
      ) || "",
    hours_per_week: job.hours && !Number.isNaN(numericHours) ? String(job.hours) : "",
    salary_min: salary.salary_min,
    salary_max: salary.salary_max,
    description: job.description || "",
    tags: Array.isArray(job.tag_ids) ? job.tag_ids : Array.isArray(job.tags) ? job.tags : [],
  };
}

const roleOptions = [
  { value: "optometrist", label: "Optometrist" },
  { value: "optician", label: "Optician" },
  { value: "ophthalmic technician", label: "Ophthalmic Technician" },
  { value: "practice manager", label: "Practice Manager" },
];

const employmentOptions = [
  { value: "full_time", label: "Full-Time" },
  { value: "part_time", label: "Part-Time" },
  { value: "per_diem_fill_in", label: "Per Diem / Fill-In" },
];

const opportunityOptions = [
  { value: "associate_w2", label: "Associate (W-2)" },
  { value: "associate_1099", label: "Associate (1099)" },
  { value: "corporate_employment", label: "Corporate Employment" },
  { value: "corporate_lease", label: "Corporate Lease" },
  { value: "partnership_opportunity", label: "Partnership Opportunity" },
  { value: "practice_acquisition", label: "Practice Acquisition" },
];

const practiceOptions = [
  { value: "private_practice", label: "Private Practice" },
  { value: "corporate", label: "Corporate" },
  { value: "od_md", label: "OD/MD" },
];

const workArrangementOptions = [
  { value: "on_site", label: "On-Site" },
  { value: "hybrid", label: "Hybrid" },
  { value: "remote", label: "Remote" },
];

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
  return errors;
}

export default function JobForm({ jobToEdit = null, onCreated, onSuccess }) {
  const editingJobId = jobToEdit?.id || jobToEdit?._id || null;
  const isEditing = Boolean(editingJobId);
  const [values, setValues] = useState(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      return raw ? { ...defaultValues, ...JSON.parse(raw) } : defaultValues;
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
    const salary =
      values.salary_min && values.salary_max
        ? `${Number(values.salary_min)} - ${Number(values.salary_max)}`
        : values.salary_min
        ? `From ${Number(values.salary_min)}`
        : values.salary_max
        ? `Up to ${Number(values.salary_max)}`
        : null;

    const payload = {
      title: values.title.trim(),
      company: values.company.trim(),
      employer_name: values.company.trim(),
      location: values.location.trim(),
      city,
      state,
      role: values.role_type,
      type: values.employment_type || null,
      opportunity_type: values.opportunity_type || null,
      practice_type: values.practice_type || null,
      employment_type: values.employment_type || null,
      work_arrangement: values.work_arrangement || null,
      hours: values.hours_per_week ? String(Number(values.hours_per_week)) : null,
      salary,
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
              onChange={handleChange("role_type")}
            >
              {roleOptions.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
            {!!errors.role_type && <FormHelperText>{errors.role_type}</FormHelperText>}
          </FormControl>
        </Grid>

        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel id="employment-type-label">Employment Type</InputLabel>
            <Select
              labelId="employment-type-label"
              label="Employment Type"
              value={values.employment_type}
              onChange={handleChange("employment_type")}
            >
              <MenuItem value="">Optional</MenuItem>
              {employmentOptions.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel id="opportunity-type-label">Opportunity Type</InputLabel>
            <Select
              labelId="opportunity-type-label"
              label="Opportunity Type"
              value={values.opportunity_type}
              onChange={handleChange("opportunity_type")}
            >
              <MenuItem value="">Optional</MenuItem>
              {opportunityOptions.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

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
              {practiceOptions.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel id="work-arrangement-label">Work Arrangement</InputLabel>
            <Select
              labelId="work-arrangement-label"
              label="Work Arrangement"
              value={values.work_arrangement}
              onChange={handleChange("work_arrangement")}
            >
              <MenuItem value="">Optional</MenuItem>
              {workArrangementOptions.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
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
