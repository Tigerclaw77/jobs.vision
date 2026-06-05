import React from "react";
import { Link } from "react-router-dom";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import BookmarkIcon from "@mui/icons-material/Bookmark";
import PostAddIcon from "@mui/icons-material/PostAdd";
import WorkIcon from "@mui/icons-material/Work";
import TravelExploreIcon from "@mui/icons-material/TravelExplore";
import "../styles/Home.css";

const OptionsSection = ({ user }) => {
  const userRole = String(user?.userRole || user?.role || user?.accountRole || "").toLowerCase();
  const isGuest =
    user === null ||
    user === undefined ||
    (typeof user === "object" && Object.keys(user).length === 0);

  return (
    <div className="options-container">
      {isGuest && (
        <>
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
          <Link to="/recruiter/register" className="option-card">
            <img
              src="/images/register-recruiter-card.webp"
              alt="Recruiter"
              width="360"
              height="360"
              loading="eager"
              decoding="async"
              fetchPriority="high"
            />
            <h3>Register as a Recruiter</h3>
          </Link>
          <Link to="/candidate/register" className="option-card">
            <img
              src="/images/register-candidate-card.webp"
              alt="Candidate"
              width="360"
              height="360"
              loading="eager"
              decoding="async"
            />
            <h3>Register as a Candidate</h3>
          </Link>
          <Link to="/jobs" className="option-card">
            <img
              src="/images/search-jobs-card.webp"
              alt="Browse Jobs"
              width="360"
              height="360"
              loading="eager"
              decoding="async"
            />
            <h3>Browse Jobs</h3>
          </Link>
        </>
      )}

      {userRole === "admin" && (
        <>
          <Link to="/admin" className="option-card">
            <img
              src="/images/admin-dashboard-card.webp"
              alt="Admin Dashboard"
              width="360"
              height="360"
              loading="eager"
              decoding="async"
            />
            <h3>Admin Dashboard</h3>
          </Link>
          <Link to="/users" className="option-card">
            <img
              src="/images/manage-users-card.webp"
              alt="Manage Users"
              width="360"
              height="360"
              loading="eager"
              decoding="async"
            />
            <h3>Manage Users</h3>
          </Link>
          <Link to="/admin/manual-overrides" className="option-card">
            <img
              src="/images/manage-users-card.webp"
              alt="Manual Overrides"
              width="360"
              height="360"
              loading="eager"
              decoding="async"
            />
            <h3>Manual Overrides</h3>
          </Link>
        </>
      )}

      {userRole === "recruiter" && (
        <>
          <Link to="/recruiter/addjob" className="option-card">
            <span className="option-card-visual" aria-hidden="true">
              <PostAddIcon />
            </span>
            <h3>Post a Job</h3>
          </Link>
          <Link to="/recruiter/dashboard" className="option-card">
            <span className="option-card-visual" aria-hidden="true">
              <WorkIcon />
            </span>
            <h3>Manage Jobs</h3>
          </Link>
          <Link to="/recruiter/profile" className="option-card">
            <span className="option-card-visual" aria-hidden="true">
              <AccountCircleIcon />
            </span>
            <h3>Account</h3>
          </Link>
        </>
      )}

      {userRole === "candidate" && (
        <>
          <Link to="/jobs" className="option-card">
            <span className="option-card-visual candidate-action" aria-hidden="true">
              <TravelExploreIcon />
            </span>
            <h3>Browse Jobs</h3>
          </Link>
          <Link to="/candidate/dashboard" className="option-card">
            <span className="option-card-visual saved-action" aria-hidden="true">
              <BookmarkIcon />
            </span>
            <h3>Saved Jobs</h3>
          </Link>
          <Link to="/candidate/profile" className="option-card">
            <span className="option-card-visual profile-action" aria-hidden="true">
              <AccountCircleIcon />
            </span>
            <h3>Profile</h3>
          </Link>
        </>
      )}
    </div>
  );
};

export default OptionsSection;
