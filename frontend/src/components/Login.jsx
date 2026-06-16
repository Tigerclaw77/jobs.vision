// src/components/Login.jsx
import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as Yup from "yup";
import { useDispatch } from "react-redux";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { login as loginRedux } from "../store/authSlice";
import { fetchUserJobData } from "../store/jobSlice";
import { getRoleTier } from "../utils/getRoleTier";
import { useAuth } from "./auth/AuthProvider";
import GlassTextField from "../components/ui/GlassTextField";
import {
  Button,
  FormControlLabel,
  Checkbox,
  Paper,
  Container,
  Typography,
  Stack,
  Alert,
} from "@mui/material";
import {
  getNeonSession,
  getNeonUser,
  neonAuth,
  normalizeSessionResult,
  setNeonAuthPersistence,
} from "../utils/neonAuthClient";
import "../styles/forms.css";

// Validation
const passwordSchema = Yup.object().shape({
  email: Yup.string().email("Invalid email").required("Email is required"),
  password: Yup.string().required("Password is required"),
});

const DEFAULT_COOLDOWN = 60;
const parseCooldownSeconds = (msg) => {
  if (!msg) return null;
  const m = String(msg).match(/after\s+(\d+)\s*seconds?/i);
  return m ? parseInt(m[1], 10) : null;
};

const normalizeEmail = (value = "") => String(value).trim().toLowerCase();
const normalizeCode = (value = "") => String(value).replace(/\D/g, "").slice(0, 6);

const isUnverifiedEmailError = (message = "") =>
  /email.*(not confirmed|not verified|unconfirmed)|not confirmed|not verified|confirm your email|verify your email/i.test(
    String(message)
  );

const pathForRole = (role) => {
  const r = String(role || "").toLowerCase();
  if (!r) return "/profile";
  return r === "admin"
    ? "/admin"
    : r === "recruiter"
    ? "/recruiter/dashboard"
    : "/candidate/dashboard";
};

// Only honor ?next= if it aligns with the user’s role
const chooseDest = (role, next) => {
  const r = String(role || "").toLowerCase();
  if (next) {
    if (r === "admin" && next.startsWith("/admin")) return next;
    if (r === "admin" && next.startsWith("/claim-listing/")) return next;
    if (r === "recruiter" && next.startsWith("/recruiter")) return next;
    if (r === "recruiter" && next.startsWith("/claim-listing/")) return next;
    if (r === "candidate" && next.startsWith("/candidate")) return next;
  }
  return pathForRole(r);
};

export default function Login() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    session: activeSession,
    user: activeUser,
    account: activeAccount,
    profile: activeProfile,
    role: activeRole,
    loading: authLoading,
    loadingProfile,
    refreshAuth,
  } = useAuth();
  const nextPath = searchParams.get("next") || null;

  const [formError, setFormError] = useState("");
  const [infoMsg, setInfoMsg] = useState("");
  const [sendingSignInCode, setSendingSignInCode] = useState(false);
  const [verifyingSignInCode, setVerifyingSignInCode] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [canResendVerify, setCanResendVerify] = useState(false);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState("");

  const [signInCodeMode, setSignInCodeMode] = useState(false);
  const [signInCodeEmail, setSignInCodeEmail] = useState("");
  const [signInCode, setSignInCode] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  // gate rendering while we check if already authed (prevents “login screen while logged in”)
  const [redirecting, setRedirecting] = useState(true);

  const base = window.location.origin;

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors },
    watch,
  } = useForm({ resolver: yupResolver(passwordSchema) });

  const email = watch("email", "");
  const rememberMe = watch("rememberMe", false);

  useEffect(() => {
    try {
      localStorage.setItem("rememberMe", JSON.stringify(!!rememberMe));
    } catch {}
  }, [rememberMe]);

  const isValidEmail = (v) => /^\S+@\S+\.\S+$/.test(String(v || "").trim());

  useEffect(() => {
    if (!resendCooldown) return;
    const t = setInterval(() => setResendCooldown((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  // If a real session already exists, leave /login immediately.
  // Admin View Mode may preview guest UI, but it must not make an
  // authenticated user eligible to see a public-only auth page.
  useEffect(() => {
    if (authLoading || (activeSession && loadingProfile && !activeRole)) {
      setRedirecting(true);
      return;
    }

    if (activeSession && activeRole) {
      navigate(chooseDest(activeRole, nextPath), { replace: true });
      return;
    }

    if (activeSession && !activeRole) {
      navigate("/unauthorized", {
        replace: true,
        state: {
          authDebug: {
            authenticatedUserId:
              activeProfile?.id ||
              activeAccount?.profile?.id ||
              activeAccount?.id ||
              activeUser?.id ||
              null,
            authenticatedEmail:
              activeProfile?.email ||
              activeAccount?.profile?.email ||
              activeAccount?.email ||
              activeUser?.email ||
              null,
            authenticatedRole: null,
            route: "/login",
            requiredRoles: ["known authenticated role"],
            requiredTiers: [],
            authorizationResult: "missing_role",
          },
        },
      });
      return;
    }

    setRedirecting(false);
  }, [
    authLoading,
    activeSession,
    loadingProfile,
    activeRole,
    activeProfile,
    activeAccount,
    activeUser,
    navigate,
    nextPath,
  ]);

  const bootstrapReduxAfterSignIn = async (session) => {
    const refreshed = await refreshAuth(session);
    const { user: neonUser } = await getNeonUser();
    const currentSession = refreshed.session || (await getNeonSession()).session;
    const user = currentSession?.user ?? session?.user ?? neonUser;

    const { role, tier, entitlements } = await getRoleTier({
      account: refreshed.account,
      user,
      session: currentSession,
    });

    dispatch(
      loginRedux({
        userRole: role,
        user: {
          id: user?.id || null,
          email: user?.email || null,
          isVerified: !!user?.email_confirmed_at,
          userRole: role,
          tier,
          entitlements,
          ...(user?.user_metadata || {}),
        },
      })
    );

    dispatch(
      fetchUserJobData({
        savedJobs: [],
        appliedJobs: [],
        recruiterJobs: [],
        hiddenJobs: [],
      })
    );

    const destination = chooseDest(role, nextPath);
    // Go to intended destination or per-role default.
    navigate(destination, { replace: true });
  };

  // ---- Password login
  const onPasswordLogin = async ({ email, password }) => {
    setFormError("");
    setInfoMsg("");
    setCanResendVerify(false);
    setPendingVerificationEmail("");
    setSignInCodeMode(false);
    setSignInCode("");
    clearErrors();
    setSigningIn(true);
    try {
      // set persistence BEFORE sign-in (Remember Me)
      setNeonAuthPersistence(rememberMe ? "local" : "session");

      const loginEmail = normalizeEmail(email);
      const { data, error } = await neonAuth.signInWithPassword({
        email: loginEmail,
        password,
      });
      if (error) throw error;

      await bootstrapReduxAfterSignIn(data?.session || normalizeSessionResult({ data }));
    } catch (err) {
      const msg = err?.message || "Login failed. Please try again.";
      const loginEmail = normalizeEmail(email);

      if (isUnverifiedEmailError(msg)) {
        setCanResendVerify(true);
        setPendingVerificationEmail(loginEmail);
        setFormError("Your email has not been verified yet.");
      } else if (/password|credentials/i.test(msg)) {
        setError("password", { type: "manual", message: "Invalid email or password." });
      } else {
        setFormError(msg);
      }
    } finally {
      setSigningIn(false);
    }
  };

  const handleOtpResponse = (error, successText) => {
    const raw = error?.message || "";
    const lowered = raw.toLowerCase();

    if (error && (lowered.includes("only request this after") || lowered.includes("rate"))) {
      const secs = parseCooldownSeconds(raw) ?? DEFAULT_COOLDOWN;
      setFormError(`For security purposes, you can only request this after ${secs} seconds.`);
      setInfoMsg("");
      setResendCooldown(secs);
      return;
    }

    if (
      error &&
      (error.status === 400 ||
        lowered.includes("not found") ||
        lowered.includes("no user") ||
        lowered.includes("already"))
    ) {
      setFormError("");
      setInfoMsg(successText);
      setResendCooldown(DEFAULT_COOLDOWN);
      return;
    }

    if (error) throw error;

    setFormError("");
    setInfoMsg(successText);
    setResendCooldown(DEFAULT_COOLDOWN);
  };

  // ---- Email sign-in code
  const sendSignInCode = async () => {
    setFormError("");
    setInfoMsg("");
    setCanResendVerify(false);
    setPendingVerificationEmail("");
    setSignInCode("");
    clearErrors();

    if (!isValidEmail(email)) {
      setError("email", { type: "manual", message: "Please enter a valid email" });
      return;
    }

    const loginEmail = normalizeEmail(email);
    setSendingSignInCode(true);
    try {
      setNeonAuthPersistence(rememberMe ? "local" : "session");

      const { error } = await neonAuth.signInWithOtp({
        email: loginEmail,
        options: {
          emailRedirectTo: `${base}/login`,
          shouldCreateUser: false,
        },
      });

      setSignInCodeEmail(loginEmail);
      setSignInCodeMode(true);
      handleOtpResponse(
        error,
        "Enter the code sent to your email."
      );
    } catch (err) {
      setFormError(err?.message || "Could not send the sign-in code.");
    } finally {
      setSendingSignInCode(false);
    }
  };

  const resendSignInCode = async () => {
    const targetEmail = signInCodeEmail || normalizeEmail(email);
    if (!isValidEmail(targetEmail) || resendCooldown > 0) return;
    setFormError("");
    clearErrors();
    try {
      setNeonAuthPersistence(rememberMe ? "local" : "session");
      const { error } = await neonAuth.signInWithOtp({
        email: targetEmail,
        options: {
          emailRedirectTo: `${base}/login`,
          shouldCreateUser: false,
        },
      });
      handleOtpResponse(error, "Enter the new code sent to your email.");
    } catch (err) {
      setFormError(err?.message || "Could not resend the code.");
    }
  };

  const verifySignInCode = async (event) => {
    event.preventDefault();
    const targetEmail = signInCodeEmail || normalizeEmail(email);
    const token = normalizeCode(signInCode);

    setFormError("");
    setInfoMsg("");
    clearErrors();

    if (!isValidEmail(targetEmail)) {
      setFormError("Request a new sign-in code with a valid email address.");
      return;
    }

    if (token.length !== 6) {
      setFormError("Enter the 6-digit sign-in code.");
      return;
    }

    setVerifyingSignInCode(true);
    try {
      setNeonAuthPersistence(rememberMe ? "local" : "session");
      const result = await neonAuth.verifyOtp({
        type: "email",
        email: targetEmail,
        token,
      });
      if (result?.error) throw result.error;

      let session = normalizeSessionResult(result);
      if (!session?.access_token) {
        const refreshed = await getNeonSession({ forceFetch: true });
        session = refreshed.session || session;
      }

      await bootstrapReduxAfterSignIn(session);
    } catch (err) {
      const msg = err?.message || "Could not verify the sign-in code.";
      if (isUnverifiedEmailError(msg)) {
        setCanResendVerify(true);
        setPendingVerificationEmail(targetEmail);
        setFormError("Your email has not been verified yet.");
      } else if (/expired/i.test(msg)) {
        setFormError("That sign-in code has expired. Request a new code and try again.");
      } else if (/invalid|otp|token|code/i.test(msg)) {
        setFormError("That sign-in code is invalid. Check the code and try again.");
      } else {
        setFormError(msg);
      }
    } finally {
      setVerifyingSignInCode(false);
    }
  };

  const usePasswordMode = () => {
    setSignInCodeMode(false);
    setSignInCode("");
    setFormError("");
    setInfoMsg("");
    clearErrors();
  };

  const resendVerification = async () => {
    try {
      const targetEmail = pendingVerificationEmail || normalizeEmail(email);
      const { error } = await neonAuth.resend({
        type: "signup",
        email: targetEmail,
        options: { emailRedirectTo: `${base}/verify-email?email=${encodeURIComponent(targetEmail)}` },
      });
      if (error) throw error;
      setFormError("");
      setInfoMsg("We sent a verification code.");
    } catch (err) {
      setFormError(err?.message || "Could not resend the verification code.");
    }
  };

  const resendButtonLabel = resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend Code";

  // Don’t render the login form while we’re about to redirect
  if (redirecting) return null;

  return (
    <Container maxWidth="sm">
      <Paper elevation={5} className="glass-form login-form">
        <Typography variant="h4" align="center" gutterBottom>
          Log In
        </Typography>

        {formError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {formError}
          </Alert>
        )}
        {infoMsg && (
          <Alert severity="info" sx={{ mb: 2 }}>
            {infoMsg}
          </Alert>
        )}

        {!signInCodeMode && (
          <form onSubmit={handleSubmit(onPasswordLogin)} noValidate>
            <GlassTextField
              label="Email"
              type="email"
              {...register("email")}
              error={!!errors.email}
              helperText={errors.email?.message}
              className="full-width"
              variant="outlined"
              margin="normal"
            />

            <GlassTextField
              label="Password"
              type="password"
              {...register("password")}
              error={!!errors.password}
              helperText={errors.password?.message}
              className="full-width"
              variant="outlined"
              margin="normal"
            />

            <FormControlLabel
              control={<Checkbox {...register("rememberMe")} />}
              label="Remember Me"
              sx={{ color: "white" }}
            />

            {canResendVerify && (
              <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 1 }}>
                <Button
                  size="small"
                  onClick={() => {
                    const targetEmail = pendingVerificationEmail || normalizeEmail(email);
                    navigate(`/verify-email?email=${encodeURIComponent(targetEmail)}`);
                  }}
                >
                  Continue Verification
                </Button>
                <Button size="small" onClick={resendVerification}>
                  Resend Code
                </Button>
              </Stack>
            )}

            <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 2 }}>
              <Button type="submit" variant="contained" className="glass-button" disabled={signingIn}>
                {signingIn ? "Logging in…" : "Log In"}
              </Button>

              <Button
                type="button"
                variant="contained"
                onClick={sendSignInCode}
                disabled={sendingSignInCode}
                sx={{
                  bgcolor: "#ffffff",
                  color: "#0f172a",
                  border: "1px solid #e5e7eb",
                  "&:hover": { bgcolor: "#f8fafc" },
                }}
              >
                {sendingSignInCode ? "Sending..." : "Send Sign-in Code"}
              </Button>
            </Stack>

            <Typography variant="body2" align="center" sx={{ mt: 1.5 }}>
              <Link to="/forgot-password" style={{ textDecoration: "none", color: "#90caf9" }}>
                Forgot Password?
              </Link>
            </Typography>
          </form>
        )}

        {signInCodeMode && (
          <form onSubmit={verifySignInCode} noValidate>
            <Stack spacing={2} alignItems="stretch" sx={{ mt: 2 }}>
              <Typography align="center">
                Enter the code sent to your email
              </Typography>

              <Typography align="center" fontWeight={700}>
                {signInCodeEmail}
              </Typography>

              <GlassTextField
                label="Code"
                value={signInCode}
                onChange={(event) => setSignInCode(normalizeCode(event.target.value))}
                inputProps={{ inputMode: "numeric", pattern: "[0-9]*", maxLength: 6 }}
                className="full-width"
                variant="outlined"
                margin="normal"
              />

              {canResendVerify && (
                <Stack direction="row" spacing={1} justifyContent="center">
                  <Button
                    size="small"
                    onClick={() => {
                      const targetEmail = pendingVerificationEmail || signInCodeEmail;
                      navigate(`/verify-email?email=${encodeURIComponent(targetEmail)}`);
                    }}
                  >
                    Continue Verification
                  </Button>
                  <Button size="small" onClick={resendVerification}>
                    Resend Code
                  </Button>
                </Stack>
              )}

              <Stack direction="row" spacing={2} justifyContent="center">
                <Button
                  type="submit"
                  variant="contained"
                  className="glass-button"
                  disabled={verifyingSignInCode}
                >
                  {verifyingSignInCode ? "Verifying..." : "Verify"}
                </Button>

                <Button
                  type="button"
                  variant="contained"
                  onClick={resendSignInCode}
                  disabled={!isValidEmail(signInCodeEmail) || resendCooldown > 0}
                  sx={{
                    bgcolor:
                      !isValidEmail(signInCodeEmail) || resendCooldown > 0
                        ? "#e5e7eb"
                        : "#ffffff",
                    color: "#0f172a",
                    border: "1px solid #e5e7eb",
                    "&:hover": { bgcolor: "#f8fafc" },
                  }}
                >
                  {resendButtonLabel}
                </Button>
              </Stack>

              <Button type="button" variant="text" onClick={usePasswordMode}>
                Use password instead
              </Button>
            </Stack>
          </form>
        )}
      </Paper>
    </Container>
  );
}
