import React from "react";
import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom"; // Use Navigate instead of Redirect

const AdminProfile = () => {
  const user = useSelector((state) => state.auth.user);

  // If the user is null (not logged in), redirect to the login page
  if (!user) {
    return <Navigate to="/login" />; // Use Navigate for redirection
  }

  return (
    <div>
      <h2>Admin Profile</h2>
      <p><strong>First Name:</strong> {user.firstName || "N/A"}</p>
      <p><strong>Last Name:</strong> {user.lastName || "N/A"}</p>
      <p><strong>Email:</strong> {user.email}</p>
      <p><strong>User Role:</strong> {user.userRole || "Admin"}</p>
    </div>
  );
};

export default AdminProfile;
