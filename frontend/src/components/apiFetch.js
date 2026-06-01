import { getNeonAccessToken } from "../utils/neonAuthClient";

// Lightweight fetch wrapper with the same API base and bearer auth as axios helpers.
function apiBaseUrl() {
  const raw = (process.env.REACT_APP_API_URL || "http://localhost:5000/api").replace(/\/+$/, "");
  return raw.endsWith("/api") ? raw : `${raw}/api`;
}

export default async function apiFetch(path, { method = "GET", body, headers } = {}) {
  const token = (await getNeonAccessToken()) || localStorage.getItem("token");

  const res = await fetch(`${apiBaseUrl()}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers || {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });

  const data = await res
    .clone()
    .json()
    .catch(() => null);

  if (!res.ok) {
    throw new Error(data?.error || res.statusText || "Request failed");
  }

  return { ok: true, data };
}
