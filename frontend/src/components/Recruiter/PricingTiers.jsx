import React from "react";

const PricingTiers = () => {
  return (
    <div style={styles.container}>
      <h2>Job Posting Plans</h2>
      <div style={styles.tiers}>
        <div style={styles.tier}>
          <h3>Staff</h3>
          <p>$79 first month</p>
          <p>$49 renewal</p>
        </div>
        <div style={styles.tier}>
          <h3>Manager</h3>
          <p>$149 first month</p>
          <p>$99 renewal</p>
        </div>
        <div style={styles.tier}>
          <h3>Doctor</h3>
          <p>$299 first month</p>
          <p>$149 renewal</p>
        </div>
      </div>
    </div>
  );
};

// ✅ Basic Styling
const styles = {
  container: { textAlign: "center", padding: "20px", color: "white" },
  tiers: { display: "flex", justifyContent: "center", gap: "20px" },
  tier: { background: "rgba(255, 255, 255, 0.2)", padding: "15px", borderRadius: "10px" },
};

export default PricingTiers;
