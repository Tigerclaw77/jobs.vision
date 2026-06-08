import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthProvider";

const RequireVerifiedEmail = ({ children }) => {
  const { session, user, loading } = useAuth();

  if (loading) return null;

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (!user?.email_confirmed_at) {
    return <Navigate to="/email-verification" replace />;
  }

  return children;
};

export default RequireVerifiedEmail;
