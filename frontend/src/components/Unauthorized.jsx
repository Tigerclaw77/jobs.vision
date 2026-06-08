import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Container, Paper, Typography, Button } from "@mui/material";
import { useAuth } from "./auth/AuthProvider";

function formatList(value, fallback = "Not provided") {
  if (Array.isArray(value) && value.length) return value.join(", ");
  if (value) return String(value);
  return fallback;
}

const Unauthorized = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, user, account, profile, role } = useAuth();
  const authDebug = location.state?.authDebug || {};
  const detectedRole =
    authDebug.authenticatedRole ||
    role ||
    profile?.role ||
    account?.profile?.role ||
    account?.role ||
    "unknown";
  const email =
    authDebug.authenticatedEmail ||
    profile?.email ||
    account?.profile?.email ||
    account?.email ||
    user?.email ||
    (session ? "authenticated email unavailable" : "not authenticated");

  const handleGoBack = () => {
    navigate(-1); // Go back to the previous page
  };

  const handleGoHome = () => {
    navigate("/"); // Go to home (or change to login if you want)
  };

  return (
    <Container maxWidth="sm">
      <Paper elevation={5} className="glass-form">
        <Typography variant="h4" align="center" gutterBottom>
          Access Denied
        </Typography>

        <Typography align="center" paragraph>
          You do not have permission to access this page.
        </Typography>

        <div
          style={{
            margin: "18px 0",
            padding: "14px",
            border: "1px solid rgba(255, 255, 255, 0.24)",
            borderRadius: "10px",
            background: "rgba(15, 23, 42, 0.28)",
            color: "#f8fafc",
          }}
        >
          <Typography variant="body2">
            <strong>Signed in as:</strong> {email}
          </Typography>
          <Typography variant="body2">
            <strong>Detected role:</strong> {detectedRole}
          </Typography>
          <Typography variant="body2">
            <strong>Required role:</strong>{" "}
            {formatList(authDebug.requiredRoles, "authenticated user")}
          </Typography>
          <Typography variant="body2">
            <strong>Route:</strong> {authDebug.route || location.pathname}
          </Typography>
          <Typography variant="body2">
            <strong>Authorization result:</strong>{" "}
            {authDebug.authorizationResult || "denied"}
          </Typography>
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: "20px" }}>
          <Button variant="contained" onClick={handleGoBack} className="glass-button">
            Go Back
          </Button>
          <Button variant="outlined" onClick={handleGoHome} className="glass-button">
            Go Home
          </Button>
        </div>
      </Paper>
    </Container>
  );
};

export default Unauthorized;
