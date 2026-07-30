import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

function apiBaseUrl() {
  const raw = (process.env.REACT_APP_API_URL || "http://localhost:5000/api").replace(/\/+$/, "");
  return raw.endsWith("/api") ? raw : `${raw}/api`;
}

export default function RecruiterActivationGate({ children }) {
  const {
    accessToken,
    role,
    session,
    refreshAuth,
  } = useAuth();
  const normalizedRole = String(role || "").toLowerCase();
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (normalizedRole !== "candidate" || !accessToken) return undefined;

    let cancelled = false;
    setError("");

    async function activate() {
      try {
        const response = await fetch(`${apiBaseUrl()}/auth/activate-recruiter`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        const body = await response.json().catch(() => null);
        if (!response.ok || body?.role !== "recruiter") {
          throw new Error(body?.error || "Unable to prepare your account for job posting.");
        }

        await refreshAuth(session);
      } catch (activationError) {
        if (!cancelled) {
          setError(
            activationError?.message ||
              "Unable to prepare your account for job posting."
          );
        }
      }
    }

    activate();
    return () => {
      cancelled = true;
    };
  }, [accessToken, attempt, normalizedRole, refreshAuth, session]);

  if (normalizedRole === "recruiter" || normalizedRole === "admin") {
    return children;
  }

  if (error) {
    return (
      <div className="dashboard-container" role="alert">
        <h1>We couldn&apos;t start your job listing</h1>
        <p>{error}</p>
        <button type="button" onClick={() => setAttempt((value) => value + 1)}>
          Try Again
        </button>
        <p>
          <Link to="/jobs">Return to jobs</Link>
        </p>
      </div>
    );
  }

  return (
    <div
      className="dashboard-container"
      role="status"
      aria-live="polite"
    >
      <h1>Preparing your free recruiter account…</h1>
      <p>Your selected listing and pricing are being kept for the next step.</p>
    </div>
  );
}
