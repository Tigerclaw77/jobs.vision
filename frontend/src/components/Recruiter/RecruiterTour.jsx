import React, { useState } from "react";

const RecruiterTour = () => {
  const [step, setStep] = useState(1);

  return (
    <div style={styles.container}>
      <h2>Welcome to Job Posting</h2>
      {step === 1 && <p>Step 1: Register & Verify Your Email</p>}
      {step === 2 && <p>Step 2: Create a Job Posting</p>}
      {step === 3 && <p>Step 3: Fill Out Your Job Posting Details</p>}
      {step === 4 && <p>Step 4: Pay & Publish</p>}

      <button onClick={() => setStep(step + 1)} disabled={step === 4}>
        Next
      </button>
    </div>
  );
};

// ✅ Simple Styling
const styles = {
  container: { textAlign: "center", padding: "20px", color: "white" },
};

export default RecruiterTour;
