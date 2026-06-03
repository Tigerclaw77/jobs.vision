import React from "react";
import CandidateProfile from "./Candidate/CandidateProfile"; // Import CandidateProfile
import AdminProfile from "./Admin/AdminProfile"; // Import AdminProfile
import RecruiterProfile from "./Recruiter/RecruiterProfile"; // Import RecruiterProfile
import { useEffectiveAuth } from "./auth/useEffectiveAuth";

const Profile = () => {
  const { user } = useEffectiveAuth();

  // Conditional rendering based on userRole
  if (user?.userRole === "candidate") {
    return <CandidateProfile />;
  }

  if (user?.userRole === "admin") {
    return <AdminProfile />;
  }

  if (user?.userRole === "recruiter") {
    return <RecruiterProfile />;
  }

  return <div>Access Denied</div>; // Default case, should never happen if protected route is set
};

export default Profile;
