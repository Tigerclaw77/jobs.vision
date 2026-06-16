// frontend/src/pages/VerifyEmail.jsx
import React, { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Alert,
  Button,
  CircularProgress,
  Container,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useDispatch } from "react-redux";
import {
  getNeonSession,
  neonAuth,
  normalizeSessionResult,
  verifyNeonEmailToken,
} from "../utils/neonAuthClient";
import { login as loginRedux } from "../store/authSlice";
import { useAuth } from "./auth/AuthProvider";
import GlassTextField from "./ui/GlassTextField";

function apiBaseUrl() {
  const raw = (process.env.REACT_APP_API_URL || "http://localhost:5000/api").replace(/\/+$/, "");
  return raw.endsWith("/api") ? raw : `${raw}/api`;
}

function redirectForRole(role) {
  if (role === "admin") return "/admin";
  if (role === "recruiter") return "/recruiter/dashboard";
  return "/candidate/dashboard";
}

async function fetchMe(accessToken) {
  const res = await fetch(`${apiBaseUrl()}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Profile lookup failed");
  return res.json();
}

function getParam(name) {
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams((window.location.hash || "").replace(/^#/, ""));
  return search.get(name) || hash.get(name);
}

function normalizeEmail(value = "") {
  return String(value).trim().toLowerCase();
}

function normalizeCode(value = "") {
  return String(value).replace(/\D/g, "").slice(0, 6);
}

function otpErrorMessage(err) {
  const msg = String(err?.message || "").toLowerCase();
  if (msg.includes("expired")) {
    return "That verification code has expired. Request a new code and try again.";
  }
  if (
    msg.includes("invalid") ||
    msg.includes("otp") ||
    msg.includes("token") ||
    msg.includes("code")
  ) {
    return "That verification code is invalid. Check the code and try again.";
  }
  return err?.message || "Verification failed. Request a new code and try again.";
}

export default function VerifyEmail() {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { refreshAuth } = useAuth();
  const initialEmail = normalizeEmail(getParam("email") || "");
  const [phase, setPhase] = useState(initialEmail ? "otp" : "loading");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState(initialEmail);
  const [emailLocked, setEmailLocked] = useState(Boolean(initialEmail));
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [status, setStatus] = useState(() => {
    const flash = location.state?.flash;
    if (!flash) return null;
    return { severity: location.state?.severity || "info", message: flash };
  });

  const hydrateAndRedirect = useCallback(
    async (session, fallbackMessage) => {
      let activeSession = session;
      if (!activeSession?.access_token) {
        const refreshedSession = await getNeonSession({ forceFetch: true }).catch(() => ({}));
        activeSession = refreshedSession.session || activeSession;
      }

      if (!activeSession?.access_token) {
        setPhase("success");
        setMessage(fallbackMessage || "Email verified. You can log in now.");
        return;
      }

      const refreshed = await refreshAuth(activeSession);
      const currentSession = refreshed.session || activeSession;
      const me = refreshed.account || (await fetchMe(currentSession.access_token));
      const role =
        me.role ||
        me.profile?.role ||
        currentSession.user?.user_metadata?.accountRole ||
        currentSession.user?.user_metadata?.userRole ||
        currentSession.user?.user_metadata?.role ||
        "candidate";

      dispatch(
        loginRedux({
          userRole: role,
          user: {
            ...me,
            ...(currentSession.user?.user_metadata || {}),
            userRole: role,
            isVerified: true,
          },
        })
      );
      setPhase("success");
      setMessage("Email verified. Redirecting...");
      setTimeout(() => {
        navigate(redirectForRole(role), { replace: true });
      }, 600);
    },
    [dispatch, navigate, refreshAuth]
  );

  useEffect(() => {
    let mounted = true;

    (async () => {
      const emailParam = normalizeEmail(getParam("email") || "");
      if (emailParam) {
        if (!mounted) return;
        setEmail(emailParam);
        setEmailLocked(true);
        setPhase("otp");
        return;
      }

      const errorDescription =
        getParam("error_description") || getParam("error") || getParam("message");
      if (errorDescription) {
        if (!mounted) return;
        setPhase("error");
        setMessage(errorDescription);
        return;
      }

      const verificationToken =
        getParam("token") || getParam("token_hash") || getParam("verification_token");
      const authCode = getParam("code");

      try {
        if (verificationToken) {
          const { session, error } = await verifyNeonEmailToken(
            verificationToken,
            `${window.location.origin}/login`
          );
          if (error) throw error;
          await hydrateAndRedirect(session, "Email verified. You can log in now.");
          return;
        }

        if (authCode) {
          const result = await neonAuth.exchangeCodeForSession(window.location.href);
          const session = normalizeSessionResult(result);
          if (result?.error) throw result.error;
          await hydrateAndRedirect(session, "Email verified. You can log in now.");
          return;
        }

        if (!mounted) return;
        setEmailLocked(false);
        setPhase("otp");
      } catch (err) {
        if (!mounted) return;
        setPhase("error");
        setMessage(err?.message || "This verification code is invalid or has expired.");
      }
    })();

    return () => {
      mounted = false;
    };
  }, [hydrateAndRedirect]);

  const handleVerify = async (event) => {
    event.preventDefault();
    const normalizedEmail = normalizeEmail(email);
    const token = normalizeCode(code);

    if (!normalizedEmail) {
      setStatus({ severity: "error", message: "Enter the email address you used to register." });
      return;
    }
    if (token.length !== 6) {
      setStatus({ severity: "error", message: "Enter the 6-digit verification code." });
      return;
    }

    setVerifying(true);
    setStatus(null);
    try {
      const result = await neonAuth.verifyOtp({
        type: "signup",
        email: normalizedEmail,
        token,
      });
      if (result?.error) throw result.error;
      let session = normalizeSessionResult(result);
      if (!session?.access_token) {
        const refreshed = await getNeonSession({ forceFetch: true });
        session = refreshed.session || session;
      }
      await hydrateAndRedirect(session, "Email verified. You can log in now.");
    } catch (err) {
      setStatus({ severity: "error", message: otpErrorMessage(err) });
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      setStatus({ severity: "error", message: "Enter your email address before requesting a code." });
      return;
    }

    setResending(true);
    setStatus(null);
    try {
      const { error } = await neonAuth.resend({
        type: "signup",
        email: normalizedEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/verify-email?email=${encodeURIComponent(normalizedEmail)}`,
        },
      });
      if (error) throw error;
      setStatus({ severity: "success", message: "We sent a new verification code." });
    } catch (err) {
      setStatus({
        severity: "error",
        message: err?.message || "Could not send a new verification code. Try again shortly.",
      });
    } finally {
      setResending(false);
    }
  };

  const handleChangeEmail = () => {
    setEmail("");
    setEmailLocked(false);
    setCode("");
    setStatus({
      severity: "info",
      message: "Enter the email you used to register, then request a new code if needed.",
    });
  };

  return (
    <Container maxWidth="sm">
      <Paper elevation={5} className="glass-form" style={{ textAlign: "center" }}>
        <Typography variant="h4" gutterBottom>
          Verify Your Email
        </Typography>

        {phase === "loading" && (
          <Typography sx={{ my: 2 }}>
            <CircularProgress />
          </Typography>
        )}

        {phase === "otp" && (
          <form onSubmit={handleVerify} noValidate>
            <Stack spacing={2} alignItems="stretch">
              <Alert severity="info" sx={{ textAlign: "left" }}>
                Check your email for a 6-digit verification code. Delivery can take a few
                minutes, and the code may land in spam or promotions.
              </Alert>

              <Typography>Enter the verification code sent to:</Typography>

              {emailLocked ? (
                <Stack spacing={0.5} alignItems="center">
                  <Typography fontWeight={700}>{email || "your email address"}</Typography>
                  <Button type="button" variant="text" size="small" onClick={handleChangeEmail}>
                    Change Email
                  </Button>
                </Stack>
              ) : (
                <GlassTextField
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(normalizeEmail(event.target.value))}
                  fullWidth
                  variant="outlined"
                  helperText="Use the same email address you entered during registration."
                />
              )}

              <Typography variant="body2" color="text.secondary">
                If no code arrives, wait a minute, confirm the email above, then use Resend
                Code. Contact support if repeated resend attempts still do not arrive.
              </Typography>

              <GlassTextField
                label="Code"
                value={code}
                onChange={(event) => setCode(normalizeCode(event.target.value))}
                inputProps={{ inputMode: "numeric", pattern: "[0-9]*", maxLength: 6 }}
                fullWidth
                variant="outlined"
              />

              {status && <Alert severity={status.severity}>{status.message}</Alert>}

              <Button
                type="submit"
                variant="contained"
                className="glass-button"
                disabled={verifying}
              >
                {verifying ? "Verifying..." : "Verify"}
              </Button>

              <Button
                type="button"
                variant="outlined"
                className="glass-button"
                disabled={resending}
                onClick={handleResend}
              >
                {resending ? "Sending..." : "Resend Code"}
              </Button>
            </Stack>
          </form>
        )}

        {(phase === "success" || phase === "error") && (
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
