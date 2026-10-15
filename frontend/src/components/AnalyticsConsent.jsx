import React, { useEffect, useState } from "react";
import {
  getAnalyticsConsent,
  setAnalyticsConsent,
  subscribeAnalyticsConsent,
  trackPageView,
} from "../marketingAnalytics";

export default function AnalyticsConsent() {
  const [choice, setChoice] = useState(getAnalyticsConsent);
  const [editing, setEditing] = useState(false);
  useEffect(() => subscribeAnalyticsConsent(setChoice), []);

  const choose = (next) => {
    setAnalyticsConsent(next);
    setEditing(false);
    if (next === "granted") trackPageView(window.location.pathname);
  };

  return (
    <aside aria-label="Analytics preferences" style={{
      position: "fixed", bottom: 12, left: 12, zIndex: 10000,
      maxWidth: 410, padding: 12, borderRadius: 8,
      background: "#111827", color: "#fff", boxShadow: "0 2px 14px #0008",
      fontSize: 14,
    }}>
      {choice === "unset" || editing ? (
        <>
          <p style={{ margin: "0 0 8px" }}>
            May we use privacy-safe analytics to improve jobs.vision? Your choice does not affect job search.
          </p>
          <button type="button" onClick={() => choose("granted")}>Accept analytics</button>{" "}
          <button type="button" onClick={() => choose("denied")}>Decline analytics</button>
        </>
      ) : (
        <button type="button" onClick={() => setEditing(true)}>
          Analytics preferences: {choice === "granted" ? "on" : "off"}
        </button>
      )}
    </aside>
  );
}
