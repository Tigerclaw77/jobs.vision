import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Grid,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  approveJobImport,
  fetchJobImports,
  rejectJobImport,
  runJobDiscovery,
  updateJobImport,
} from "../../utils/api";
import "./JobImportReview.css";

const SOURCE_TYPES = ["career_page", "greenhouse", "lever", "workday", "unknown"];
const JOB_ROLES = [
  ["", "Auto from tags"],
  ["optometrist", "Optometrist"],
  ["optician", "Optician"],
  ["ophthalmic_technician", "Ophthalmic Technician"],
  ["optical_lab", "Optical Lab"],
  ["front_desk", "Front Desk"],
  ["practice_manager", "Practice Manager"],
  ["other", "Other"],
];
const EMPLOYMENT_TYPES = [
  ["", "Unspecified"],
  ["full_time", "Full-Time"],
  ["part_time", "Part-Time"],
  ["per_diem_fill_in", "Per Diem / Fill-In"],
];

function normalizedFromItem(item = {}) {
  const normalized = item.normalized_job || {};
  return {
    title: normalized.title || item.normalized_title || item.raw_title || "",
    company: normalized.company || item.normalized_company || item.employer_name || "",
    location: normalized.location || item.normalized_location || item.raw_location || "",
    employmentType:
      normalized.employmentType || item.normalized_employment_type || "",
    compensation: normalized.compensation || item.normalized_compensation || "",
    description:
      normalized.description || item.normalized_description || item.raw_description || "",
    applyUrl: normalized.applyUrl || item.normalized_apply_url || item.apply_url || "",
    sourceUrl: normalized.sourceUrl || item.normalized_source_url || item.source_url || "",
    sourceType: normalized.sourceType || item.normalized_source_type || item.source_type || "unknown",
    industryTags: normalized.industryTags || item.industry_tags || [],
    roleTags: normalized.roleTags || item.role_tags || [],
    role: "",
  };
}

function statusLabel(status) {
  return String(status || "needs_review").replace(/_/g, " ");
}

function JobImportReview() {
  const [status, setStatus] = useState("needs_review");
  const [items, setItems] = useState([]);
  const [edits, setEdits] = useState({});
  const [loading, setLoading] = useState(false);
  const [runningDiscovery, setRunningDiscovery] = useState(false);
  const [message, setMessage] = useState("");
  const [sourceForm, setSourceForm] = useState({
    employerName: "",
    employerWebsiteUrl: "",
    careersUrl: "",
    industryKey: "eyecare",
    sourceType: "career_page",
  });

  async function loadImports(nextStatus = status) {
    setLoading(true);
    setMessage("");
    try {
      const rows = await fetchJobImports({ status: nextStatus, limit: 50 });
      setItems(rows);
      setEdits(
        rows.reduce((acc, item) => {
          acc[item.id] = normalizedFromItem(item);
          return acc;
        }, {})
      );
    } catch (error) {
      setMessage(error?.response?.data?.error || "Failed to load job imports.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadImports(status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const pendingCount = useMemo(
    () => items.filter((item) => item.status === "needs_review").length,
    [items]
  );

  function updateSourceField(field, value) {
    setSourceForm((current) => ({ ...current, [field]: value }));
  }

  function updateEdit(id, field, value) {
    setEdits((current) => ({
      ...current,
      [id]: {
        ...(current[id] || {}),
        [field]: value,
      },
    }));
  }

  async function handleRunDiscovery(event) {
    event.preventDefault();
    setRunningDiscovery(true);
    setMessage("");
    try {
      const source = {
        ...sourceForm,
        careersUrl: sourceForm.careersUrl || null,
        industryKey: sourceForm.industryKey || null,
      };
      const result = await runJobDiscovery(source);
      setMessage(`Discovery complete: ${result.count || 0} review item(s) saved.`);
      setSourceForm((current) => ({ ...current, employerName: "", careersUrl: "" }));
      setStatus("needs_review");
      await loadImports("needs_review");
    } catch (error) {
      setMessage(error?.response?.data?.error || "Discovery failed.");
    } finally {
      setRunningDiscovery(false);
    }
  }

  async function handleSave(id) {
    setMessage("");
    try {
      const updated = await updateJobImport(id, edits[id]);
      setItems((current) => current.map((item) => (item.id === id ? updated : item)));
      setEdits((current) => ({ ...current, [id]: normalizedFromItem(updated) }));
      setMessage("Import edits saved.");
    } catch (error) {
      setMessage(error?.response?.data?.error || "Failed to save import.");
    }
  }

  async function handleApprove(id) {
    setMessage("");
    try {
      await approveJobImport(id, edits[id]);
      setMessage("Import published as a public job.");
      await loadImports(status);
    } catch (error) {
      setMessage(error?.response?.data?.error || "Failed to publish import.");
    }
  }

  async function handleReject(id) {
    const reason = window.prompt("Optional rejection reason", "");
    if (reason === null) return;
    setMessage("");
    try {
      await rejectJobImport(id, reason);
      setMessage("Import rejected.");
      await loadImports(status);
    } catch (error) {
      setMessage(error?.response?.data?.error || "Failed to reject import.");
    }
  }

  return (
    <Box className="job-import-review text-on-dim">
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", md: "center" }}
        gap={2}
        className="job-import-review__header"
      >
        <Box>
          <Typography variant="h4" component="h2">
            Job Import Review
          </Typography>
          <Typography variant="body2">
            Discover employer career-page postings and publish only after admin review.
          </Typography>
        </Box>
        <Stack direction="row" gap={1} alignItems="center">
          <Typography variant="body2">Status</Typography>
          <Select
            size="small"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="job-import-review__select"
          >
            <MenuItem value="needs_review">Needs Review</MenuItem>
            <MenuItem value="rejected">Rejected</MenuItem>
            <MenuItem value="published">Published</MenuItem>
            <MenuItem value="all">All</MenuItem>
          </Select>
        </Stack>
      </Stack>

      <Paper className="job-import-review__panel" component="form" onSubmit={handleRunDiscovery}>
        <Typography variant="h6">Run Discovery</Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={3}>
            <TextField
              label="Employer Name"
              value={sourceForm.employerName}
              onChange={(event) => updateSourceField("employerName", event.target.value)}
              fullWidth
              required
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              label="Employer Website URL"
              value={sourceForm.employerWebsiteUrl}
              onChange={(event) => updateSourceField("employerWebsiteUrl", event.target.value)}
              fullWidth
              required
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              label="Careers URL"
              value={sourceForm.careersUrl}
              onChange={(event) => updateSourceField("careersUrl", event.target.value)}
              fullWidth
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <Select
              value={sourceForm.sourceType}
              onChange={(event) => updateSourceField("sourceType", event.target.value)}
              fullWidth
            >
              {SOURCE_TYPES.map((type) => (
                <MenuItem key={type} value={type}>
                  {type}
                </MenuItem>
              ))}
            </Select>
          </Grid>
          <Grid item xs={12} md={1}>
            <Button type="submit" variant="contained" disabled={runningDiscovery} fullWidth>
              Run
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {message ? <div className="job-import-review__message">{message}</div> : null}

      <Typography variant="body2" className="job-import-review__count">
        {loading ? "Loading imports..." : `${items.length} item(s), ${pendingCount} pending review`}
      </Typography>

      <Stack gap={2}>
        {items.map((item) => {
          const edit = edits[item.id] || normalizedFromItem(item);
          const sourceUrl = edit.sourceUrl || item.source_url;
          const applyUrl = edit.applyUrl || item.apply_url;

          return (
            <Paper className="job-import-review__item" key={item.id}>
              <Stack
                direction={{ xs: "column", md: "row" }}
                justifyContent="space-between"
                gap={1}
              >
                <Box>
                  <Typography variant="h6">{edit.title || "Untitled import"}</Typography>
                  <Typography variant="body2">
                    {edit.company || item.employer_name} {edit.location ? `- ${edit.location}` : ""}
                  </Typography>
                </Box>
                <Stack direction="row" gap={1} flexWrap="wrap">
                  <Chip label={statusLabel(item.status)} size="small" />
                  <Chip label={`${item.confidence_score || 0}% confidence`} size="small" />
                </Stack>
              </Stack>

              <Grid container spacing={2} className="job-import-review__fields">
                <Grid item xs={12} md={4}>
                  <TextField
                    label="Title"
                    value={edit.title}
                    onChange={(event) => updateEdit(item.id, "title", event.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    label="Company"
                    value={edit.company}
                    onChange={(event) => updateEdit(item.id, "company", event.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    label="Location"
                    value={edit.location}
                    onChange={(event) => updateEdit(item.id, "location", event.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <Select
                    value={edit.role}
                    onChange={(event) => updateEdit(item.id, "role", event.target.value)}
                    fullWidth
                  >
                    {JOB_ROLES.map(([value, label]) => (
                      <MenuItem key={value || "auto"} value={value}>
                        {label}
                      </MenuItem>
                    ))}
                  </Select>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Select
                    value={edit.employmentType || ""}
                    onChange={(event) => updateEdit(item.id, "employmentType", event.target.value)}
                    fullWidth
                  >
                    {EMPLOYMENT_TYPES.map(([value, label]) => (
                      <MenuItem key={value || "empty"} value={value}>
                        {label}
                      </MenuItem>
                    ))}
                  </Select>
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    label="Compensation"
                    value={edit.compensation}
                    onChange={(event) => updateEdit(item.id, "compensation", event.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Apply URL"
                    value={edit.applyUrl}
                    onChange={(event) => updateEdit(item.id, "applyUrl", event.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Source URL"
                    value={edit.sourceUrl}
                    onChange={(event) => updateEdit(item.id, "sourceUrl", event.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Description"
                    value={edit.description}
                    onChange={(event) => updateEdit(item.id, "description", event.target.value)}
                    fullWidth
                    multiline
                    minRows={3}
                  />
                </Grid>
              </Grid>

              <Stack direction="row" gap={1} flexWrap="wrap" className="job-import-review__tags">
                {(edit.roleTags || []).map((tag) => (
                  <Chip key={`role-${tag}`} label={tag} size="small" />
                ))}
                {(edit.industryTags || []).map((tag) => (
                  <Chip key={`industry-${tag}`} label={tag} size="small" variant="outlined" />
                ))}
              </Stack>

              <Stack direction="row" gap={1} flexWrap="wrap" className="job-import-review__actions">
                {sourceUrl ? (
                  <Button href={sourceUrl} target="_blank" rel="noreferrer" variant="outlined">
                    Open Source
                  </Button>
                ) : null}
                {applyUrl ? (
                  <Button href={applyUrl} target="_blank" rel="noreferrer" variant="outlined">
                    Open Apply URL
                  </Button>
                ) : null}
                <Button onClick={() => handleSave(item.id)} variant="outlined">
                  Save Edits
                </Button>
                <Button
                  onClick={() => handleApprove(item.id)}
                  variant="contained"
                  disabled={item.status === "published"}
                >
                  Approve / Publish
                </Button>
                <Button
                  onClick={() => handleReject(item.id)}
                  variant="outlined"
                  color="error"
                  disabled={item.status === "published"}
                >
                  Reject
                </Button>
              </Stack>
            </Paper>
          );
        })}
      </Stack>
    </Box>
  );
}

export default JobImportReview;
