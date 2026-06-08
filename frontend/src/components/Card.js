import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./auth/AuthProvider";

const ProtectedRoute = ({ children, allowedUserRoles = [] }) => {
  const { session, role, loading, loadingProfile } = useAuth();
  const currentUserRole = String(role || "").toLowerCase();

  if (loading || (session && loadingProfile && !currentUserRole)) {
    return null;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  const allowedRoles = allowedUserRoles.map((item) =>
    String(item || "").toLowerCase()
  );

  if (
    allowedRoles.length > 0 &&
    currentUserRole !== "admin" &&
    !allowedRoles.includes(currentUserRole)
  ) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};

export default ProtectedRoute;
