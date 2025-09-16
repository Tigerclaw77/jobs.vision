import React, { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as Yup from "yup";
import { useNavigate } from "react-router-dom";
import {
  Container,
  Paper,
  Typography,
  Button,
  FormControlLabel,
  Checkbox,
  Snackbar,
  Alert,
} from "@mui/material";
import GlassTextField from "../ui/GlassTextField";
import { supabase } from "../../utils/supabaseClient";
import "../../styles/forms.css";

/** Free domains (tune as needed) */
const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "aol.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "icloud.com",
  "me.com",
  "protonmail.com",
  "proton.me",
  "gmx.com",
  "mail.com",
  "msn.com",
  "yandex.com",
  "zoho.com",
]);

const normalize = (s = "") => s.trim().toLowerCase();
const domainOf = (email = "") => {
  const parts = normalize(email).split("@");
  return parts.length === 2 ? parts[1] : "";
};
const isFreeDomain = (email = "") => FREE_EMAIL_DOMAINS.has(domainOf(email));

const recruiterSchema = Yup.object({
  firstName: Yup.string().trim().required("First name is required."),
  lastName: Yup.string().trim().required("Last name is required."),
  email: Yup.string()
    .transform((v) => normalize(v))
    .email("Invalid email address.")
    .required("Email is required.")
    .when("recruiterType", (recruiterType, schema) =>
      recruiterType === "corporate"
        ? schema.test(
            "corp-domain",
            "To post under a big brand, use your work email or request manual review.",
            (value) => !!value && !isFreeDomain(value)
          )
        : schema
    ),
  password: Yup.string()
    .min(6, "Password must be at least 6 characters.")
    .required("Password is required."),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref("password"), null], "Passwords must match.")
    .required("Please confirm your password."),
  recruiterType: Yup.string()
    .oneOf(["independent", "corporate"])
    .required("Recruiter type is required."),
});

export default function RecruiterRegistration() {
  const navigate = useNavigate();
  const base = window.location.origin;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
    reset,
  } = useForm({
    resolver: yupResolver(recruiterSchema),
    defaultValues: { recruiterType: "independent" },
    mode: "onBlur",
  });

  const recruiterType = watch("recruiterType");
  const emailWatch = watch("email") || "";

  const [toast, setToast] = useState({
    open: false,
    message: "",
    severity: "info",
    duration: 4000,
  });

  const showToast = (message, severity = "info", duration = 4000) =>
    setToast({ open: true, message, severity, duration });

  const corporateEmailLooksFree = useMemo(() => {
    return recruiterType === "corporate" && isFreeDomain(emailWatch);
  }, [recruiterType, emailWatch]);

  const onSubmit = async (data) => {
    const email = normalize(data.email);

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password: data.password,
        options: {
          emailRedirectTo: `${base}/verify-email`,
          data: {
            role: "recruiter",
            firstName: data.firstName?.trim(),
            lastName: data.lastName?.trim(),
            recruiterType: data.recruiterType,
          },
        },
      });

      if (error) {
        const msg = (error.message || "").toLowerCase();
        if (
          error.status === 400 ||
          msg.includes("already") ||
          msg.includes("exists")
        ) {
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

      const flash = "If that email exists, we’ve sent a verification link.";
      reset();
      navigate("/login", { state: { flash, severity: "success" } });
    } catch (err) {
      showToast(
        err?.message || "Registration failed. Please try again.",
        "error"
      );
    }
  };

  const handleCheckboxChange = (e) => {
    setValue("recruiterType", e.target.checked ? "corporate" : "independent");
  };

  return (
    <Container maxWidth="sm">
      <Paper elevation={5} className="glass-form register-form">
        <Typography variant="h4" align="center" gutterBottom>
          Recruiter Registration
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
            helperText={
              errors.email?.message ||
              (corporateEmailLooksFree
                ? "Looks like a personal email. Use your work email or request manual review."
                : "")
            }
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

          <FormControlLabel
            control={
              <Checkbox
                checked={recruiterType === "corporate"}
                onChange={handleCheckboxChange}
              />
            }
            label="Posting for a big brand (Walmart, LensCrafters, etc.)?"
          />

          {recruiterType === "corporate" ? (
            <Typography
              variant="caption"
              color={corporateEmailLooksFree ? "error" : "text.secondary"}
              sx={{ display: "block", mb: 1 }}
            >
              Use your work email (e.g. @walmart.com) or{" "}
              <a
                href="/manual-override"
                style={{ color: "inherit", textDecoration: "underline" }}
              >
                request manual review
              </a>
              .
            </Typography>
          ) : (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", mb: 1 }}
            >
              Independent clinics can use any email.
            </Typography>
          )}

          <Button
            type="submit"
            variant="contained"
            className="glass-button"
            fullWidth
            disabled={isSubmitting}
          >
            {isSubmitting ? "Registering..." : "Register as Recruiter"}
          </Button>
        </form>
      </Paper>

      <Snackbar
        open={toast.open}
        autoHideDuration={toast.duration}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          elevation={6}
          variant="filled"
          severity={toast.severity}
          onClose={() => setToast((t) => ({ ...t, open: false }))}
          sx={{ width: "100%" }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}
