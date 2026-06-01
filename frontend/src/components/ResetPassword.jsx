// src/components/ResetPassword.jsx
import React, { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as Yup from "yup";
import { useNavigate } from "react-router-dom";
import { Button, Paper, Container, Typography, CircularProgress, Alert } from "@mui/material";
import { neonAuth, resetNeonPassword } from "../utils/neonAuthClient";
import GlassTextField from "./ui/GlassTextField";
import "../styles/forms.css";

const schema = Yup.object({
  newPassword: Yup.string()
    .min(6, "Password must be at least 6 characters.")
    .required("New password is required."),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref("newPassword")], "Passwords must match.")
    .required("Please confirm your new password."),
});

function getParam(name) {
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams((window.location.hash || "").replace(/^#/, ""));
  return search.get(name) || hash.get(name);
}

export default function ResetPassword() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState("loading"); // "loading" | "form" | "done" | "error"
  const [banner, setBanner] = useState(null);
  const resetContext = useRef({ token: null, email: null, otp: null });
  const redirectTimer = useRef(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm({ resolver: yupResolver(schema) });

  useEffect(() => {
    return () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
    };
  }, []);

  useEffect(() => {
    const token = getParam("token") || getParam("reset_token") || getParam("code");
    const email = getParam("email");
    const otp = getParam("otp");

    if (token || (email && otp)) {
      resetContext.current = { token, email, otp };
      setBanner({ severity: "info", message: "Enter a new password below." });
      setPhase("form");
      return;
    }

    setBanner({
      severity: "error",
      message: "This reset link is invalid or expired. Please request a new password reset email.",
    });
    setPhase("error");
  }, []);

  const onSubmit = async ({ newPassword }) => {
    try {
      const { error } = await resetNeonPassword({
        newPassword,
        ...resetContext.current,
      });
      if (error) throw error;

      await neonAuth.signOut();
      reset();
      setBanner({
        severity: "success",
        message: "Password updated successfully. Redirecting to login...",
      });
      setPhase("done");

      redirectTimer.current = setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      setBanner({ severity: "error", message: err?.message || "Password reset failed." });
      setPhase("form");
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

            <Button
              type="submit"
              variant="contained"
              className="glass-button"
              fullWidth
              disabled={isSubmitting}
            >
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
