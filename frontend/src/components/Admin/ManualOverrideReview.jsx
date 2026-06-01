import React, { useEffect, useState } from "react";
import { decideManualOverride, fetchManualOverrides } from "../../utils/api";

const STATUSES = ["pending", "approved", "denied"];

export default function ManualOverrideReview() {
  const [status, setStatus] = useState("pending");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const rows = await fetchManualOverrides(status);
      setItems(rows);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "Failed to load manual overrides.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const decide = async (id, decision) => {
    setActingId(id);
    setMessage("");
    setError("");
    try {
      const result = await decideManualOverride(id, decision);
      setMessage(
        result.emailSent
          ? `Request ${decision === "approve" ? "approved" : "denied"} and email sent.`
          : `Request ${decision === "approve" ? "approved" : "denied"}. Decision email was not sent.`
      );
      await load();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "Failed to update override request.");
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="dashboard-container">
      <h1>Manual Override Review</h1>

      <div style={styles.filters}>
        {STATUSES.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setStatus(item)}
            disabled={status === item}
          >
            {item[0].toUpperCase() + item.slice(1)}
          </button>
        ))}
      </div>

      {message && <p style={styles.success}>{message}</p>}
      {error && <p style={styles.error}>{error}</p>}
      {loading && <p>Loading requests...</p>}
      {!loading && !error && items.length === 0 && <p>No {status} requests.</p>}

      {items.length > 0 && (
        <table style={styles.table}>
          <thead>
            <tr>
              <th>Requester</th>
              <th>Company</th>
              <th>Reason</th>
              <th>Proof</th>
              <th>Submitted</th>
              <th>Decision</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <strong>{item.name || "-"}</strong>
                  <br />
                  {item.email}
                  {item.role ? (
                    <>
                      <br />
                      {item.role}
                    </>
                  ) : null}
                </td>
                <td>
                  {item.company || "-"}
                  {item.company_website ? (
                    <>
                      <br />
                      <a href={item.company_website} target="_blank" rel="noreferrer">
                        Website
                      </a>
                    </>
                  ) : null}
                </td>
                <td>{item.justification || "-"}</td>
                <td>
                  {Array.isArray(item.proof_urls) && item.proof_urls.length > 0
                    ? item.proof_urls.map((url, index) => (
                        <div key={url}>
                          <a href={url} target="_blank" rel="noreferrer">
                            Proof {index + 1}
                          </a>
                        </div>
                      ))
                    : "-"}
                </td>
                <td>{item.created_at ? new Date(item.created_at).toLocaleString() : "-"}</td>
                <td>
                  {status === "pending" ? (
                    <div style={styles.actions}>
                      <button
                        type="button"
                        onClick={() => decide(item.id, "approve")}
                        disabled={actingId === item.id}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => decide(item.id, "deny")}
                        disabled={actingId === item.id}
                      >
                        Deny
                      </button>
                    </div>
                  ) : (
                    item.reviewed_at ? new Date(item.reviewed_at).toLocaleString() : item.status
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const styles = {
  filters: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 16,
  },
  success: { color: "#065f46" },
  error: { color: "#991b1b" },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    textAlign: "left",
  },
  actions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
};
