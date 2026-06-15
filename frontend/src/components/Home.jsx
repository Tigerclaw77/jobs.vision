import React from "react";
import "../styles/Home.css";
import PricingTable from "./PricingTable";
import { useEffectiveAuth } from "./auth/useEffectiveAuth";

const ROLE_COVERAGE = [
  "Optometrists",
  "Opticians",
  "Ophthalmic Technicians",
  "Optical Managers",
  "Front Office",
  "Practice Leadership",
];

const Home = () => {
  const { user: effectiveUser } = useEffectiveAuth();
  const user = effectiveUser;

  return (
    <div className="home">
      <section className="marketplace-hero" aria-labelledby="home-marketplace-title">
        <h1 id="home-marketplace-title" className="hero-title">
          Eye care jobs, without the noise.
        </h1>
        <p className="hero-copy">
          Browse focused optometry and optical openings, or post a role for the right eye care team.
        </p>
      </section>

      <div className="component-wrapper">
        <div className="role-strip" aria-label="Eye care roles">
          {ROLE_COVERAGE.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
        <section className="home-pricing-cards" aria-label="Find a job or post a job">
          <PricingTable user={user} showAudienceToggle />
        </section>
      </div>
    </div>
  );
};

export default Home;
