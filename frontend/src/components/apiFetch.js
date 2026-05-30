// Lightweight fetch wrapper just for local dev.
// Uses CRA-style env var:
const BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";

export default async function apiFetch(path, { method = "GET", body, headers } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
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
