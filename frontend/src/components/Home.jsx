import React, { useEffect, useState } from "react";
import "../styles/Home.css";
import PricingTable from "./PricingTable";
import { useEffectiveAuth } from "./auth/useEffectiveAuth";
import { fetchJobsPage } from "../utils/api.supabase";

const ROLE_COVERAGE = [
  "Optometrists",
  "Opticians",
  "Techs",
  "Managers",
  "Front Office",
];
const JOB_COUNT_FORMATTER = new Intl.NumberFormat("en-US");

const Home = () => {
  const { user: effectiveUser } = useEffectiveAuth();
  const user = effectiveUser;
  const [activeJobCount, setActiveJobCount] = useState(null);

  useEffect(() => {
    let isActive = true;

    fetchJobsPage({ limit: 1 })
      .then(({ total }) => {
        if (isActive && Number.isFinite(total) && total > 0) {
          setActiveJobCount(total);
        }
      })
      .catch(() => {
        // Marketplace proof is optional. Omit it when live data cannot be verified.
      });

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <div className="home">
      <section className="marketplace-hero" aria-labelledby="home-marketplace-title">
        <h1 id="home-marketplace-title" className="hero-title">
          The job marketplace built exclusively for eye care.
        </h1>
        <p className="hero-copy">
          Practices reach an eye-care-focused audience with fewer irrelevant applicants.
          Candidates find relevant roles without sorting through a general job board.
        </p>
      </section>

      <div className="component-wrapper">
        <div className="role-strip" aria-label="Eye care roles">
          {ROLE_COVERAGE.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
        <section className="marketplace-proof" aria-label="Marketplace value">
          {activeJobCount ? (
            <div
              className="marketplace-proof-stat"
              aria-label={`${activeJobCount} active eye-care jobs`}
            >
              <strong>{JOB_COUNT_FORMATTER.format(activeJobCount)}</strong>
              <span>active eye-care jobs</span>
            </div>
          ) : null}
          <p>
            <strong>One focused marketplace.</strong> Eye-care-only roles help candidates
            find a better fit and help practices spend less time screening unrelated
            applicants.
          </p>
        </section>
        <section className="home-pricing-cards" aria-label="Candidate and recruiter options">
          <PricingTable user={user} />
        </section>
      </div>
    </div>
  );
};

export default Home;
