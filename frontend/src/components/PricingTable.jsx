import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createStripeCheckout } from "../utils/api";
import { trackRecruiterEvent } from "../recruiterAnalytics";
import "../styles/PricingTable.css";

const RECRUITER_PLANS = [
  {
    key: "staff",
    name: "Staff Job Listing",
    headline: "Reach eye-care support professionals without sorting through unrelated applicants.",
    firstMonth: 79,
    renewal: 49,
    bullets: [
      "For front desk, technicians, and assistants",
      "One eye-care job listing live for 30 days",
    ],
  },
  {
    key: "manager",
    name: "Manager Job Listing",
    headline: "Put your leadership opening in front of an eye-care-focused audience.",
    firstMonth: 149,
    renewal: 99,
    bullets: [
      "For office and optical managers",
      "One eye-care job listing live for 30 days",
    ],
  },
  {
    key: "doctor",
    name: "Doctor Job Listing",
    headline: "Connect your optometrist opening with professionals already looking in eye care.",
    firstMonth: 299,
    renewal: 199,
    bullets: [
      "For optometrist openings",
      "One eye-care job listing live for 30 days",
    ],
  },
];

const CANDIDATE_PLANS = [
  {
    key: "free",
    name: "Basic",
    price: 0,
    period: "month",
    bullets: [
      "Explore eye-care roles",
      "Apply directly with employers",
      "Save up to 5 promising jobs",
    ],
    cta: { label: "Browse Jobs", href: "/jobs" },
  },
  {
    key: "plus",
    name: "Plus",
    price: 20,
    period: "month",
    bullets: [
      "Keep every opportunity organized",
      "See opportunities that fit your commute",
      "Get notified when matching positions become available",
      "Receive a weekly shortlist",
    ],
    cta: { label: "Create account", href: "/candidate/register" },
  },
  {
    key: "premium",
    name: "Premium",
    price: 50,
    period: "month",
    bullets: [
      "Get matching job alerts by text",
      "Stand out when employers browse candidates",
      "Show employers you are actively looking",
      "Keep every opportunity organized",
    ],
    cta: { label: "Create account", href: "/candidate/register" },
  },
];

const RECRUITER_PLAN_RANK = {
  staff: 1,
  manager: 2,
  doctor: 3,
};

const RECRUITER_PLAN_PRESELECT_ROLE = {
  staff: "optician",
  manager: "practice_manager",
  doctor: "optometrist",
};

const PricingTable = ({ user, showAudienceToggle = true }) => {
  const defaultAudience = useMemo(() => {
    const role = String(user?.userRole || user?.role || user?.accountRole || "").toLowerCase();
    return role === "recruiter" ? "recruiter" : "candidate";
  }, [user?.accountRole, user?.role, user?.userRole]);
  const [activeTab, setActiveTab] = useState(defaultAudience); // recruiter | candidate
  const [loadingPlan, setLoadingPlan] = useState("");
  const nav = useNavigate();
  const location = useLocation();
  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const requestedAudience = query.get("audience");
  const recommendedPlanParam = String(query.get("recommendedPlan") || "").toLowerCase();
  const recommendedPlan = RECRUITER_PLAN_RANK[recommendedPlanParam]
    ? recommendedPlanParam
    : "";

  useEffect(() => {
    if (requestedAudience === "recruiter" || recommendedPlan) {
      setActiveTab("recruiter");
      return;
    }
    if (requestedAudience === "candidate") {
      setActiveTab("candidate");
      return;
    }
    setActiveTab(defaultAudience);
  }, [defaultAudience, requestedAudience, recommendedPlan]);

  const isRecruiter = activeTab === "recruiter";
  useEffect(() => {
    if (isRecruiter) trackRecruiterEvent("recruiter_pricing_view", { page_path: "/pricing" });
  }, [isRecruiter]);
  const plans = isRecruiter ? RECRUITER_PLANS : CANDIDATE_PLANS;
  const panelId = isRecruiter ? "panel-recruiter" : "panel-candidate";
  const tabId = isRecruiter ? "tab-recruiter" : "tab-candidate";

  const startCheckout = async (plan, audience) => {
    const registerPath = audience === "recruiter" ? "/recruiter/register" : "/candidate/register";
    if (!user?.id) {
      if (audience === "recruiter") {
        const role = RECRUITER_PLAN_PRESELECT_ROLE[plan.key] || "";
        const params = new URLSearchParams({
          postingPlan: plan.key,
          ...(role ? { role } : {}),
        });
        nav(`${registerPath}?${params.toString()}`);
        return;
      }
      nav(registerPath);
      return;
    }

    if (audience === "recruiter") {
      const role = RECRUITER_PLAN_PRESELECT_ROLE[plan.key] || "";
      const params = new URLSearchParams({
        postingPlan: plan.key,
        ...(role ? { role } : {}),
      });
      nav(`/recruiter/addjob?${params.toString()}`);
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

        {isRecruiter && (
          <div className="pricing-context" role="note">
            <strong className="pricing-context-title">
              Recruiter accounts are free. You only pay when posting a job listing.
            </strong>
            <span>
              Reach an eye-care-focused audience and spend less time screening unrelated
              applicants.
            </span>
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
            const belowRecommended =
              isRecruiter &&
              recommendedPlan &&
              RECRUITER_PLAN_RANK[p.key] < RECRUITER_PLAN_RANK[recommendedPlan];
            const isRecommended = isRecruiter && recommendedPlan === p.key;
            const cardClass = [
              "card",
              isRecruiter ? "recruiter" : "candidate",
              `plan-${p.key}`,
              isRecommended ? "recommended" : "",
              belowRecommended ? "disabled" : "",
            ].join(" ");
            return (
              <article
                key={p.key}
                className={cardClass}
              >
                <header className="card-head">
                  <h3 className="title">{p.name}</h3>
                  {isRecommended && <p className="subtitle">Recommended for this posting</p>}
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
                        <span className="period">every 30 days after</span>
                      </div>
                    </div>

                    <p className="billing-summary">
                      ${p.firstMonth} for your first 30-day listing. Active listings renew
                      every 30 days for ${p.renewal} until canceled.
                    </p>

                    <ul className="bullets">
                      {p.bullets.map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>

                    <div className="spacer" />

                    <div className="actions">
                      <button
                        className={`btn ${p.key === "staff" ? "ghost" : "primary"}`}
                        onClick={() => startCheckout(p, "recruiter")}
                        disabled={loadingPlan === p.key || belowRecommended}
                      >
                        {belowRecommended
                          ? "Not valid for this posting"
                          : loadingPlan === p.key
                          ? "Starting..."
                          : "Post this job"}
                      </button>
                      <p className="fineprint">
                        <span>One listing per purchase. Cancel renewal anytime.</span>
                        <span>Prices shown in USD.</span>
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="card-body">
                    <div className="price-block">
                      <div className="price-line">
                        {p.key === "free" ? (
                          <span className="price price-free">
                            <span className="amount">FREE</span>
                          </span>
                        ) : (
                          <>
                            <span className="price">
                              <span className="currency">$</span>
                              <span className="amount">{p.price}</span>
                            </span>
                            <span className="period">/{p.period}</span>
                          </>
                        )}
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
                        <Link className="btn ghost" to={p.cta.href}>
                          {p.cta.label}
                        </Link>
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
