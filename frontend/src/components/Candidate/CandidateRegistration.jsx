import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as Yup from "yup";
import { useNavigate } from "react-router-dom";
import {
  Container,
  Paper,
  Typography,
  Button,
  Snackbar,
  Alert,
} from "@mui/material";
import GlassTextField from "../ui/GlassTextField";
import { supabase } from "../../utils/supabaseClient";
import "../../styles/forms.css";

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

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password: data.password,
        options: {
          emailRedirectTo: `${base}/verify-email`,
          data: {
            role: "candidate",
            firstName: data.firstName,
            lastName: data.lastName,
          },
        },
      });

      if (error) {
        const msg = (error.message || "").toLowerCase();
        if (error.status === 400 || msg.includes("already") || msg.includes("exists")) {
          await supabase.auth
            .resend({
              type: "signup",
              email,
              options: { emailRedirectTo: `${base}/verify-email` },
            })
            .catch(() => {});
        } else {
          throw error;
        }
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
