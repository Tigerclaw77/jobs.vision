import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createStripeCheckout } from "../utils/api";
import "../styles/PricingTable.css";

const RECRUITER_PLANS = [
  {
    key: "staff",
    name: "Staff Position",
    headline: "Post support-team openings without overspending.",
    firstMonth: 79,
    renewal: 49,
    bullets: [
      "Front desk, techs, assistants",
      "30-day listing, basic visibility",
      "Email notifications for candidate interest",
    ],
  },
  {
    key: "manager",
    name: "Manager Position",
    headline: "Post leadership openings for your optical or clinic team.",
    firstMonth: 149,
    renewal: 99,
    bullets: [
      "Office/optical managers",
      "30-day listing with enhanced visibility",
      "Email + dashboard notifications",
    ],
  },
  {
    key: "doctor",
    name: "Doctor Position",
    headline: "Post high-impact optometrist openings with stronger visibility.",
    firstMonth: 299,
    renewal: 149,
    bullets: [
      "Optometrist-focused listing",
      "30-day listing with strongest visibility",
      "Priority candidate interest alerts",
    ],
  },
];

const CANDIDATE_PLANS = [
  {
    key: "free",
    name: "Free",
    price: 0,
    period: "month",
    bullets: ["Browse jobs", "Apply to jobs", "Save up to 5 jobs"],
    cta: { label: "Create free account", href: "/candidate/register" },
  },
  {
    key: "plus",
    name: "Plus",
    price: 20,
    period: "month",
    bullets: ["Unlimited saves", "Map search", "Email alerts", "Weekly matching"],
    cta: { label: "Create account", href: "/candidate/register" },
  },
  {
    key: "premium",
    name: "Premium",
    price: 50,
    period: "month",
    bullets: [
      "SMS alerts",
      "Priority profile placement",
      "Featured candidate badge",
      "Unlimited saves",
    ],
    cta: { label: "Create account", href: "/candidate/register" },
  },
];

const PricingTable = ({ user, showAudienceToggle = true }) => {
  const defaultAudience = useMemo(() => {
    const role = String(user?.userRole || user?.role || user?.accountRole || "").toLowerCase();
    return role === "recruiter" ? "recruiter" : "candidate";
  }, [user?.accountRole, user?.role, user?.userRole]);
  const [activeTab, setActiveTab] = useState(defaultAudience); // recruiter | candidate
  const [loadingPlan, setLoadingPlan] = useState("");
  const nav = useNavigate();

  useEffect(() => {
    setActiveTab(defaultAudience);
  }, [defaultAudience]);

  const isRecruiter = activeTab === "recruiter";
  const plans = isRecruiter ? RECRUITER_PLANS : CANDIDATE_PLANS;
  const panelId = isRecruiter ? "panel-recruiter" : "panel-candidate";
  const tabId = isRecruiter ? "tab-recruiter" : "tab-candidate";

  const startCheckout = async (plan, audience) => {
    const registerPath = audience === "recruiter" ? "/recruiter/register" : "/candidate/register";
    if (!user?.id) {
      nav(registerPath);
      return;
    }

    try {
      setLoadingPlan(plan.key);
      const { url } = await createStripeCheckout(plan.key);
      if (!url) throw new Error("Stripe did not return a checkout URL.");
      window.location.assign(url);
    } catch (err) {
      alert(err?.response?.data?.error || err?.message || "Unable to start Stripe checkout.");
    } finally {
      setLoadingPlan("");
    }
  };

  return (
    <div className="pricing-root is-glass">
      <section
        className={`pricing-section ${
          showAudienceToggle ? "" : "no-audience-toggle"
        }`}
      >
        {/* Segmented control */}
        {showAudienceToggle && (
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
                Post a Job
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
                Find a Job
              </button>
            </div>
          </div>
        )}

        {/* Panels */}
        <div
          id={panelId}
          role={showAudienceToggle ? "tabpanel" : undefined}
          aria-labelledby={showAudienceToggle ? tabId : undefined}
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
                        <span className="period">first 30 days</span>
                      </div>
                      <div className="price-line">
                        <span className="price small">
                          <span className="currency">$</span>
                          <span className="amount">{p.renewal}</span>
                        </span>
                        <span className="period">every 30 days thereafter</span>
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
                        onClick={() => startCheckout(p, "recruiter")}
                        disabled={loadingPlan === p.key}
                      >
                        {loadingPlan === p.key ? "Starting..." : "Post this listing"}
                      </button>
                      <p className="fineprint">
                        Recurring 30-day listing cycle. Cancel anytime. Prices shown in USD.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="card-body">
                    <div className="price-block">
                      <div className="price-line">
                        <span className="price">
                          <span className="currency">$</span>
                          <span className="amount">{p.price}</span>
                        </span>
                        <span className="period">/{p.period}</span>
                      </div>
                    </div>

                    <ul className="bullets">
                      {p.bullets.map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>

                    <div className="spacer" />

                    <div className="actions">
                      {p.key === "free" ? (
                        <a className="btn ghost" href={p.cta.href}>
                          {p.cta.label}
                        </a>
                      ) : (
                        <button
                          className="btn ghost"
                          type="button"
                          onClick={() => startCheckout(p, "candidate")}
                          disabled={loadingPlan === p.key}
                        >
                          {loadingPlan === p.key ? "Starting..." : p.cta.label}
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
