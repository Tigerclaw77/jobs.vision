import React, { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Box,
  Button,
  Chip,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  approveListingClaim,
  fetchListingClaims,
  rejectListingClaim,
  transferListingOwnership,
} from "../../utils/api";
import "./JobImportReview.css";

function statusLabel(status) {
  return String(status || "pending").replace(/_/g, " ");
}

export default function ListingClaims() {
  const [status, setStatus] = useState("pending");
  const [items, setItems] = useState([]);
  const [transferTargets, setTransferTargets] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function loadClaims(nextStatus = status) {
    setLoading(true);
    setMessage("");
    try {
      const rows = await fetchListingClaims({ status: nextStatus, limit: 50 });
      setItems(rows);
      setTransferTargets(
        rows.reduce((acc, item) => {
          acc[item.id] = item.claimed_by_user_id || item.requested_by_user_id || "";
          return acc;
        }, {})
      );
    } catch (error) {
      setMessage(error?.response?.data?.error || "Failed to load listing claims.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadClaims(status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function handleApprove(id) {
    setMessage("");
    try {
      await approveListingClaim(id);
      setMessage("Claim approved and listing ownership updated.");
      await loadClaims(status);
    } catch (error) {
      setMessage(error?.response?.data?.error || "Failed to approve claim.");
    }
  }

  async function handleReject(id) {
    const note = window.prompt("Optional rejection note", "");
    if (note === null) return;
    setMessage("");
    try {
      await rejectListingClaim(id, note);
      setMessage("Claim rejected.");
      await loadClaims(status);
    } catch (error) {
      setMessage(error?.response?.data?.error || "Failed to reject claim.");
    }
  }

  async function handleTransfer(item) {
    const userId = String(transferTargets[item.id] || "").trim();
    if (!userId) {
      setMessage("Enter a user ID before transferring ownership.");
      return;
    }
    setMessage("");
    try {
      await transferListingOwnership(item.job_id, userId);
      setMessage("Listing ownership transferred.");
      await loadClaims(status);
    } catch (error) {
      setMessage(error?.response?.data?.error || "Failed to transfer ownership.");
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
            Listing Claims
          </Typography>
          <Typography variant="body2">
            Review imported listing ownership requests and transfer listing management.
          </Typography>
        </Box>
        <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
          <Button
            component={RouterLink}
            to="/admin/job-imports"
            variant="outlined"
            className="glass-button"
          >
            Job Imports
          </Button>
          <Typography variant="body2">Status</Typography>
          <Select
            size="small"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="job-import-review__select"
          >
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="approved">Approved</MenuItem>
            <MenuItem value="rejected">Rejected</MenuItem>
            <MenuItem value="all">All</MenuItem>
          </Select>
        </Stack>
      </Stack>

      {message ? <div className="job-import-review__message">{message}</div> : null}

      <Typography variant="body2" className="job-import-review__count">
        {loading ? "Loading claims..." : `${items.length} claim request(s)`}
      </Typography>

      <Stack gap={2}>
        {items.map((item) => (
          <Paper className="job-import-review__item" key={item.id}>
            <Stack
              direction={{ xs: "column", md: "row" }}
              justifyContent="space-between"
              gap={1}
            >
              <Box>
                <Typography variant="h6">{item.job_title || "Untitled listing"}</Typography>
                <Typography variant="body2">
                  {item.job_company || "Unknown employer"}
                  {item.job_location ? ` - ${item.job_location}` : ""}
                </Typography>
                <Typography variant="body2">
                  Requested by {item.requester_email || item.requested_by_user_id}
                </Typography>
              </Box>
              <Stack direction="row" gap={1} flexWrap="wrap">
                <Chip label={statusLabel(item.status)} size="small" />
                <Chip label={`Listing: ${statusLabel(item.job_claim_status)}`} size="small" />
                <Chip label={statusLabel(item.listing_tier)} size="small" />
              </Stack>
            </Stack>

            <Stack gap={1} className="job-import-review__fields">
              {item.company_name || item.company_website || item.message ? (
                <Typography variant="body2">
                  {[item.company_name, item.company_website, item.message]
                    .filter(Boolean)
                    .join(" | ")}
                </Typography>
              ) : null}
              <TextField
                label="Transfer to User ID"
                value={transferTargets[item.id] || ""}
                onChange={(event) =>
                  setTransferTargets((current) => ({
                    ...current,
                    [item.id]: event.target.value,
                  }))
                }
                className="job-import-review__transfer-input"
              />
            </Stack>

            <Stack direction="row" gap={1} flexWrap="wrap" className="job-import-review__actions">
              <Button
                onClick={() => handleApprove(item.id)}
                variant="contained"
                disabled={item.status === "approved"}
              >
                Approve Claim
              </Button>
              <Button
                onClick={() => handleReject(item.id)}
                variant="outlined"
                color="error"
                disabled={item.status === "rejected"}
              >
                Reject Claim
              </Button>
              <Button onClick={() => handleTransfer(item)} variant="outlined">
                Transfer Ownership
              </Button>
            </Stack>
          </Paper>
        ))}
      </Stack>
    </Box>
  );
}
