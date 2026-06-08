import React, { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import "../styles/Home.css";
import PricingTable from "./PricingTable";
import { useEffectiveAuth } from "./auth/useEffectiveAuth";

const ROLE_COVERAGE = [
  "Ophthalmology",
  "Optometry",
  "Optical",
  "Technicians",
  "Nurses",
  "Practice Teams",
];

const Home = () => {
  const { user: effectiveUser } = useEffectiveAuth();
  const user = effectiveUser;
  const role = String(user?.userRole || user?.role || user?.accountRole || "").toLowerCase();
  const isKnownSingleRole = role === "candidate" || role === "recruiter";

  const heroLinks = useMemo(() => {
    const postPath = role === "recruiter" || role === "admin" ? "/recruiter/addjob" : "/recruiter/register";
    const seekerPath = role === "candidate" || role === "admin" ? "/candidate/dashboard" : "/jobs";
    return { postPath, seekerPath };
  }, [role]);

  // Mark specialties that start a new wrapped line so they do not show a dot.
  useEffect(() => {
    const root = document.getElementById("roles-line");
    if (!root) return;

    const markLineStarts = () => {
      const items = Array.from(root.querySelectorAll("span"));
      items.forEach((s) => s.classList.remove("line-start"));

      if (!items.length) return;
      let lastTop = items[0].offsetTop;
      for (let i = 1; i < items.length; i++) {
        const t = items[i].offsetTop;
        if (t > lastTop) items[i].classList.add("line-start");
        lastTop = t;
      }
    };

    let rAF;
    const onResize = () => {
      cancelAnimationFrame(rAF);
      rAF = requestAnimationFrame(markLineStarts);
    };

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(markLineStarts);
    } else {
      markLineStarts();
    }

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div className="home">
      <div className="content-veil" />

      <section className="marketplace-hero" aria-labelledby="home-marketplace-title">
        <p className="hero-kicker">jobs.vision marketplace</p>
        <h1 id="home-marketplace-title" className="hero-title">
          Find Work. Find Your Team.
        </h1>
        <p className="hero-copy">
          A focused marketplace for ophthalmology, optometry, optical, and practice teams.
        </p>
        <div className="hero-actions" aria-label="Primary homepage actions">
          <Link to="/jobs" className="hero-cta hero-cta-primary">
            Browse Jobs
          </Link>
          <Link to={heroLinks.postPath} className="hero-cta hero-cta-secondary">
            Post a Job
          </Link>
        </div>
      </section>

      <div className="banner-text-lower roles marketplace-specialties" id="roles-line">
        {ROLE_COVERAGE.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      <div className="component-wrapper">
        <section className="marketplace-section marketplace-paths" aria-label="Marketplace paths">
          <article className="marketplace-path-card path-card-seekers">
            <p className="path-label">For Job Seekers</p>
            <h2>Search focused eye care openings.</h2>
            <p>
              Browse roles across clinical, optical, surgical, and practice operations.
            </p>
            <Link to={heroLinks.seekerPath} className="path-link">
              {role === "candidate" || role === "admin" ? "Open Candidate Dashboard" : "Browse Jobs"}
            </Link>
          </article>

          <article className="marketplace-path-card path-card-employers">
            <p className="path-label">For Employers</p>
            <h2>Post openings for eye care teams.</h2>
            <p>
              Reach people looking for medical, optical, and administrative roles in eye care.
            </p>
            <Link to={heroLinks.postPath} className="path-link">
              {role === "recruiter" || role === "admin" ? "Post a Job" : "Start Hiring"}
            </Link>
          </article>
        </section>

        <section className="marketplace-section marketplace-pricing" aria-label="Pricing">
          <PricingTable user={user} showAudienceToggle={!isKnownSingleRole} />
        </section>
      </div>
    </div>
  );
};

export default Home;
