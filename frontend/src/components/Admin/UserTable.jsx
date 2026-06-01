// frontend/src/components/Admin/UserTable.jsx
import React, { useMemo, useState } from "react";
import {
  Box, Button, Chip, FormControl, InputLabel, MenuItem, Select,
  Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Typography, Paper
} from "@mui/material";
import axiosInstance from "../../utils/api";

const FREE_DOMAINS = new Set([
  "gmail.com","yahoo.com","outlook.com","hotmail.com","aol.com",
  "icloud.com","proton.me","protonmail.com","live.com","me.com","msn.com"
]);

function formatName(u) {
  const ln = (u?.profile?.lastName ?? u?.last_name ?? u?.lastName ?? "").trim();
  const fn = (u?.profile?.firstName ?? u?.first_name ?? u?.firstName ?? "").trim();

  if (ln && fn) return `${ln}, ${fn}`;
  if (ln) return ln;
  if (fn) return fn;

  if (u?.displayName) return u.displayName;

  const email = (u?.email || "").trim();
  const local = email.includes("@") ? email.split("@")[0] : "";
  return local || "—";
}

function orgFrom(u) {
  const explicit = u?.company || u?.org;
  if (explicit) return explicit;
  const email = u?.email || "";
  const domain = email.split("@")[1]?.toLowerCase() || "";
  if (!domain) return "—";
  return FREE_DOMAINS.has(domain) ? "Personal" : domain;
}

function fmtDateFromUser(u) {
  const iso = u?.createdAt ?? u?.created_at ?? null;
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d) ? "—" : d.toLocaleDateString();
}

export default function UserTable({ users = [] }) {
  console.log('UserTable users[0]', users?.[0]);
  const [role, setRole] = useState("all");
  const [q, setQ] = useState("");
  const [resettingEmail, setResettingEmail] = useState("");
  const [clearedEmails, setClearedEmails] = useState(() => new Set());

  const resetFailedAttempts = async (email) => {
    if (!email) return;
    setResettingEmail(email);
    try {
      await axiosInstance.post("/users/reset-failed-attempts", { email });
      setClearedEmails((prev) => new Set(prev).add(email));
    } catch (err) {
      console.error("Failed to reset attempts:", err);
      alert("Failed to reset failed attempts.");
    } finally {
      setResettingEmail("");
    }
  };

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return users.filter(u => {
      if (role !== "all" && (u.role || "").toLowerCase() !== role) return false;
      if (!query) return true;
      const hay = [
        u.email,
        u.role,
        u?.profile?.firstName ?? u?.first_name,
        u?.profile?.lastName ?? u?.last_name,
        orgFrom(u)
      ].join(" ").toLowerCase();
      return hay.includes(query);
    });
  }, [users, role, q]);

  return (
    <Box>
      <Stack direction="row" spacing={2} sx={{ mb: 2 }} alignItems="center">
        <FormControl sx={{ minWidth: 160 }}>
          <InputLabel id="role-label">Role</InputLabel>
          <Select labelId="role-label" value={role} label="Role" onChange={(e) => setRole(e.target.value)}>
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="admin">Admin</MenuItem>
            <MenuItem value="recruiter">Recruiter</MenuItem>
            <MenuItem value="candidate">Candidate</MenuItem>
          </Select>
        </FormControl>
        <TextField
          placeholder="Search name, email, or org…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          sx={{ flex: 1, minWidth: 260 }}
        />
        <Typography variant="body2" sx={{ opacity: 0.75 }}>
          {filtered.length} result{filtered.length === 1 ? "" : "s"}
        </Typography>
      </Stack>

      <TableContainer component={Paper} elevation={0}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Org</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Created</TableCell>
              <TableCell align="right">Failed</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((u) => (
              <TableRow key={u.id || u.email}>
                <TableCell>{formatName(u)}</TableCell>
                <TableCell>{u.email || "—"}</TableCell>
                <TableCell>{orgFrom(u)}</TableCell>
                <TableCell sx={{ textTransform: "capitalize" }}>{u.role || "—"}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={!clearedEmails.has(u.email) && u.locked ? "Locked" : "Active"}
                    color={!clearedEmails.has(u.email) && u.locked ? "error" : "success"}
                    variant={!clearedEmails.has(u.email) && u.locked ? "filled" : "outlined"}
                  />
                </TableCell>
                <TableCell>{fmtDateFromUser(u)}</TableCell>
                <TableCell align="right">
                  {clearedEmails.has(u.email) ? 0 : (u.failedAttempts ?? u.failed_attempts ?? 0)}
                </TableCell>
                <TableCell align="right">
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={
                      !u.email ||
                      resettingEmail === u.email ||
                      (clearedEmails.has(u.email) ||
                        (!u.locked && (u.failedAttempts ?? u.failed_attempts ?? 0) === 0))
                    }
                    onClick={() => resetFailedAttempts(u.email)}
                  >
                    {resettingEmail === u.email ? "Resetting..." : "Reset Failed"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 6, opacity: 0.7 }}>
                  No users match your filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
