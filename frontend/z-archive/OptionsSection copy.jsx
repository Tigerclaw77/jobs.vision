import React from "react";
import { Link } from "react-router-dom";
import "../styles/Home.css";

const OptionsSection = ({ user }) => {
  return (
    <div className="options-container">
      {/* GUEST (Not Logged In) */}
      {!user && (
        <>
          {/* Buttons (Shown on Small Screens) */}
          <button
            className="option-button"
            onClick={() => (window.location.href = "/recruiter/register")}
          >
            Register as a Recruiter
          </button>
          <button
            className="option-button"
            onClick={() => (window.location.href = "/candidate/register")}
          >
            Register as a Candidate
          </button>

          {/* Cards (Shown on Large Screens) */}
          <Link to="/recruiter/register" className="option-card">
            <img src="/images/recruiter.jpg" alt="Recruiter" />
            <h3>Register as a Recruiter</h3>
          </Link>
          <Link to="/candidate/register" className="option-card">
            <img src="/images/candidate.jpg" alt="Candidate" />
            <h3>Register as a Candidate</h3>
          </Link>
        </>
      )}

      {/* RECRUITER OPTIONS */}
      {user?.role === "recruiter" && (
        <>
          <Link to="/jobs/post" className="option-card">
            <img src="/images/post-job.jpg" alt="Post a Job" />
            <h3>Post a Job</h3>
          </Link>
          <Link to="/jobs/manage" className="option-card">
            <img src="/images/edit-jobs.jpg" alt="Edit Jobs" />
            <h3>Edit Jobs</h3>
          </Link>
        </>
      )}

      {/* FREE CANDIDATE OPTIONS */}
      {user?.role === "candidate" && user.tier === 0 && (
        <>
          <Link to="/search/basic" className="option-card">
            <img src="/images/basic-search.jpg" alt="Basic Search" />
            <h3>Basic Search</h3>
          </Link>
          <Link to="/upgrade" className="option-card">
            <img src="/images/upgrade.jpg" alt="Upgrade" />
            <h3>Upgrade</h3>
          </Link>
        </>
      )}

      {/* LEVEL 1 CANDIDATE OPTIONS */}
      {user?.role === "candidate" && user.tier === 1 && (
        <>
          <Link to="/search/advanced" className="option-card">
            <img src="/images/advanced-search.jpg" alt="Advanced Search" />
            <h3>Advanced Search</h3>
          </Link>
          <Link to="/upgrade" className="option-card">
            <img src="/images/upgrade.jpg" alt="Upgrade" />
            <h3>Upgrade</h3>
          </Link>
        </>
      )}

      {/* LEVEL 2 CANDIDATE OPTIONS */}
      {user?.role === "candidate" && user.tier === 2 && (
        <>
          <Link to="/search/advanced" className="option-card">
            <img src="/images/advanced-search.jpg" alt="Advanced Search" />
            <h3>Advanced Search</h3>
          </Link>
          <Link to="/resume/post" className="option-card">
            <img src="/images/post-resume.jpg" alt="Post Resume" />
            <h3>Post Resume</h3>
          </Link>
        </>
      )}

      {/* BROWSE JOBS - ALWAYS LAST */}
      <button
        className="option-button"
        onClick={() => (window.location.href = "/jobs")}
      >
        Browse Jobs
      </button>
      
      <Link to="/jobs" className="option-card">
        <img src="/images/browse-jobs.jpg" alt="Browse Jobs" />
        <h3>Browse Jobs</h3>
      </Link>
    </div>
  );
};

export default OptionsSection;
