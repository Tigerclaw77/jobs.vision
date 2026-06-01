import React, { useCallback, useEffect, useState } from "react";
import {
  fetchRecruiterDomains,
  requestRecruiterDomainVerification,
} from "../../utils/api";

export default function RecruiterDomains() {
  const params = new URLSearchParams(window.location.search);
  const verifiedDomain = params.get("verified");
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ domain: "", sendTo: "" });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(
    verifiedDomain ? `${verifiedDomain} was verified successfully.` : ""
  );
  const [error, setError] = useState("");

  const loadDomains = useCallback(async () => {
    setError("");
    try {
      const domains = await fetchRecruiterDomains();
      setItems(domains);
    } catch (err) {
      setError(err?.message || "Failed to load domains.");
    }
  }, []);

  useEffect(() => {
    loadDomains();
  }, [loadDomains]);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");
    try {
      const result = await requestRecruiterDomainVerification(form);
      setMessage(
        result.emailSent
          ? `Verification email sent to ${form.sendTo}.`
          : "Verification request saved, but email is not configured."
      );
      setForm({ domain: "", sendTo: "" });
      await loadDomains();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "Failed to request verification.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-container">
      <h1>Domain Verification</h1>

      <form onSubmit={submit} style={styles.form}>
        <label>
          Domain
          <input
            value={form.domain}
            onChange={(e) => setForm((p) => ({ ...p, domain: e.target.value }))}
            placeholder="example.com"
            required
          />
        </label>
        <label>
          Work Email
          <input
            type="email"
            value={form.sendTo}
            onChange={(e) => setForm((p) => ({ ...p, sendTo: e.target.value }))}
            placeholder="you@example.com"
            required
          />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? "Sending..." : "Request Verification"}
        </button>
      </form>

      {message && <p style={styles.success}>{message}</p>}
      {error && <p style={styles.error}>{error}</p>}

      <h2>Verification Status</h2>
      {items.length === 0 ? (
        <p>No domains requested yet.</p>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr>
              <th>Domain</th>
              <th>Status</th>
              <th>Verified At</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.domain}</td>
                <td>{item.status}</td>
                <td>{item.verified_at ? new Date(item.verified_at).toLocaleString() : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const styles = {
  form: {
    display: "grid",
    gap: 12,
    maxWidth: 520,
    marginBottom: 18,
  },
  success: { color: "#065f46" },
  error: { color: "#991b1b" },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    textAlign: "left",
  },
};
