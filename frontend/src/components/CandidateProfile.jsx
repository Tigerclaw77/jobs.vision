import React from "react";
import { useSelector } from "react-redux";

const CandidateProfile = () => {
  const user = useSelector((state) => state.auth.user);

  return (
    <div>
      <h2>Profile</h2>
      <p><strong>First Name:</strong> {user?.firstName || "N/A"}</p>
      <p><strong>Last Name:</strong> {user?.lastName || "N/A"}</p>
      <p><strong>Email:</strong> {user?.email}</p>
      {/* Add more profile details as needed */}
    </div>
  );
};

export default CandidateProfile;
