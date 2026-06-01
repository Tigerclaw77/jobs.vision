// frontend/src/pages/VerifyEmail.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Container, Paper, Typography, Button, CircularProgress } from "@mui/material";
import { useDispatch } from "react-redux";
import {
  getNeonSession,
  neonAuth,
  normalizeSessionResult,
  verifyNeonEmailToken,
} from "../utils/neonAuthClient";
import { login as loginRedux } from "../store/authSlice";

function apiBaseUrl() {
  const raw = (process.env.REACT_APP_API_URL || "http://localhost:5000/api").replace(/\/+$/, "");
  return raw.endsWith("/api") ? raw : `${raw}/api`;
}

function redirectForRole(role) {
  if (role === "admin") return "/admin";
  if (role === "recruiter") return "/recruiter/dashboard";
  return "/candidate/dashboard";
}

async function fetchMe(accessToken) {
  const res = await fetch(`${apiBaseUrl()}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Profile lookup failed");
  return res.json();
}

function getParam(name) {
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams((window.location.hash || "").replace(/^#/, ""));
  return search.get(name) || hash.get(name);
}

export default function VerifyEmail() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [phase, setPhase] = useState("loading"); // loading | success | nocode | error
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;

    async function hydrateAndRedirect(session, fallbackMessage) {
      if (!session?.access_token) {
        if (!mounted) return;
        setPhase("success");
        setMessage(fallbackMessage || "Email verified. You can log in now.");
        return;
      }

      const me = await fetchMe(session.access_token);
      if (!mounted) return;

      dispatch(
        loginRedux({
          userRole: me.role,
          user: me,
          token: session.access_token,
        })
      );
      setPhase("success");
      setMessage("Email verified! Redirecting...");
      setTimeout(() => {
        navigate(redirectForRole(me.role), { replace: true });
      }, 600);
    }

    (async () => {
      const errorDescription =
        getParam("error_description") || getParam("error") || getParam("message");
      if (errorDescription) {
        if (!mounted) return;
        setPhase("error");
        setMessage(errorDescription);
        return;
      }

      const verificationToken =
        getParam("token") || getParam("token_hash") || getParam("verification_token");
      const code = getParam("code");

      try {
        if (verificationToken) {
          const { session, error } = await verifyNeonEmailToken(
            verificationToken,
            `${window.location.origin}/login`
          );
          if (error) throw error;
          await hydrateAndRedirect(session, "Email verified. You can log in now.");
          return;
        }

        if (code) {
          const result = await neonAuth.exchangeCodeForSession(window.location.href);
          const session = normalizeSessionResult(result);
          if (result?.error) throw result.error;
          await hydrateAndRedirect(session, "Email verified. You can log in now.");
          return;
        }

        const { session } = await getNeonSession({ forceFetch: true });
        if (session?.user) {
          await hydrateAndRedirect(session);
          return;
        }

        if (!mounted) return;
        setPhase("nocode");
        setMessage("This page expects a verification link. Please check your email or log in.");
      } catch (err) {
        if (!mounted) return;
        setPhase("error");
        setMessage(
          err?.message ||
            "This verification link is invalid or has expired. If you've already confirmed, try logging in."
        );
      }
    })();

    return () => {
      mounted = false;
    };
  }, [dispatch, navigate]);

  return (
    <Container maxWidth="sm">
      <Paper elevation={5} className="glass-form" style={{ textAlign: "center" }}>
        <Typography variant="h4" gutterBottom>
          Email Verification
        </Typography>

        {phase === "loading" && (
          <Typography sx={{ my: 2 }}>
            <CircularProgress />
          </Typography>
        )}

        {(phase === "success" || phase === "error" || phase === "nocode") && (
          <>
            <Typography color={phase === "error" ? "error" : "inherit"} sx={{ my: 2 }}>
              {message}
            </Typography>
            <Button
              variant="outlined"
              onClick={() => navigate("/login")}
              className="glass-button"
              sx={{ mt: 1 }}
            >
              Back to Login
            </Button>
          </>
        )}
      </Paper>
    </Container>
  );
}
