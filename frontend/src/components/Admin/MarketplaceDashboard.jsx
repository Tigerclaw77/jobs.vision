import React, { useEffect, useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import { fetchMarketplaceDashboard } from "../../utils/api";
import "./MarketplaceDashboard.css";

const emptyData = {
  inventory: {},
  discovery: { byAts: [], byEmployer: [], byState: [], employerOutreach: [] },
  claiming: {},
  listingReports: { pendingItems: [] },
  opportunityTypes: {},
};

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function MetricCard({ label, value, helper }) {
  return (
    <Paper className="marketplace-metric-card">
      <Typography variant="body2" className="marketplace-metric-label">
        {label}
      </Typography>
      <Typography variant="h4" className="marketplace-metric-value">
        {value}
      </Typography>
      {helper ? (
        <Typography variant="caption" className="marketplace-metric-helper">
          {helper}
        </Typography>
      ) : null}
    </Paper>
  );
}

function Section({ title, children, action }) {
  return (
    <Paper className="marketplace-section">
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
        <Typography variant="h6" component="h3">
          {title}
        </Typography>
        {action}
      </Stack>
      {children}
    </Paper>
  );
}

function CountList({ rows = [], empty = "No data yet." }) {
  if (!rows.length) {
    return <p className="marketplace-empty">{empty}</p>;
  }

  return (
    <div className="marketplace-count-list">
      {rows.map((row) => (
        <div className="marketplace-count-row" key={row.label}>
          <span>{String(row.label || "Unknown").replace(/_/g, " ")}</span>
          <strong>{formatNumber(row.count)}</strong>
        </div>
      ))}
    </div>
  );
}

function OutreachTable({ rows = [] }) {
  if (!rows.length) {
    return <p className="marketplace-empty">No employer outreach records yet.</p>;
  }

  return (
    <div className="marketplace-table-wrap">
      <table className="marketplace-table">
        <thead>
          <tr>
            <th>Employer</th>
            <th>Imported</th>
            <th>Published</th>
            <th>Claimed</th>
            <th>Claim Rate</th>
            <th>Outreach</th>
            <th>Contact</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.employer_name || row.website || row.contact_email}>
              <td>
                <strong>{row.employer_name || "Unknown employer"}</strong>
                {row.website ? (
                  <a href={row.website} target="_blank" rel="noreferrer">
                    Website
                  </a>
                ) : null}
                {row.careers_url ? (
                  <a href={row.careers_url} target="_blank" rel="noreferrer">
                    Careers
                  </a>
                ) : null}
              </td>
              <td>{formatNumber(row.imported_jobs)}</td>
              <td>{formatNumber(row.published_imported_jobs)}</td>
              <td>{formatNumber(row.claimed_jobs)}</td>
              <td>{formatNumber(row.claim_rate)}%</td>
              <td>{String(row.contact_status || "not_contacted").replace(/_/g, " ")}</td>
              <td>
                {row.contact_email ? (
                  <a href={`mailto:${row.contact_email}`}>{row.contact_email}</a>
                ) : (
                  <span className="marketplace-muted">Not set</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ListingReportList({ rows = [] }) {
  if (!rows.length) {
    return <p className="marketplace-empty">No pending listing reports.</p>;
  }

  return (
    <div className="marketplace-report-list">
      {rows.map((row) => (
        <div className="marketplace-report-row" key={row.id}>
          <div>
            <strong>{row.title || "Untitled listing"}</strong>
            <span>{row.display_company || "Unknown employer"} - {row.location || "Unknown location"}</span>
          </div>
          <span>{String(row.reason || "other").replace(/_/g, " ")}</span>
        </div>
      ))}
    </div>
  );
}

export default function MarketplaceDashboard() {
  const [data, setData] = useState(emptyData);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setMessage("");
      try {
        const dashboard = await fetchMarketplaceDashboard();
        if (mounted) setData(dashboard || emptyData);
      } catch (error) {
        if (mounted) {
          setMessage(error?.response?.data?.error || "Failed to load marketplace dashboard.");
          setData(emptyData);
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

  const inventoryMetrics = useMemo(
    () => [
      ["Active Jobs", data.inventory?.activeJobs],
      ["Evergreen Jobs", data.inventory?.evergreenJobs],
      ["Imported Jobs", data.inventory?.importedJobs],
      ["Claimed Jobs", data.inventory?.claimedJobs],
      ["Pending Claims", data.inventory?.pendingClaims],
      ["Pending Reports", data.inventory?.pendingListingReports],
      ["Featured Jobs", data.inventory?.featuredJobs],
      ["Sponsor Jobs", data.inventory?.sponsorJobs],
    ],
    [data.inventory]
  );

  const claimingMetrics = useMemo(
    () => [
      ["Claims Pending", data.claiming?.pending],
      ["Claims Approved", data.claiming?.approved],
      ["Claims Rejected", data.claiming?.rejected],
      [
        "Imported-to-Claimed",
        `${formatNumber(data.claiming?.importedToClaimedConversionPercent)}%`,
        `${formatNumber(data.claiming?.importedClaimed)} of ${formatNumber(
          data.claiming?.importedTotal
        )} imported listings`,
      ],
    ],
    [data.claiming]
  );

  const listingReportMetrics = useMemo(
    () => [
      ["Pending", data.listingReports?.pending],
      ["Reviewed", data.listingReports?.reviewed],
      ["Dismissed", data.listingReports?.dismissed],
    ],
    [data.listingReports]
  );

  const opportunityMetrics = useMemo(
    () => [
      ["Jobs", data.opportunityTypes?.jobs],
      ["Practice Sales", data.opportunityTypes?.practiceSales],
      ["Partnerships", data.opportunityTypes?.partnerships],
      ["Leases", data.opportunityTypes?.leases],
    ],
    [data.opportunityTypes]
  );

  return (
    <Box className="marketplace-dashboard text-on-dim">
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", md: "center" }}
        gap={2}
        className="marketplace-dashboard-header"
      >
        <Box>
          <Typography variant="h4" component="h2">
            Marketplace Dashboard
          </Typography>
          <Typography variant="body2">
            Operational view of imported inventory, claims, listing tiers, and opportunity mix.
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
            component={RouterLink}
            to="/admin/listing-claims"
            variant="outlined"
            className="glass-button"
          >
            Listing Claims
          </Button>
        </Stack>
      </Stack>

      {message ? <div className="marketplace-message">{message}</div> : null}

      <Typography variant="body2" className="marketplace-loading">
        {loading ? "Loading marketplace metrics..." : "Live operational snapshot"}
      </Typography>

      <Section title="Inventory">
        <div className="marketplace-metric-grid">
          {inventoryMetrics.map(([label, value]) => (
            <MetricCard key={label} label={label} value={formatNumber(value)} />
          ))}
        </div>
      </Section>

      <Section
        title="Discovery"
        action={
          <MetricCard
            label="Imported This Week"
            value={formatNumber(data.discovery?.importedThisWeek)}
          />
        }
      >
        <div className="marketplace-three-col">
          <div>
            <h4>Jobs by ATS</h4>
            <CountList rows={data.discovery?.byAts || []} />
          </div>
          <div>
            <h4>Jobs by Employer</h4>
            <CountList rows={data.discovery?.byEmployer || []} />
          </div>
          <div>
            <h4>Jobs by State</h4>
            <CountList rows={data.discovery?.byState || []} />
          </div>
        </div>
      </Section>

      <Section title="Claiming">
        <div className="marketplace-metric-grid">
          {claimingMetrics.map(([label, value, helper]) => {
            const displayValue = typeof value === "string" ? value : formatNumber(value);
            return (
              <MetricCard key={label} label={label} value={displayValue} helper={helper} />
            );
          })}
        </div>
      </Section>

      <Section title="Listing Issue Reports">
        <div className="marketplace-metric-grid">
          {listingReportMetrics.map(([label, value]) => (
            <MetricCard key={label} label={label} value={formatNumber(value)} />
          ))}
        </div>
        <ListingReportList rows={data.listingReports?.pendingItems || []} />
      </Section>

      <Section title="Employer Outreach">
        <OutreachTable rows={data.discovery?.employerOutreach || []} />
      </Section>

      <Section title="Opportunity Types">
        <div className="marketplace-metric-grid">
          {opportunityMetrics.map(([label, value]) => (
            <MetricCard key={label} label={label} value={formatNumber(value)} />
          ))}
        </div>
      </Section>
    </Box>
  );
}
