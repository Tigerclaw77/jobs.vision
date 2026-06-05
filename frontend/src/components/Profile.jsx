import React from "react";
import CandidateProfile from "./Candidate/CandidateProfile"; // Import CandidateProfile
import AdminProfile from "./Admin/AdminProfile"; // Import AdminProfile
import RecruiterProfile from "./Recruiter/RecruiterProfile"; // Import RecruiterProfile
import { useEffectiveAuth } from "./auth/useEffectiveAuth";

const Profile = () => {
  const { role, user } = useEffectiveAuth();
  const activeRole = role || user?.userRole;

  // Conditional rendering based on userRole
  if (activeRole === "candidate") {
    return <CandidateProfile />;
  }

  if (activeRole === "admin") {
    return <AdminProfile />;
  }

  if (activeRole === "recruiter") {
    return <RecruiterProfile />;
  }

  return <div>Access Denied</div>; // Default case, should never happen if protected route is set
};

export default Profile;
