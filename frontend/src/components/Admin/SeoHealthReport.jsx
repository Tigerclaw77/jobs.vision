import React, { useEffect, useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import RefreshIcon from "@mui/icons-material/Refresh";
import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import { fetchSeoHealthReport } from "../../utils/api";
import "./SeoHealthReport.css";

const emptyReport = {
  counts: {},
  samples: {},
  thresholds: {},
};

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function formatPercent(value, total) {
  const denominator = Number(total || 0);
  if (!denominator) return "0%";
  return `${Math.round((Number(value || 0) / denominator) * 100)}%`;
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function MetricCard({ label, value, helper, tone = "neutral" }) {
  return (
    <Paper className={`seo-health-metric seo-health-metric-${tone}`}>
      <Typography variant="body2" className="seo-health-metric-label">
        {label}
      </Typography>
      <Typography variant="h4" className="seo-health-metric-value">
        {formatNumber(value)}
      </Typography>
      {helper ? (
        <Typography variant="caption" className="seo-health-metric-helper">
          {helper}
        </Typography>
      ) : null}
    </Paper>
  );
}

function SampleTable({ title, rows = [], empty = "No jobs flagged." }) {
  return (
    <Paper className="seo-health-section">
      <Typography variant="h6" component="h3">
        {title}
      </Typography>
      {!rows.length ? (
        <p className="seo-health-empty">{empty}</p>
      ) : (
        <div className="seo-health-table-wrap">
          <table className="seo-health-table">
            <thead>
              <tr>
                <th>Job</th>
                <th>Employer</th>
                <th>Location</th>
                <th>Description</th>
                <th>Matches</th>
                <th>Destination</th>
                <th>Updated</th>
                <th>Page</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.title || "Untitled job"}</strong>
                    <span>{row.id}</span>
                  </td>
                  <td>{row.employer || <span className="seo-health-muted">Missing</span>}</td>
                  <td>{row.location || <span className="seo-health-muted">Missing</span>}</td>
                  <td>{formatNumber(row.descriptionLength)} chars</td>
                  <td>
                    {row.artifactMatches?.length ? (
                      row.artifactMatches.join(", ")
                    ) : (
                      <span className="seo-health-muted">None</span>
                    )}
                  </td>
                  <td>
                    {row.applyDestination ? (
                      <span className="seo-health-destination">{row.applyDestination}</span>
                    ) : (
                      <span className="seo-health-muted">Missing</span>
                    )}
                  </td>
                  <td>{formatDate(row.updatedAt) || <span className="seo-health-muted">Unknown</span>}</td>
                  <td>
                    {row.path ? (
                      <Button
                        component={RouterLink}
                        to={row.path}
                        size="small"
                        variant="outlined"
                        endIcon={<OpenInNewIcon fontSize="inherit" />}
                      >
                        Open
                      </Button>
                    ) : (
                      <span className="seo-health-muted">None</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Paper>
  );
}

export default function SeoHealthReport() {
  const [report, setReport] = useState(emptyReport);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function loadReport() {
    setLoading(true);
    setMessage("");
    try {
      const data = await fetchSeoHealthReport();
      setReport(data || emptyReport);
    } catch (error) {
      setMessage(error?.response?.data?.error || "Failed to load SEO health report.");
      setReport(emptyReport);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setMessage("");
      try {
        const data = await fetchSeoHealthReport();
        if (mounted) setReport(data || emptyReport);
      } catch (error) {
        if (mounted) {
          setMessage(error?.response?.data?.error || "Failed to load SEO health report.");
          setReport(emptyReport);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const metrics = useMemo(() => {
    const counts = report.counts || {};
    const total = counts.activePublicJobs || 0;
    return [
      ["Active Public Jobs", counts.activePublicJobs, "Public API visible", "good"],
      ["Jobs in Sitemap", counts.jobsInSitemap, "Crawler inventory", "good"],
      ["Non-200 API Jobs", counts.apiNon200, "Sitemap/API mismatch", counts.apiNon200 ? "danger" : "good"],
      [
        "Under 100 Chars",
        counts.descriptionsUnder100,
        `${formatPercent(counts.descriptionsUnder100, total)} of public jobs`,
        counts.descriptionsUnder100 ? "warning" : "good",
      ],
      [
        "Missing Descriptions",
        counts.missingDescriptions,
        `${formatPercent(counts.missingDescriptions, total)} of public jobs`,
        counts.missingDescriptions ? "danger" : "good",
      ],
      [
        "Scraper Artifacts",
        counts.scraperArtifactDescriptions,
        `${formatPercent(counts.scraperArtifactDescriptions, total)} of public jobs`,
        counts.scraperArtifactDescriptions ? "warning" : "good",
      ],
      [
        "Missing Salary",
        counts.missingSalary,
        `${formatPercent(counts.missingSalary, total)} of public jobs`,
        counts.missingSalary ? "warning" : "good",
      ],
      [
        "Missing Employer",
        counts.missingEmployer,
        `${formatPercent(counts.missingEmployer, total)} of public jobs`,
        counts.missingEmployer ? "danger" : "good",
      ],
      [
        "Missing Location",
        counts.missingLocation,
        `${formatPercent(counts.missingLocation, total)} of public jobs`,
        counts.missingLocation ? "danger" : "good",
      ],
      [
        "Missing Apply Destination",
        counts.missingApplyDestination,
        `${formatPercent(counts.missingApplyDestination, total)} of public jobs`,
        counts.missingApplyDestination ? "danger" : "good",
      ],
    ];
  }, [report.counts]);

  const generatedAt = formatDate(report.generatedAt);
  const samples = report.samples || {};

  return (
    <Box className="seo-health-page text-on-dim" sx={{ px: { xs: 2, md: 3 }, py: 2 }}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        alignItems={{ xs: "flex-start", md: "center" }}
        justifyContent="space-between"
        gap={2}
        sx={{ mb: 2 }}
      >
        <div>
          <Typography variant="h4" component="h2">
            SEO Health
          </Typography>
          <Typography variant="body2" className="seo-health-subtitle">
            {loading ? "Loading..." : generatedAt ? `Generated ${generatedAt}` : "Report unavailable"}
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
            onClick={loadReport}
            disabled={loading}
          >
            Refresh
          </Button>
        </Stack>
      </Stack>

      {message ? <div className="seo-health-message">{message}</div> : null}

      <div className="seo-health-metrics">
        {metrics.map(([label, value, helper, tone]) => (
          <MetricCard key={label} label={label} value={value} helper={helper} tone={tone} />
        ))}
      </div>

      <div className="seo-health-sections">
        <SampleTable title="Missing Descriptions" rows={samples.missingDescriptions || []} />
        <SampleTable title="Descriptions Under 100 Characters" rows={samples.shortDescriptions || []} />
        <SampleTable title="Scraper Artifact Matches" rows={samples.scraperArtifacts || []} />
        <SampleTable title="Missing Salary" rows={samples.missingSalary || []} />
        <SampleTable title="Missing Employer" rows={samples.missingEmployer || []} />
        <SampleTable title="Missing Location" rows={samples.missingLocation || []} />
        <SampleTable title="Missing Apply Destination" rows={samples.missingApplyDestination || []} />
        <SampleTable title="API Non-200" rows={samples.apiNon200 || []} />
      </div>
    </Box>
  );
}
