import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";

const RequireVerifiedEmail = ({ children }) => {
  const user = useSelector((state) => state.auth.user);

  if (!user?.isVerified) {
    return <Navigate to="/email-verification" replace />;
  }

  return children;
};

export default RequireVerifiedEmail;
