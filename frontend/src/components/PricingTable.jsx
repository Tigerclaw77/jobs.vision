import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/PricingTable.css";

const RECRUITER_PLANS = [
  {
    key: "staff",
    name: "Staff",
    headline: "Solve churn without overspending.",
    firstMonth: 99,
    renewal: 69,
    bullets: [
      "Front desk, techs, assistants",
      "30-day listing, basic visibility",
      "Email notifications on applies",
    ],
  },
  {
    key: "manager",
    name: "Manager",
    headline: "Keep your clinic organized & profitable.",
    firstMonth: 249,
    renewal: 149,
    bullets: [
      "Office/optical managers",
      "Featured placement & analytics",
      "Email + dashboard notifications",
    ],
  },
  {
    key: "doctor",
    name: "Doctor",
    headline: "Protect $50k+ monthly revenue from walking out the door.",
    firstMonth: 599,
    renewal: 399,
    bullets: [
      "Highest-impact roles",
      "Top placement & full analytics",
      "Priority applicant alerts",
    ],
  },
];

const CANDIDATE_PLANS = [
  {
    key: "free",
    name: "Free",
    bullets: ["Browse all jobs", "Apply to live openings", "Save up to 5 jobs"],
    cta: { label: "Create free account", href: "/candidate/register" },
  },
  {
    key: "plus",
    name: "Plus",
    comingSoon: true,
    bullets: ["Map view", "Email alerts (weekly)", "More saved jobs"],
  },
  {
    key: "premium",
    name: "Premium",
    comingSoon: true,
    bullets: ["Map + SMS alerts", "Top profile placement", "Unlimited saves"],
  },
];

const PricingTable = ({ user }) => {
  const [activeTab, setActiveTab] = useState("recruiter"); // recruiter | candidate
  const nav = useNavigate();

  const isRecruiter = activeTab === "recruiter";
  const plans = isRecruiter ? RECRUITER_PLANS : CANDIDATE_PLANS;

  return (
    <div className="pricing-root is-glass">
      <section className="pricing-section">
        {/* Segmented control */}
        <div className="seg-wrap">
          <div
            className={`seg-tabs ${
              isRecruiter ? "is-recruiter" : "is-candidate"
            }`}
            role="tablist"
            aria-label="Pricing audience"
          >
            <div className="seg-thumb" aria-hidden="true" />
            <button
              type="button"
              role="tab"
              aria-selected={isRecruiter}
              aria-controls="panel-recruiter"
              id="tab-recruiter"
              className="seg-btn"
              onClick={() => setActiveTab("recruiter")}
            >
              Recruiter plans
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={!isRecruiter}
              aria-controls="panel-candidate"
              id="tab-candidate"
              className="seg-btn"
              onClick={() => setActiveTab("candidate")}
            >
              Candidate plans
            </button>
          </div>
        </div>

        {/* Panels */}
        <div
          id={isRecruiter ? "panel-recruiter" : "panel-candidate"}
          role="tabpanel"
          aria-labelledby={isRecruiter ? "tab-recruiter" : "tab-candidate"}
          className="card-grid"
        >
          {plans.map((p) => {
            const cardClass = [
              "card",
              isRecruiter ? "recruiter" : "candidate",
            ].join(" ");
            return (
              <article
                key={p.key}
                className={cardClass}
                style={{
                  background: "rgba(255,255,255,.5)",
                  backdropFilter: "blur(10px) saturate(120%)",
                  WebkitBackdropFilter: "blur(10px) saturate(120%)",
                  border: "1px solid rgba(229,231,235,.9)",
                }}
              >
                <header className="card-head">
                  <h3 className="title">{p.name}</h3>
                  {isRecruiter && <p className="subtitle">{p.headline}</p>}
                </header>

                {isRecruiter ? (
                  <div className="card-body">
                    <div className="price-block">
                      <div className="price-line">
                        <span className="price">
                          <span className="currency">$</span>
                          <span className="amount">{p.firstMonth}</span>
                        </span>
                        <span className="period">first month</span>
                      </div>
                      <div className="price-line">
                        <span className="price small">
                          <span className="currency">$</span>
                          <span className="amount">{p.renewal}</span>
                        </span>
                        <span className="period">per month thereafter</span>
                      </div>
                    </div>

                    <ul className="bullets">
                      {p.bullets.map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>

                    <div className="spacer" />

                    <div className="actions">
                      <button
                        className="btn primary"
                        onClick={() => nav("/recruiter/register")}
                      >
                        Get started
                      </button>
                      <p className="fineprint">
                        30-day listing, cancel anytime. Prices shown in USD.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="card-body">
                    <ul className="bullets">
                      {p.bullets.map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>

                    <div className="spacer" />

                    <div className="actions">
                      {p.cta ? (
                        <a className="btn ghost" href={p.cta.href}>
                          {p.cta.label}
                        </a>
                      ) : (
                        <button className="btn disabled" disabled>
                          Coming soon
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default PricingTable;
