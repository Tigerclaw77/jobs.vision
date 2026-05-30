import React, { useEffect, useMemo, useState } from "react";
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

// IMPORTANT: you already have this helper in frontend/lib/apiFetch.js
// Path from src/components/* to lib/* is two levels up:
import apiFetch from "./apiFetch";

// Draft storage key
const DRAFT_KEY = "jobFormDraft:v1";

const defaultValues = {
  title: "",
  company: "",
  location: "",
  role_type: "optometrist",
  employment_type: "full_time", // full_time | part_time | contract | temp | internship
  onsite_type: "onsite",        // onsite | hybrid | remote
  hours_per_week: "",
  salary_min: "",
  salary_max: "",
  description: "",
  tags: [],
};

const roleOptions = [
  { value: "optometrist", label: "Optometrist" },
  { value: "optician", label: "Optician" },
  { value: "tech", label: "Tech / Assistant" },
  { value: "manager", label: "Manager" },
  { value: "front_desk", label: "Front Desk" },
  { value: "other", label: "Other" },
];

const employmentOptions = [
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "temp", label: "Temporary" },
  { value: "internship", label: "Internship" },
];

const onsiteOptions = [
  { value: "onsite", label: "On-site" },
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

export default function JobForm({ onCreated }) {
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

  // Autosave (debounced)
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(values));
      } catch {}
    }, 300);
    return () => clearTimeout(id);
  }, [values]);

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
    setValues(defaultValues);
    setErrors({});
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {}
    setMessage("Cleared.");
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

    // Payload the backend expects (adjust if your API differs)
    const payload = {
      title: values.title.trim(),
      company: values.company.trim(),
      location: values.location.trim(),
      role_type: values.role_type,
      employment_type: values.employment_type,
      onsite_type: values.onsite_type,
      hours_per_week: values.hours_per_week ? Number(values.hours_per_week) : null,
      salary_min: values.salary_min ? Number(values.salary_min) : null,
      salary_max: values.salary_max ? Number(values.salary_max) : null,
      description: values.description.trim(),
      tags: values.tags,
      status: "draft", // or "active" if you want immediate listing
    };

    try {
      // Try your API first (uses your existing helper)
      const res = await apiFetch("/jobs", {
        method: "POST",
        body: payload,
      });

      if (!res?.ok) {
        // apiFetch may already throw; but if it returns ok:false, handle it:
        throw new Error(res?.error || "Unknown API error");
      }

      // Success
      setMessage("Job saved!");
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {}
      if (onCreated) onCreated(res.data || null);
      setValues(defaultValues);
      setErrors({});
    } catch (err) {
      // Graceful fallback when backend/env is not ready
      console.error("Submit failed:", err);
      setMessage("API not available. Draft kept locally.");
    } finally {
      setSubmitting(false);
      setTimeout(() => setMessage(""), 2000);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ maxWidth: 980, mx: "auto", p: 2 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>Add a Job</Typography>

      <Grid container spacing={2}>
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
            <InputLabel id="onsite-type-label">On-site / Remote</InputLabel>
            <Select
              labelId="onsite-type-label"
              label="On-site / Remote"
              value={values.onsite_type}
              onChange={handleChange("onsite_type")}
            >
              {onsiteOptions.map((opt) => (
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
          <Stack direction="row" spacing={1}>
            <Button type="button" variant="outlined" onClick={saveDraft}>
              Save Draft (Local)
            </Button>
            <Button type="button" variant="text" color="warning" onClick={clearDraft}>
              Clear
            </Button>
            <Box sx={{ flexGrow: 1 }} />
            <Button type="submit" variant="contained" disabled={submitting}>
              {submitting ? "Submitting…" : "Submit"}
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
  );
}
