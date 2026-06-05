import React from "react";
import { Link } from "react-router-dom";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import PostAddIcon from "@mui/icons-material/PostAdd";
import WorkIcon from "@mui/icons-material/Work";
import TravelExploreIcon from "@mui/icons-material/TravelExplore";
import "../styles/Home.css";

const OptionsSection = ({ user }) => {
  const userRole = user?.userRole;
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
            <img src="/images/RegisterRecruiter.png" alt="Recruiter" />
            <h3>Register as a Recruiter</h3>
          </Link>
          <Link to="/candidate/register" className="option-card">
            <img src="/images/RegisterCandidate.png" alt="Candidate" />
            <h3>Register as a Candidate</h3>
          </Link>
          <Link to="/jobs" className="option-card">
            <img src="/images/SearchJobs.png" alt="Browse Jobs" />
            <h3>Browse Jobs</h3>
          </Link>
        </>
      )}

      {userRole === "admin" && (
        <>
          <Link to="/admin" className="option-card">
            <img src="/images/admin-dashboard.png" alt="Admin Dashboard" />
            <h3>Admin Dashboard</h3>
          </Link>
          <Link to="/users" className="option-card">
            <img src="/images/manage-users.png" alt="Manage Users" />
            <h3>Manage Users</h3>
          </Link>
          <Link to="/admin/manual-overrides" className="option-card">
            <img src="/images/manage-users.png" alt="Manual Overrides" />
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
          <Link to="/candidate/profile" className="option-card">
            <span className="option-card-visual profile-action" aria-hidden="true">
              <AccountCircleIcon />
            </span>
            <h3>Update Profile</h3>
          </Link>
        </>
      )}
    </div>
  );
};

export default OptionsSection;
