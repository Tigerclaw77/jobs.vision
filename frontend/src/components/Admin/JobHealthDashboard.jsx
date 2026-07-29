import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
  Box,
  Button,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import {
  fetchJobHealthJobs,
  fetchJobHealthSummary,
  queueJobHealthRecheck,
} from "../../utils/api";
import "./JobHealthDashboard.css";

const PAGE_SIZE = 50;
const EMPTY_SUMMARY = { counts: {}, policy: null };
const DEFAULT_FILTERS = {
  healthStatus: "",
  source: "",
  employer: "",
  visibility: "all",
  minScore: "",
  maxScore: "",
};

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function formatDate(value) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function humanize(value, fallback = "Unknown") {
  const text = String(value || "").trim();
  if (!text) return fallback;
  return text.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function MetricCard({ label, value, tone = "neutral", helper }) {
  return (
    <Paper className={`job-health-metric job-health-metric-${tone}`}>
      <Typography variant="body2" className="job-health-metric-label">
        {label}
      </Typography>
      <Typography variant="h4" className="job-health-metric-value">
        {formatNumber(value)}
      </Typography>
      {helper ? (
        <Typography variant="caption" className="job-health-metric-helper">
          {helper}
        </Typography>
      ) : null}
    </Paper>
  );
}

function StatusBadge({ value }) {
  const normalized = String(value || "unknown").toLowerCase();
  return (
    <span className={`job-health-status job-health-status-${normalized}`}>
      {humanize(normalized)}
    </span>
  );
}

function apiFilters(filters) {
  const params = {};
  if (filters.healthStatus) params.healthStatus = filters.healthStatus;
  if (filters.source.trim()) params.source = filters.source.trim();
  if (filters.employer.trim()) params.employer = filters.employer.trim();
  if (filters.minScore !== "") params.minScore = filters.minScore;
  if (filters.maxScore !== "") params.maxScore = filters.maxScore;
  if (filters.visibility === "public") {
    params.hidden = false;
    params.archived = false;
  } else if (filters.visibility === "hidden") {
    params.hidden = true;
    params.archived = false;
  } else if (filters.visibility === "archived") {
    params.archived = true;
  }
  return params;
}

export default function JobHealthDashboard() {
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [jobs, setJobs] = useState([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [recheckingId, setRecheckingId] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const [summaryResult, jobsResult] = await Promise.all([
        fetchJobHealthSummary(),
        fetchJobHealthJobs({
          ...apiFilters(appliedFilters),
          limit: PAGE_SIZE,
          offset,
        }),
      ]);
      setSummary(summaryResult || EMPTY_SUMMARY);
      setJobs(jobsResult?.items || []);
      setTotal(Number(jobsResult?.total || 0));
    } catch (error) {
      setMessage(error?.response?.data?.error || "Failed to load Job Health data.");
      setJobs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, offset]);

  useEffect(() => {
    load();
  }, [load, refreshToken]);

  const metrics = useMemo(() => {
    const counts = summary.counts || {};
    return [
      ["Healthy", counts.healthy, "good"],
      ["Warning", counts.warning, "warning"],
      ["Stale", counts.stale, "warning"],
      ["Broken", counts.broken, "danger"],
      ["Hidden", counts.hidden, "danger"],
      ["Archived", counts.archived, "neutral"],
      ["Unknown", counts.unknown, "neutral"],
      ["Overdue", counts.overdue, counts.overdue ? "warning" : "good"],
    ];
  }, [summary.counts]);

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters((current) => ({ ...current, [name]: value }));
  };

  const applyFilters = (event) => {
    event.preventDefault();
    setOffset(0);
    setAppliedFilters({ ...filters });
  };

  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    setOffset(0);
  };

  const recheck = async (jobId) => {
    setRecheckingId(jobId);
    setMessage("");
    try {
      await queueJobHealthRecheck(jobId, "Recheck requested from Job Health dashboard.");
      setMessage("Recheck queued. The worker will prioritize this listing.");
      setRefreshToken((value) => value + 1);
    } catch (error) {
      setMessage(error?.response?.data?.error || "Failed to queue recheck.");
    } finally {
      setRecheckingId("");
    }
  };

  const pageStart = total ? offset + 1 : 0;
  const pageEnd = Math.min(total, offset + PAGE_SIZE);
  const policy = summary.policy;
  const shadowMode = policy?.config?.automation?.shadowMode !== false;

  return (
    <Box className="job-health-page text-on-dim" sx={{ px: { xs: 2, md: 3 }, py: 2 }}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        alignItems={{ xs: "stretch", md: "center" }}
        justifyContent="space-between"
        gap={2}
        className="job-health-header"
      >
        <div>
          <Typography variant="h4" component="h2">
            Job Health
          </Typography>
          <Typography variant="body2">
            Verification, confidence, freshness, and automated lifecycle evidence.
          </Typography>
        </div>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Button
            component={RouterLink}
            to="/admin"
            variant="outlined"
            className="glass-button"
            startIcon={<ArrowBackIcon />}
          >
            Admin
          </Button>
          <Button
            type="button"
            variant="contained"
            className="glass-button"
            startIcon={<RefreshIcon />}
            onClick={() => setRefreshToken((value) => value + 1)}
            disabled={loading}
          >
            Refresh
          </Button>
        </Stack>
      </Stack>

      {policy ? (
        <div className={`job-health-policy ${shadowMode ? "is-shadow" : "is-live"}`}>
          <strong>{policy.name}</strong>
          <span>
            Policy {policy.version} - {shadowMode ? "Shadow mode: no automatic lifecycle actions" : "Lifecycle automation enabled"}
          </span>
        </div>
      ) : null}

      {message ? <div className="job-health-message">{message}</div> : null}

      <div className="job-health-metrics">
        {metrics.map(([label, value, tone]) => (
          <MetricCard key={label} label={label} value={value} tone={tone} />
        ))}
      </div>

      <Paper className="job-health-filter-panel">
        <form className="job-health-filters" onSubmit={applyFilters}>
          <label>
            <span>Health status</span>
            <select name="healthStatus" value={filters.healthStatus} onChange={handleFilterChange}>
              <option value="">All statuses</option>
              <option value="healthy">Healthy</option>
              <option value="warning">Warning</option>
              <option value="stale">Stale</option>
              <option value="broken">Broken</option>
              <option value="unknown">Unknown</option>
              <option value="quarantined">Quarantined</option>
            </select>
          </label>
          <label>
            <span>Visibility</span>
            <select name="visibility" value={filters.visibility} onChange={handleFilterChange}>
              <option value="all">All listings</option>
              <option value="public">Not health-hidden</option>
              <option value="hidden">Health-hidden</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <label>
            <span>Source</span>
            <input
              name="source"
              value={filters.source}
              onChange={handleFilterChange}
              placeholder="ATS or importer"
            />
          </label>
          <label>
            <span>Employer</span>
            <input
              name="employer"
              value={filters.employer}
              onChange={handleFilterChange}
              placeholder="Employer or practice"
            />
          </label>
          <label>
            <span>Minimum score</span>
            <input
              name="minScore"
              type="number"
              min="0"
              max="100"
              value={filters.minScore}
              onChange={handleFilterChange}
              placeholder="0"
            />
          </label>
          <label>
            <span>Maximum score</span>
            <input
              name="maxScore"
              type="number"
              min="0"
              max="100"
              value={filters.maxScore}
              onChange={handleFilterChange}
              placeholder="100"
            />
          </label>
          <div className="job-health-filter-actions">
            <Button type="submit" variant="contained" className="glass-button">
              Apply filters
            </Button>
            <Button type="button" variant="outlined" className="glass-button" onClick={clearFilters}>
              Clear
            </Button>
          </div>
        </form>
      </Paper>

      <Paper className="job-health-list-panel">
        <div className="job-health-list-header">
          <Typography variant="h6" component="h3">
            Listings
          </Typography>
          <span>
            {loading ? "Loading..." : `${pageStart}-${pageEnd} of ${formatNumber(total)}`}
          </span>
        </div>

        {!loading && !jobs.length ? (
          <p className="job-health-empty">No listings match these filters.</p>
        ) : (
          <div className="job-health-table-wrap">
            <table className="job-health-table">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Health</th>
                  <th>Score</th>
                  <th>Verification</th>
                  <th>Last verified</th>
                  <th>Failure reason</th>
                  <th>Visibility</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <td>
                      <strong>{job.title || "Untitled listing"}</strong>
                      <span>{job.employer || "Unknown employer"}</span>
                      <span>{job.location || "Unknown location"}</span>
                      <span>{job.source || "Unknown source"}</span>
                    </td>
                    <td><StatusBadge value={job.healthStatus} /></td>
                    <td>
                      <strong className="job-health-score">{Math.round(job.healthScore)}</strong>
                      <span>{Math.round(job.confidenceScore)}% evidence confidence</span>
                    </td>
                    <td>
                      <StatusBadge value={job.verificationStatus} />
                      {job.lastHttpStatus ? <span>HTTP {job.lastHttpStatus}</span> : null}
                    </td>
                    <td>
                      {formatDate(job.lastVerifiedAt)}
                      <span>Next: {formatDate(job.nextVerificationAt)}</span>
                    </td>
                    <td>
                      {humanize(job.primaryReason, "No failure recorded")}
                      {job.verificationLastError ? (
                        <span className="job-health-error">{job.verificationLastError}</span>
                      ) : null}
                    </td>
                    <td>
                      {job.archived ? (
                        <StatusBadge value="archived" />
                      ) : job.hiddenAt ? (
                        <StatusBadge value="hidden" />
                      ) : (
                        <StatusBadge value={job.jobStatus} />
                      )}
                      {job.hiddenAt ? <span>Since {formatDate(job.hiddenAt)}</span> : null}
                    </td>
                    <td>
                      <Button
                        type="button"
                        size="small"
                        variant="outlined"
                        onClick={() => recheck(job.id)}
                        disabled={recheckingId === job.id || job.archived}
                      >
                        {recheckingId === job.id ? "Queueing..." : "Recheck"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="job-health-pagination">
          <Button
            type="button"
            variant="outlined"
            disabled={offset === 0 || loading}
            onClick={() => setOffset((value) => Math.max(0, value - PAGE_SIZE))}
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="outlined"
            disabled={offset + PAGE_SIZE >= total || loading}
            onClick={() => setOffset((value) => value + PAGE_SIZE)}
          >
            Next
          </Button>
        </div>
      </Paper>
    </Box>
  );
}
