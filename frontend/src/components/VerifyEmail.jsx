// frontend/src/pages/VerifyEmail.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Container, Paper, Typography, Button, CircularProgress } from "@mui/material";
import { useDispatch } from "react-redux";
import { supabase } from "../utils/supabaseClient";
import api from "../utils/api";
import { login as loginRedux } from "../store/authSlice";

function redirectForRole(role) {
  if (role === "admin") return "/admin";
  if (role === "recruiter") return "/recruiter/dashboard";
  return "/candidate/dashboard";
}

export default function VerifyEmail() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [phase, setPhase] = useState("loading"); // loading | success | nocode | error
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");

      if (!code) {
        // If already signed in, just hydrate and go
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session?.user) {
          try {
            const me = await api.get("/auth/me");
            if (!mounted) return;
            dispatch(loginRedux({ userRole: me.data.role, user: me.data, token: null }));
            navigate(redirectForRole(me.data.role), { replace: true });
            return;
          } catch {
            // fall through to “nocode”
          }
        }
        if (!mounted) return;
        setPhase("nocode");
        setMessage("This page expects a verification link. Please check your email or log in.");
        return;
      }

      // Exchange code -> session
      const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
      if (error) {
        if (!mounted) return;
        setPhase("error");
        setMessage(
          error.message ||
            "This verification link is invalid or has expired. If you've already confirmed, try logging in."
        );
        return;
      }

      // Hydrate from backend
      try {
        const me = await api.get("/auth/me");
        if (!mounted) return;
        dispatch(loginRedux({ userRole: me.data.role, user: me.data, token: null }));
        setPhase("success");
        setMessage("Email verified! Redirecting…");
        setTimeout(() => {
          navigate(redirectForRole(me.data.role), { replace: true });
        }, 600);
      } catch (e) {
        if (!mounted) return;
        setPhase("error");
        setMessage("Verification succeeded, but we couldn't fetch your profile. Please try logging in.");
      }
    })();

    return () => { mounted = false; };
  }, [dispatch, navigate]);

  return (
    <Container maxWidth="sm">
      <Paper elevation={5} className="glass-form" style={{ textAlign: "center" }}>
        <Typography variant="h4" gutterBottom>Email Verification</Typography>

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
