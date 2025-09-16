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
import { supabase, setAuthPersistence } from "../utils/supabaseClient";
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
    if (r === "recruiter" && next.startsWith("/recruiter")) return next;
    if (r === "candidate" && next.startsWith("/candidate")) return next;
  }
  return pathForRole(r);
};

export default function Login() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nextPath = searchParams.get("next") || null;

  const [formError, setFormError] = useState("");
  const [infoMsg, setInfoMsg] = useState("");
  const [sendingMagic, setSendingMagic] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [canResendVerify, setCanResendVerify] = useState(false);

  const [magicMode, setMagicMode] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // gate rendering while we check if already authed (prevents “login screen while logged in”)
  const [redirecting, setRedirecting] = useState(true);

  const base = window.location.origin;

  const {
    register,
    handleSubmit,
    setError,
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

  // 🔁 If a session already exists (or appears), leave /login immediately.
  useEffect(() => {
    let mounted = true;

    const redirectIfAuthed = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (data?.session) {
        const { role } = await getRoleTier();
        navigate(chooseDest(role, nextPath), { replace: true });
        return;
      }
      setRedirecting(false); // only render form when truly signed out
    };

    redirectIfAuthed();

    const sub = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) redirectIfAuthed();
    });

    const onPageShow = () => redirectIfAuthed(); // handles browser back/forward cache
    window.addEventListener("pageshow", onPageShow);

    return () => {
      mounted = false;
      sub.data?.subscription?.unsubscribe?.();
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [navigate, nextPath]);

  const bootstrapReduxAfterSignIn = async (session) => {
    const user = session?.user ?? (await supabase.auth.getUser()).data?.user;
    const token =
      session?.access_token || (await supabase.auth.getSession()).data?.session?.access_token;

    const { role, tier } = await getRoleTier();

    dispatch(
      loginRedux({
        token: token || null,
        userRole: role,
        user: {
          id: user?.id || null,
          email: user?.email || null,
          isVerified: !!user?.email_confirmed_at,
          tier,
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

    // 🚪 Go to intended destination or per-role default (admin → /admin)
    navigate(chooseDest(role, nextPath), { replace: true });
  };

  // ---- Password login
  const onPasswordLogin = async ({ email, password }) => {
    setFormError("");
    setInfoMsg("");
    setCanResendVerify(false);
    setSigningIn(true);
    try {
      // set persistence BEFORE sign-in (Remember Me)
      setAuthPersistence(rememberMe ? "local" : "none");

      const { data, error } = await supabase.auth.signInWithPassword({
        email: String(email).trim().toLowerCase(),
        password,
      });
      if (error) throw error;

      await bootstrapReduxAfterSignIn(data.session);
    } catch (err) {
      const msg = err?.message || "Login failed. Please try again.";
      if (/confirm|verified|not confirmed/i.test(msg)) setCanResendVerify(true);
      if (/password|credentials/i.test(msg)) {
        setError("password", { type: "manual", message: msg });
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

  // ---- Magic link
  const sendMagicLink = async () => {
    setFormError("");
    setInfoMsg("");

    if (!isValidEmail(email)) {
      setError("email", { type: "manual", message: "Please enter a valid email" });
      return;
    }

    setSendingMagic(true);
    try {
      // respect Remember Me for OTP return
      setAuthPersistence(rememberMe ? "local" : "none");

      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          emailRedirectTo: `${base}/verify-email`,
          shouldCreateUser: false,
        },
      });

      setMagicMode(true);
      handleOtpResponse(
        error,
        "If an account exists for that email, please check your inbox (and spam folder) shortly for a sign-in link."
      );
    } catch (err) {
      setFormError(err?.message || "Couldn't send the magic link.");
    } finally {
      setSendingMagic(false);
    }
  };

  const resendMagicLink = async () => {
    if (!isValidEmail(email) || resendCooldown > 0) return;
    try {
      setAuthPersistence(rememberMe ? "local" : "none");
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          emailRedirectTo: `${base}/verify-email`,
          shouldCreateUser: false,
        },
      });
      handleOtpResponse(error, "We’ve re-sent your sign-in link.");
    } catch (err) {
      setFormError(err?.message || "Couldn't resend the link.");
    }
  };

  const resendVerification = async () => {
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: String(email).trim().toLowerCase(),
        options: { emailRedirectTo: `${base}/verify-email` },
      });
      if (error) throw error;
      setInfoMsg("We’ve sent a verification email.");
    } catch (err) {
      setFormError(err?.message || "Could not resend verification email.");
    }
  };

  const magicButtonLabel = resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend Magic Link";

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

        {!magicMode && (
          <form onSubmit={handleSubmit(onPasswordLogin)} noValidate>
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
              <Typography align="center" sx={{ mt: 1 }}>
                <Button size="small" onClick={resendVerification}>
                  Resend verification email
                </Button>
              </Typography>
            )}

            <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 2 }}>
              <Button type="submit" variant="contained" className="glass-button" disabled={signingIn}>
                {signingIn ? "Logging in…" : "Log In"}
              </Button>

              <Button
                type="button"
                variant="contained"
                onClick={sendMagicLink}
                disabled={sendingMagic}
                sx={{
                  bgcolor: "#ffffff",
                  color: "#0f172a",
                  border: "1px solid #e5e7eb",
                  "&:hover": { bgcolor: "#f8fafc" },
                }}
              >
                {sendingMagic ? "Sending…" : "Send Magic Link"}
              </Button>
            </Stack>

            <Typography variant="body2" align="center" sx={{ mt: 1.5 }}>
              <Link to="/forgot-password" style={{ textDecoration: "none", color: "#90caf9" }}>
                Forgot Password?
              </Link>
            </Typography>
          </form>
        )}

        {magicMode && (
          <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 2 }}>
            <Button
              type="button"
              variant="contained"
              onClick={resendMagicLink}
              disabled={!isValidEmail(email) || resendCooldown > 0}
              sx={{
                bgcolor: !isValidEmail(email) || resendCooldown > 0 ? "#e5e7eb" : "#ffffff",
                color: "#0f172a",
                border: "1px solid #e5e7eb",
                "&:hover": { bgcolor: "#f8fafc" },
              }}
            >
              {magicButtonLabel}
            </Button>
          </Stack>
        )}
      </Paper>
    </Container>
  );
}
