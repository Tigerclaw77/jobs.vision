import React from "react";
import "../styles/Home.css";
import PricingTable from "./PricingTable";
import { useEffectiveAuth } from "./auth/useEffectiveAuth";

const ROLE_COVERAGE = [
  "Optometrists",
  "Opticians",
  "Techs",
  "Managers",
  "Front Office",
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
        <p className="hero-copy">Find jobs. Hire faster.</p>
      </section>

      <div className="component-wrapper">
        <div className="role-strip" aria-label="Eye care roles">
          {ROLE_COVERAGE.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
        <section className="home-pricing-cards" aria-label="Candidate and recruiter options">
          <PricingTable user={user} />
        </section>
      </div>
    </div>
  );
};

export default Home;
