import React, { useEffect, useState } from "react";
import { fetchRecruiterApplications } from "../../utils/api";

export default function RecruiterApplications() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const applications = await fetchRecruiterApplications();
        if (mounted) setItems(applications);
      } catch (err) {
        if (mounted) setError(err?.message || "Failed to load applications.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="dashboard-container">
      <h1>Applications</h1>
      {loading && <p>Loading applications...</p>}
      {error && <p style={{ color: "#991b1b" }}>{error}</p>}
      {!loading && !error && items.length === 0 && <p>No applications yet.</p>}

      {items.length > 0 && (
        <table style={styles.table}>
          <thead>
            <tr>
              <th>Job</th>
              <th>Applicant</th>
              <th>Status</th>
              <th>Submitted</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const applicant = item.applicant || {};
              const job = item.jobs || item.job || {};
              const applicantName = [applicant.first_name, applicant.last_name]
                .filter(Boolean)
                .join(" ");
              return (
                <tr key={item.id}>
                  <td>{job.title || item.job_id}</td>
                  <td>{applicantName || applicant.email || item.user_id}</td>
                  <td>{item.status || "submitted"}</td>
                  <td>{item.created_at ? new Date(item.created_at).toLocaleString() : "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

const styles = {
  table: {
    width: "100%",
    borderCollapse: "collapse",
    textAlign: "left",
  },
};
