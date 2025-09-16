import React from "react";
import { Navigate } from "react-router-dom";
import { useSelector } from "react-redux";

const ProtectedRoute = ({ children, allowedUserRoles = [] }) => {
  const { token, userRole } = useSelector((state) => state.auth);

  // Dev mode override (optional, depends on how you want to use this)
  const isDevMode = process.env.REACT_APP_DEV_MODE === "true";

  const currentUserRole = isDevMode ? "admin" : userRole;

  // ✅ 1. Check for token (not just role)
  if (!token && !isDevMode) {
    console.warn("No token found. Redirecting to login...");
    return <Navigate to="/login" replace />;
  }

  // ✅ 2. Role restriction (optional: default to ["candidate", "recruiter", "admin"] if no roles specified)
  if (allowedUserRoles.length > 0 && !allowedUserRoles.includes(currentUserRole)) {
    console.warn(`Unauthorized role (${currentUserRole}). Redirecting to unauthorized...`);
    return <Navigate to="/unauthorized" replace />;
  }

  // ✅ 3. Render protected content
  return children;
};

export default ProtectedRoute;
