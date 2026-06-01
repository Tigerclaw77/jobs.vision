import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as Yup from "yup";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import {
  Container,
  Paper,
  Typography,
  Button,
  Snackbar,
  Alert,
} from "@mui/material";
import GlassTextField from "../ui/GlassTextField";
import { neonAuth, normalizeSessionResult } from "../../utils/neonAuthClient";
import "../../styles/forms.css";

function apiBaseUrl() {
  const raw = (process.env.REACT_APP_API_URL || "http://localhost:5000/api").replace(/\/+$/, "");
  return raw.endsWith("/api") ? raw : `${raw}/api`;
}

async function bootstrapProfile(accessToken, payload) {
  if (!accessToken) return;
  const res = await fetch(`${apiBaseUrl()}/auth/bootstrap-profile`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Registration succeeded, but profile setup failed.");
}

const candidateSchema = Yup.object().shape({
  firstName: Yup.string().required("First name is required."),
  lastName: Yup.string().required("Last name is required."),
  email: Yup.string().email("Invalid email address.").required("Email is required."),
  password: Yup.string().min(6, "Password must be at least 6 characters.").required("Password is required."),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref("password"), null], "Passwords must match.")
    .required("Please confirm your password."),
});

export default function CandidateRegistration() {
  const navigate = useNavigate();
  const base = window.location.origin;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm({ resolver: yupResolver(candidateSchema) });

  const [toast, setToast] = useState({
    open: false,
    message: "",
    severity: "info",
    duration: 4000,
  });

  const showToast = (message, severity = "info", duration = 4000) =>
    setToast({ open: true, message, severity, duration });

  const onSubmit = async (data) => {
    const email = data.email.trim().toLowerCase();
    const profilePayload = {
      accountRole: "candidate",
      firstName: data.firstName,
      lastName: data.lastName,
    };

    try {
      const result = await neonAuth.signUp({
        email,
        password: data.password,
        options: {
          emailRedirectTo: `${base}/verify-email`,
          data: {
            accountRole: profilePayload.accountRole,
            firstName: profilePayload.firstName,
            lastName: profilePayload.lastName,
          },
        },
      });
      const { error } = result;

      if (error) {
        const msg = (error.message || "").toLowerCase();
        if (error.status === 400 || msg.includes("already") || msg.includes("exists")) {
          await neonAuth
            .resend({
              type: "signup",
              email,
              options: { emailRedirectTo: `${base}/verify-email` },
            })
            .catch(() => {});
        } else if (error.status === 401 && msg.includes("failed to retrieve user session")) {
          // Some verified-email flows create the auth user but do not return a session yet.
        } else {
          throw error;
        }
      }

      const session = normalizeSessionResult(result);
      if (session?.access_token) {
        await bootstrapProfile(session.access_token, {
          email,
          ...profilePayload,
        });
      }

      showToast("If that email exists, we’ve sent a verification link.", "success");
      reset();
      navigate("/login");
    } catch (err) {
      showToast(err?.message || "Registration failed. Please try again.", "error");
    }
  };

  return (
    <Container maxWidth="sm">
      <Paper elevation={5} className="glass-form register-form">
        <Typography variant="h4" align="center" gutterBottom>
          Candidate Registration
        </Typography>
        <Button
          component={RouterLink}
          to="/"
          variant="text"
          fullWidth
          sx={{ mb: 1 }}
        >
          Back to Home
        </Button>

        {/* autofill suppression: off + honeypots */}
        <form onSubmit={handleSubmit(onSubmit)} noValidate autoComplete="off">
          {/* Honeypots (hidden) to defeat browser autofill heuristics */}
          <input
            type="text"
            name="username"
            autoComplete="username"
            aria-hidden="true"
            tabIndex={-1}
            style={{ display: "none" }}
          />
          <input
            type="password"
            name="password"
            autoComplete="new-password"
            aria-hidden="true"
            tabIndex={-1}
            style={{ display: "none" }}
          />

          <GlassTextField
            label="First Name"
            {...register("firstName")}
            autoComplete="off"
            error={!!errors.firstName}
            helperText={errors.firstName?.message}
            fullWidth
            variant="outlined"
            margin="normal"
          />

          <GlassTextField
            label="Last Name"
            {...register("lastName")}
            autoComplete="off"
            error={!!errors.lastName}
            helperText={errors.lastName?.message}
            fullWidth
            variant="outlined"
            margin="normal"
          />

          <GlassTextField
            label="Email"
            type="email"
            {...register("email")}
            autoComplete="new-email"
            error={!!errors.email}
            helperText={errors.email?.message}
            fullWidth
            variant="outlined"
            margin="normal"
          />

          <GlassTextField
            label="Password"
            type="password"
            enablePasswordToggle
            {...register("password")}
            autoComplete="new-password"
            error={!!errors.password}
            helperText={errors.password?.message}
            fullWidth
            variant="outlined"
            margin="normal"
          />

          <GlassTextField
            label="Confirm Password"
            type="password"
            enablePasswordToggle
            {...register("confirmPassword")}
            autoComplete="new-password"
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
            {isSubmitting ? "Registering..." : "Register as Candidate"}
          </Button>
        </form>
      </Paper>

      <Snackbar
        open={toast.open}
        autoHideDuration={toast.duration}
        onClose={() => setToast((t) => ({ ...t, open: false })) }
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          elevation={6}
          variant="filled"
          severity={toast.severity}
          onClose={() => setToast((t) => ({ ...t, open: false })) }
          sx={{ width: "100%" }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}
