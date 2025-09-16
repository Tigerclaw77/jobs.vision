// src/components/ResetPassword.jsx
import React, { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as Yup from "yup";
import { useNavigate } from "react-router-dom";
import { Button, Paper, Container, Typography, CircularProgress, Alert } from "@mui/material";
import { supabase } from "../utils/supabaseClient";
import GlassTextField from "./ui/GlassTextField";
import "../styles/forms.css";

const schema = Yup.object({
  newPassword: Yup.string().min(6, "Password must be at least 6 characters.").required("New password is required."),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref("newPassword")], "Passwords must match.")
    .required("Please confirm your new password."),
});

export default function ResetPassword() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState("loading"); // "loading" | "form" | "done" | "error"
  const [banner, setBanner] = useState(null);     // { severity, message }
  const redirectTimer = useRef(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm({ resolver: yupResolver(schema) });

  useEffect(() => {
    // Clean up any pending timers
    return () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
    };
  }, []);

  useEffect(() => {
    // Handle password-recovery tokens from hash
    // Example hash: #access_token=...&refresh_token=...&type=recovery
    const hash = window.location.hash?.replace(/^#/, "") || "";
    const params = new URLSearchParams(hash);
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    const type = params.get("type");

    (async () => {
      try {
        if (access_token && refresh_token && type === "recovery") {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (error) throw error;
          setBanner({ severity: "info", message: "Enter a new password below." });
          setPhase("form");
          return;
        }

        // Fallback: if user already has a valid session, allow reset anyway
        const { data } = await supabase.auth.getSession();
        if (data?.session) {
          setBanner({ severity: "info", message: "Enter a new password below." });
          setPhase("form");
          return;
        }

        // Otherwise tokens are missing/invalid
        setBanner({
          severity: "error",
          message: "This reset link is invalid or expired. Please request a new password reset email.",
        });
        setPhase("error");
      } catch (err) {
        setBanner({ severity: "error", message: err?.message || "Could not validate reset link." });
        setPhase("error");
      }
    })();
  }, []);

  const onSubmit = async ({ newPassword }) => {
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      await supabase.auth.signOut(); // end the temporary recovery session
      reset();
      setBanner({ severity: "success", message: "Password updated successfully. Redirecting to login..." });
      setPhase("done");

      redirectTimer.current = setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      setBanner({ severity: "error", message: err?.message || "Password reset failed." });
      setPhase("error");
    }
  };

  return (
    <Container maxWidth="sm">
      <Paper elevation={5} className="glass-form reset-password-form">
        <Typography variant="h4" align="center" gutterBottom>
          Reset Your Password
        </Typography>

        {banner && (
          <Alert severity={banner.severity} variant="filled" sx={{ mb: 2 }}>
            {banner.message}
          </Alert>
        )}

        {phase === "loading" && (
          <Typography align="center" sx={{ my: 2 }}>
            <CircularProgress />
          </Typography>
        )}

        {phase === "form" && (
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <GlassTextField
              label="New Password"
              type="password"
              enablePasswordToggle
              autoComplete="new-password"
              {...register("newPassword")}
              error={!!errors.newPassword}
              helperText={errors.newPassword?.message}
              fullWidth
              variant="outlined"
              margin="normal"
            />

            <GlassTextField
              label="Confirm New Password"
              type="password"
              enablePasswordToggle
              autoComplete="new-password"
              {...register("confirmPassword")}
              error={!!errors.confirmPassword}
              helperText={errors.confirmPassword?.message}
              fullWidth
              variant="outlined"
              margin="normal"
            />

            <Button type="submit" variant="contained" className="glass-button" fullWidth disabled={isSubmitting}>
              {isSubmitting ? "Resetting..." : "Reset Password"}
            </Button>
          </form>
        )}

        {phase === "done" && (
          <Typography align="center" sx={{ my: 2 }}>
            Password changed successfully.
          </Typography>
        )}
      </Paper>
    </Container>
  );
}
