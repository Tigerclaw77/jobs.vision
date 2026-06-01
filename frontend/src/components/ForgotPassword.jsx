// src/components/ForgotPassword.jsx
import React, { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as Yup from "yup";
import { useNavigate } from "react-router-dom";
import { Button, Paper, Container, Typography, Alert } from "@mui/material";
import { neonAuth } from "../utils/neonAuthClient";
import "../styles/forms.css";
import GlassTextField from "./ui/GlassTextField";

const schema = Yup.object({
  email: Yup.string().email("Invalid email").required("Email is required"),
});

export default function ForgotPassword() {
  const navigate = useNavigate();
  const base = window.location.origin;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: yupResolver(schema) });

  const [banner, setBanner] = useState(null); // { severity: 'success'|'error', message: string }
  const redirectTimer = useRef(null);

  useEffect(() => {
    return () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
    };
  }, []);

  const onSubmit = async ({ email }) => {
    const normalized = email.trim().toLowerCase();
    try {
      const { error } = await neonAuth.resetPasswordForEmail(normalized, {
        redirectTo: `${base}/reset-password`,
      });

      if (error) {
        const msg = (error.message || "").toLowerCase();
        // Show real config issues (e.g., redirect not allow-listed)
        if (msg.includes("not allowed") || msg.includes("invalid redirect") || msg.includes("url")) {
          setBanner({ severity: "error", message: error.message });
          return;
        }
        // Otherwise fall through to generic success UX (account-enumeration safe)
      }

      setBanner({
        severity: "success",
        message: "If an account exists for this email, a password-reset link has been sent.",
      });

      // Redirect after message has been visible for a moment
      redirectTimer.current = setTimeout(() => navigate("/login"), 4500);
    } catch (err) {
      setBanner({ severity: "error", message: err?.message || "An unexpected error occurred." });
    }
  };

  return (
    <Container maxWidth="sm">
      <Paper elevation={5} className="glass-form forgot-password-form">
        <Typography variant="h4" align="center" gutterBottom>
          Forgot Password
        </Typography>

        {banner && (
          <Alert
            severity={banner.severity}
            variant="filled"
            sx={{ mb: 2 }}
          >
            {banner.message}
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <GlassTextField
            label="Email Address"
            type="email"
            {...register("email")}
            error={!!errors.email}
            helperText={errors.email?.message}
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
            {isSubmitting ? "Sending…" : "Send Reset Link"}
          </Button>
        </form>
      </Paper>
    </Container>
  );
}
