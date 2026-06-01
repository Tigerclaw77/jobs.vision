import React, { useEffect, useMemo, useState } from "react";
import {
  Box, Paper, Typography, TextField, InputAdornment,
  Select, MenuItem, FormControl, InputLabel, Chip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  CircularProgress, Stack
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";

function apiBaseUrl() {
  const raw = (process.env.REACT_APP_API_URL || "http://localhost:5000/api").replace(/\/+$/, "");
  return raw.endsWith("/api") ? raw : `${raw}/api`;
}

const API_BASE = apiBaseUrl();

// Normalize token retrieval
function getAuthToken() {
  const rawUser = localStorage.getItem("user") || sessionStorage.getItem("user");
  if (rawUser) {
    try {
      const parsed = JSON.parse(rawUser);
      if (parsed?.token) return parsed.token;
      if (parsed?.user?.token) return parsed.user.token;
    } catch {}
  }
  return localStorage.getItem("token") ||
         sessionStorage.getItem("token") || "";
}

// Normalize server response into an array
function toArray(json) {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.items)) return json.items;
  if (Array.isArray(json?.users)) return json.users;
  return [];
}

// ---------- helpers (defensive) ----------
const FREE_DOMAINS = new Set([
  "gmail.com","yahoo.com","outlook.com","hotmail.com","aol.com",
  "icloud.com","proton.me","protonmail.com","live.com","me.com","msn.com"
]);

const getKey = (u) => u._id || u.id || u.email || Math.random().toString(36).slice(2);
const getEmail = (u) => u.email || "—";

function getName(u) {
  const ln =
    (u?.profile?.lastName ??
     u?.last_name ??
     u?.lastName ??
     "").trim();
  const fn =
    (u?.profile?.firstName ??
     u?.first_name ??
     u?.firstName ??
     "").trim();

  if (ln && fn) return `${ln}, ${fn}`;
  if (ln) return ln;
  if (fn) return fn;

  // use API-provided displayName if available
  if (u?.displayName) return u.displayName;

  // final fallback: email local-part
  const email = (u?.email || "").trim();
  const local = email.includes("@") ? email.split("@")[0] : "";
  return local || "—";
}


const getRole = (u) =>
  (u.userRole || u.role || u.profile?.role || "unknown").toString().toLowerCase();

const getFailed = (u) =>
  Number.isFinite(u.failedLoginAttempts) ? u.failedLoginAttempts :
  Number.isFinite(u.failedAttempts) ? u.failedAttempts :
  Number.isFinite(u.failed_attempts) ? u.failed_attempts : 0;

const getLocked = (u) => !!(u.locked || u.isLocked || u.lockedAt || u.locked_at);

function getOrg(u) {
  const explicit = u.company || u.org;
  if (explicit) return explicit;
  const domain = (getEmail(u).split("@")[1] || "").toLowerCase();
  if (!domain) return "—";
  return FREE_DOMAINS.has(domain) ? "Personal" : domain;
}

function getCreated(u) {
  const iso = u.createdAt ?? u.created_at ?? null;
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d) ? "—" : d.toLocaleDateString();
}
// ----------------------------------------

export default function Users() {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("all");

  const loadUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const token = getAuthToken();
      if (!token) throw new Error("No token found. Please log in.");

      const url = `${API_BASE}/users`;
      // If you want server-side filters later:
      // if (role !== "all") url.searchParams.set("role", role);
      // if (query.trim()) url.searchParams.set("search", query.trim());

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Request failed (${res.status})`);
      }

      const json = await res.json();
      setUsers(toArray(json));
    } catch (err) {
      console.error("Error fetching users:", err);
      setError("Failed to fetch users.");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); /* eslint-disable-next-line */ }, []);

  const roleCounts = useMemo(() => {
    const acc = { admin: 0, recruiter: 0, candidate: 0, unknown: 0 };
    for (const u of users) {
      const r = getRole(u);
      if (acc[r] !== undefined) acc[r] += 1; else acc.unknown += 1;
    }
    return acc;
  }, [users]);

  const filtered = useMemo(() => {
    let out = users;
    if (role !== "all") out = out.filter((u) => getRole(u) === role);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      out = out.filter((u) => {
        const name = getName(u).toLowerCase();
        const em = getEmail(u).toLowerCase();
        const org = getOrg(u).toLowerCase();
        return name.includes(q) || em.includes(q) || org.includes(q);
      });
    }
    return out;
  }, [users, role, query]);

  return (
    <Box className="users-page text-on-dim" sx={{ px: { xs: 2, md: 3 }, py: 2 }}>
      <Typography variant="h4" component="h2" gutterBottom>
        Registered Users
      </Typography>

      {/* Compact readable stats (no Grid) */}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 2 }}>
        <Chip label={`Admins: ${roleCounts.admin}`} />
        <Chip label={`Recruiters: ${roleCounts.recruiter}`} />
        <Chip label={`Candidates: ${roleCounts.candidate}`} />
        {/* Hide unknown if zero */}
        {roleCounts.unknown > 0 && <Chip label={`Unknown: ${roleCounts.unknown}`} />}
      </Stack>

      <Paper elevation={3} sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "stretch", sm: "center" }}>
          <TextField
            size="small"
            label="Search name, email, or org"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start"><SearchIcon /></InputAdornment>
              ),
            }}
            sx={{ minWidth: 260 }}
          />
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="role-filter-label">Filter by role</InputLabel>
            <Select
              labelId="role-filter-label"
              label="Filter by role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="admin">Admin</MenuItem>
              <MenuItem value="recruiter">Recruiter</MenuItem>
              <MenuItem value="candidate">Candidate</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      <Paper elevation={3} sx={{ p: { xs: 1, sm: 2 } }}>
        {loading ? (
          <Box sx={{ p: 4, display: "flex", justifyContent: "center" }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Typography color="error" sx={{ p: 2 }}>{error}</Typography>
        ) : filtered.length === 0 ? (
          <Typography sx={{ p: 2 }}>No users found.</Typography>
        ) : (
          <TableContainer>
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
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((u) => (
                  <TableRow key={getKey(u)}>
                    <TableCell>{getName(u)}</TableCell>
                    <TableCell>{getEmail(u)}</TableCell>
                    <TableCell>{getOrg(u)}</TableCell>
                    <TableCell sx={{ textTransform: "capitalize" }}>{getRole(u)}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={getLocked(u) ? "Locked" : "Active"}
                        color={getLocked(u) ? "error" : "success"}
                        variant={getLocked(u) ? "filled" : "outlined"}
                      />
                    </TableCell>
                    <TableCell>{getCreated(u)}</TableCell>
                    <TableCell align="right">{getFailed(u)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Box>
  );
}
