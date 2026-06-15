import React from "react";
import PricingTable from "./PricingTable";
import { useEffectiveAuth } from "./auth/useEffectiveAuth";
import "../styles/Home.css";

const PricingPage = () => {
  const { user } = useEffectiveAuth();
  const role = String(user?.userRole || user?.role || user?.accountRole || "").toLowerCase();
  const isKnownSingleRole = role === "candidate" || role === "recruiter";

  return (
    <main className="pricing-page">
      <section className="pricing-page-header" aria-labelledby="pricing-title">
        <p className="section-kicker">Pricing</p>
        <h1 id="pricing-title">Choose the right jobs.vision path.</h1>
        <p>
          Post a listing, browse opportunities, or upgrade job-seeker tools when they help.
        </p>
      </section>
      <PricingTable user={user} showAudienceToggle={!isKnownSingleRole} />
    </main>
  );
};

export default PricingPage;
