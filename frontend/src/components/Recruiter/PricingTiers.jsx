import React from "react";

const PricingTiers = () => {
  return (
    <div style={styles.container}>
      <h2>Job Posting Plans</h2>
      <div style={styles.tiers}>
        <div style={styles.tier}>
          <h3>Basic</h3>
          <p>$50 per job (30 days)</p>
          <p>Renewal: $25 every 30 days</p>
        </div>
        <div style={styles.tier}>
          <h3>Boost</h3>
          <p>Increase job visibility</p>
          <p>Price varies based on location</p>
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
