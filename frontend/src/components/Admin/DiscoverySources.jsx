import React, { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Box,
  Button,
  Checkbox,
  Chip,
  FormControlLabel,
  Grid,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  createDiscoverySource,
  deleteDiscoverySource,
  fetchDiscoverySources,
  runDiscoverySource,
  runDiscoverySources,
  updateDiscoverySource,
} from "../../utils/api";
import "./DiscoverySources.css";

const SOURCE_TYPES = ["career_page", "greenhouse", "lever", "workday", "unknown"];
const EMPTY_FORM = {
  employerName: "",
  employerWebsiteUrl: "",
  careersUrl: "",
  industryKey: "eyecare",
  sourceType: "career_page",
  enabled: true,
  notes: "",
};

function toForm(row = {}) {
  return {
    employerName: row.employer_name || "",
    employerWebsiteUrl: row.employer_website_url || "",
    careersUrl: row.careers_url || "",
    industryKey: row.industry_key || "eyecare",
    sourceType: row.source_type || "career_page",
    enabled: row.enabled !== false,
    notes: row.notes || "",
  };
}

function formatLastRun(row) {
  if (!row.last_run_at) return "Never run";
  const date = new Date(row.last_run_at);
  const status = row.last_run_status === "failed" ? "Failed" : "Succeeded";
  return `${status} ${date.toLocaleString()}`;
}

function DiscoverySources() {
  const [sources, setSources] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [runningId, setRunningId] = useState(null);
  const [message, setMessage] = useState("");

  async function loadSources() {
    setLoading(true);
    setMessage("");
    try {
      setSources(await fetchDiscoverySources());
    } catch (error) {
      setMessage(error?.response?.data?.error || "Failed to load discovery sources.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSources();
  }, []);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      if (editingId) {
        await updateDiscoverySource(editingId, form);
        setMessage("Discovery source updated.");
      } else {
        await createDiscoverySource(form);
        setMessage("Discovery source added.");
      }
      resetForm();
      await loadSources();
    } catch (error) {
      setMessage(error?.response?.data?.error || "Failed to save discovery source.");
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(source) {
    setEditingId(source.id);
    setForm(toForm(source));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDelete(source) {
    if (!window.confirm(`Remove ${source.employer_name} from discovery sources?`)) return;
    setMessage("");
    try {
      await deleteDiscoverySource(source.id);
      setMessage("Discovery source removed.");
      await loadSources();
    } catch (error) {
      setMessage(error?.response?.data?.error || "Failed to remove discovery source.");
    }
  }

  async function handleRunOne(source) {
    setRunningId(source.id);
    setMessage("");
    try {
      const result = await runDiscoverySource(source.id);
      setMessage(`Discovery complete for ${source.employer_name}: ${result.count || 0} review item(s) saved.`);
      await loadSources();
    } catch (error) {
      setMessage(error?.response?.data?.error || "Discovery failed.");
      await loadSources();
    } finally {
      setRunningId(null);
    }
  }

  async function handleRunEnabled() {
    setRunningId("all");
    setMessage("");
    try {
      const result = await runDiscoverySources();
      setMessage(`Discovery complete: ${result.count || 0} review item(s) saved.`);
      await loadSources();
    } catch (error) {
      setMessage(error?.response?.data?.error || "Discovery failed.");
      await loadSources();
    } finally {
      setRunningId(null);
    }
  }

  return (
    <Box className="discovery-sources text-on-dim">
      <Stack
        className="discovery-sources__header"
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", md: "center" }}
        gap={2}
      >
        <Box>
          <Typography variant="h4" component="h2">
            Discovery Sources
          </Typography>
          <Typography variant="body2">
            Save employer career URLs and run discovery from the browser.
          </Typography>
        </Box>
        <Stack direction="row" gap={1} flexWrap="wrap">
          <Button
            component={RouterLink}
            to="/admin/job-imports"
            variant="outlined"
            className="glass-button"
          >
            Review Imports
          </Button>
          <Button
            onClick={handleRunEnabled}
            variant="contained"
            disabled={runningId === "all" || !sources.some((source) => source.enabled)}
          >
            Run Enabled Sources
          </Button>
        </Stack>
      </Stack>

      <Paper className="discovery-sources__panel" component="form" onSubmit={handleSubmit}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2}>
          <Typography variant="h6">
            {editingId ? "Edit Source" : "Add Source"}
          </Typography>
          {editingId ? (
            <Button onClick={resetForm} variant="text">
              Cancel Edit
            </Button>
          ) : null}
        </Stack>
        <Grid container spacing={2}>
          <Grid item xs={12} md={3}>
            <TextField
              label="Employer Name"
              value={form.employerName}
              onChange={(event) => updateForm("employerName", event.target.value)}
              fullWidth
              required
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              label="Employer Website URL"
              value={form.employerWebsiteUrl}
              onChange={(event) => updateForm("employerWebsiteUrl", event.target.value)}
              fullWidth
              required
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              label="Careers URL"
              value={form.careersUrl}
              onChange={(event) => updateForm("careersUrl", event.target.value)}
              fullWidth
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <Select
              value={form.sourceType}
              onChange={(event) => updateForm("sourceType", event.target.value)}
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
            <FormControlLabel
              className="discovery-sources__enabled"
              control={
                <Checkbox
                  checked={form.enabled}
                  onChange={(event) => updateForm("enabled", event.target.checked)}
                />
              }
              label="Enabled"
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              label="Industry Key"
              value={form.industryKey}
              onChange={(event) => updateForm("industryKey", event.target.value)}
              fullWidth
            />
          </Grid>
          <Grid item xs={12} md={8}>
            <TextField
              label="Notes"
              value={form.notes}
              onChange={(event) => updateForm("notes", event.target.value)}
              fullWidth
            />
          </Grid>
          <Grid item xs={12}>
            <Button type="submit" variant="contained" disabled={saving}>
              {editingId ? "Save Changes" : "Add Source"}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {message ? <div className="discovery-sources__message">{message}</div> : null}

      <Typography variant="body2" className="discovery-sources__count">
        {loading ? "Loading sources..." : `${sources.length} saved source(s)`}
      </Typography>

      <Stack gap={2}>
        {sources.map((source) => (
          <Paper className="discovery-sources__item" key={source.id}>
            <Stack
              direction={{ xs: "column", md: "row" }}
              justifyContent="space-between"
              gap={2}
            >
              <Box>
                <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
                  <Typography variant="h6">{source.employer_name}</Typography>
                  <Chip
                    size="small"
                    label={source.enabled ? "Enabled" : "Disabled"}
                    color={source.enabled ? "success" : "default"}
                  />
                  <Chip size="small" label={source.source_type} />
                  {source.industry_key ? <Chip size="small" label={source.industry_key} /> : null}
                </Stack>
                <Typography variant="body2">
                  Website:{" "}
                  <a href={source.employer_website_url} target="_blank" rel="noreferrer">
                    {source.employer_website_url}
                  </a>
                </Typography>
                {source.careers_url ? (
                  <Typography variant="body2">
                    Careers:{" "}
                    <a href={source.careers_url} target="_blank" rel="noreferrer">
                      {source.careers_url}
                    </a>
                  </Typography>
                ) : null}
                <Typography variant="body2">
                  {formatLastRun(source)}
                  {source.last_run_message ? ` - ${source.last_run_message}` : ""}
                </Typography>
                {source.notes ? (
                  <Typography variant="body2" className="discovery-sources__notes">
                    {source.notes}
                  </Typography>
                ) : null}
              </Box>
              <Stack direction="row" gap={1} alignItems="flex-start" flexWrap="wrap">
                <Button
                  onClick={() => handleRunOne(source)}
                  variant="contained"
                  disabled={runningId === source.id}
                >
                  Run
                </Button>
                <Button onClick={() => handleEdit(source)} variant="outlined">
                  Edit
                </Button>
                <Button onClick={() => handleDelete(source)} variant="outlined" color="error">
                  Remove
                </Button>
              </Stack>
            </Stack>
          </Paper>
        ))}
      </Stack>
    </Box>
  );
}

export default DiscoverySources;
