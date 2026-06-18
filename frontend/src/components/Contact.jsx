import React from "react";
import "../styles/legal.css";

export default function Contact() {
  return (
    <main className="legal-page">
      <section className="legal-card legal-card-compact">
        <p className="legal-eyebrow">jobs.vision</p>
        <h1>Contact</h1>
        <p>
          For account, billing, listing, privacy, or support questions, email{" "}
          <a href="mailto:support@jobs.vision">support@jobs.vision</a>.
        </p>
      </section>
    </main>
  );
}
