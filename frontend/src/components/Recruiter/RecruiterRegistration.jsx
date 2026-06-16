import React, { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as Yup from "yup";
import { Link as RouterLink, useNavigate, useSearchParams } from "react-router-dom";
import {
  Container,
  Paper,
  Typography,
  Button,
  FormControlLabel,
  Checkbox,
  Snackbar,
  Alert,
  Stack,
} from "@mui/material";
import GlassTextField from "../ui/GlassTextField";
import { neonAuth, normalizeSessionResult } from "../../utils/neonAuthClient";
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

function buildVerifyPath(email, nextPath = "") {
  const params = new URLSearchParams({ email });
  if (nextPath) params.set("next", nextPath);
  return `/verify-email?${params.toString()}`;
}

async function sendSignupVerificationCode(email, emailRedirectTo) {
  const { error } = await neonAuth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo },
  });
  if (!error) return;

  const msg = String(error.message || "").toLowerCase();
  if (msg.includes("only request this after") || msg.includes("rate")) return;
  throw error;
}

function isExistingAccountError(error) {
  const msg = String(error?.message || "").toLowerCase();
  return (
    msg.includes("already") ||
    msg.includes("exists") ||
    msg.includes("registered") ||
    (error?.status === 400 && msg.includes("user"))
  );
}

function isExistingAccountResponse(result) {
  const user = result?.data?.user || result?.user || null;
  return Array.isArray(user?.identities) && user.identities.length === 0;
}

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
  const [searchParams] = useSearchParams();
  const nextPath = searchParams.get("next") || "";
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
  const [existingAccountEmail, setExistingAccountEmail] = useState("");

  const showToast = (message, severity = "info", duration = 4000) =>
    setToast({ open: true, message, severity, duration });

  const corporateEmailLooksFree = useMemo(() => {
    return recruiterType === "corporate" && isFreeDomain(emailWatch);
  }, [recruiterType, emailWatch]);

  const onSubmit = async (data) => {
    const email = normalize(data.email);
    const verifyPath = buildVerifyPath(email, nextPath);
    const emailRedirectTo = `${base}${verifyPath}`;
    setExistingAccountEmail("");
    const firstName = data.firstName?.trim();
    const lastName = data.lastName?.trim();
    const profilePayload = {
      accountRole: "recruiter",
      firstName,
      lastName,
      recruiterType: data.recruiterType,
    };

    try {
      const result = await neonAuth.signUp({
        email,
        password: data.password,
        options: {
          emailRedirectTo,
          data: {
            displayName: `${firstName} ${lastName}`.trim(),
            accountRole: profilePayload.accountRole,
            firstName: profilePayload.firstName,
            lastName: profilePayload.lastName,
            recruiterType: profilePayload.recruiterType,
          },
        },
      });
      const { error } = result;

      if (error) {
        const msg = (error.message || "").toLowerCase();
        if (isExistingAccountError(error)) {
          setExistingAccountEmail(email);
          showToast("Account already exists. Choose your next step below.", "info", 6000);
          return;
        } else if (error.status === 401 && msg.includes("failed to retrieve user session")) {
          // Some verified-email flows create the auth user but do not return a session yet.
        } else {
          throw error;
        }
      }

      if (isExistingAccountResponse(result)) {
        setExistingAccountEmail(email);
        showToast("Account already exists. Choose your next step below.", "info", 6000);
        return;
      }

      const session = normalizeSessionResult(result);
      if (session?.access_token) {
        await bootstrapProfile(session.access_token, {
          email,
          ...profilePayload,
        });
      }

      await sendSignupVerificationCode(email, emailRedirectTo);
      const flash = "Registration successful. Check your email for a 6-digit verification code.";
      reset();
      navigate(verifyPath, { state: { flash, severity: "success" } });
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
          Create Recruiter Account
        </Typography>
        <Typography variant="body2" align="center" sx={{ mb: 1.5 }}>
          Already have an account?{" "}
          <RouterLink to={`/login${emailWatch ? `?email=${encodeURIComponent(emailWatch)}` : ""}`}>
            Sign In
          </RouterLink>
        </Typography>
        <Typography variant="body2" align="center" sx={{ mb: 2 }}>
          After this, we will email a 6-digit code so you can verify your account before posting.
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

        {existingAccountEmail && (
          <Alert severity="info" sx={{ mb: 2, textAlign: "left" }}>
            <Typography fontWeight={700}>Account already exists</Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              We found an account for {existingAccountEmail}. Sign in, reset your password, or
              continue verification if you still need to enter a code.
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1.5 }}>
              <Button
                component={RouterLink}
                to={`/login?email=${encodeURIComponent(existingAccountEmail)}`}
                size="small"
                variant="contained"
              >
                Sign In
              </Button>
              <Button component={RouterLink} to="/forgot-password" size="small" variant="outlined">
                Forgot Password
              </Button>
              <Button
                component={RouterLink}
                to={buildVerifyPath(existingAccountEmail, nextPath)}
                size="small"
                variant="outlined"
              >
                Continue Verification
              </Button>
            </Stack>
          </Alert>
        )}

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
              <RouterLink
                to="/manual-override"
                style={{ color: "inherit", textDecoration: "underline" }}
              >
                request manual review
              </RouterLink>
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
            {isSubmitting ? "Creating account..." : "Create Account"}
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
