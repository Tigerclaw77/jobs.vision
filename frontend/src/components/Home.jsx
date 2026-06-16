import React from "react";
import { Link } from "react-router-dom";
import PostAddIcon from "@mui/icons-material/PostAdd";
import TravelExploreIcon from "@mui/icons-material/TravelExplore";
import "../styles/Home.css";
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
  const userRole = String(user?.userRole || user?.role || user?.accountRole || "").toLowerCase();
  const postJobHref =
    userRole === "recruiter" || userRole === "admin"
      ? "/recruiter/addjob"
      : "/recruiter/register?next=/recruiter/addjob";

  return (
    <div className="home">
      <section className="marketplace-hero" aria-labelledby="home-marketplace-title">
        <h1 id="home-marketplace-title" className="hero-title">
          Eye care jobs, without the noise.
        </h1>
        <p className="hero-copy">
          Browse focused optometry and optical openings, or post a job for the right eye care team.
        </p>
      </section>

      <div className="component-wrapper">
        <div className="role-strip" aria-label="Eye care roles">
          {ROLE_COVERAGE.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
        <section className="home-action-cards" aria-label="Find a job or post a job">
          <Link to={postJobHref} className="home-action-card recruiter">
            <span className="home-action-icon" aria-hidden="true">
              <PostAddIcon />
            </span>
            <span>
              <h2>Post a Job</h2>
              <p>Create the posting first. Checkout appears when the posting is ready.</p>
            </span>
            <strong>Create Posting</strong>
          </Link>

          <Link to="/jobs" className="home-action-card candidate">
            <span className="home-action-icon" aria-hidden="true">
              <TravelExploreIcon />
            </span>
            <span>
              <h2>Find a Job</h2>
              <p>Browse eye care openings by role, practice type, schedule, and setting.</p>
            </span>
            <strong>Browse Jobs</strong>
          </Link>
        </section>
      </div>
    </div>
  );
};

export default Home;
