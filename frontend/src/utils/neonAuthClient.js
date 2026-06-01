import { createAuthClient } from "@neondatabase/auth";
import { SupabaseAuthAdapter } from "@neondatabase/auth/vanilla/adapters";

const NEON_AUTH_URL =
  process.env.REACT_APP_NEON_AUTH_URL ||
  process.env.REACT_APP_NEON_AUTH_BASE_URL ||
  "";

const missingConfigError = () =>
  new Error("Missing REACT_APP_NEON_AUTH_URL for Neon Auth.");

function unavailableAuthClient() {
  return {
    async getSession() {
      return { data: { session: null }, error: null };
    },
    async getUser() {
      return { data: { user: null }, error: null };
    },
    async signInWithPassword() {
      return { data: { user: null, session: null }, error: missingConfigError() };
    },
    async signUp() {
      return { data: { user: null, session: null }, error: missingConfigError() };
    },
    async signInWithOtp() {
      return { data: { user: null, session: null }, error: missingConfigError() };
    },
    async exchangeCodeForSession() {
      return { data: { user: null, session: null }, error: missingConfigError() };
    },
    async verifyOtp() {
      return { data: { user: null, session: null }, error: missingConfigError() };
    },
    async resetPasswordForEmail() {
      return { data: null, error: missingConfigError() };
    },
    async resend() {
      return { data: null, error: missingConfigError() };
    },
    async signOut() {
      return { error: null };
    },
    onAuthStateChange() {
      return { data: { subscription: { unsubscribe() {} } } };
    },
  };
}

export const neonAuth = NEON_AUTH_URL
  ? createAuthClient(NEON_AUTH_URL, { adapter: SupabaseAuthAdapter() })
  : unavailableAuthClient();

export function normalizeSessionResult(result) {
  return result?.data?.session || result?.session || null;
}

export function normalizeUserResult(result) {
  return result?.data?.user || result?.user || null;
}

export async function getNeonSession(options) {
  const result = await neonAuth.getSession(options);
  return { session: normalizeSessionResult(result), error: result?.error || null };
}

export async function getNeonUser() {
  const result = await neonAuth.getUser();
  return { user: normalizeUserResult(result), error: result?.error || null };
}

export async function getNeonAccessToken() {
  const { session } = await getNeonSession();
  return session?.access_token || null;
}

function asError(error, fallback) {
  if (!error) return null;
  if (error instanceof Error) return error;
  return new Error(error.message || error.code || fallback);
}

export async function verifyNeonEmailToken(token, callbackURL = window.location.origin) {
  if (!token) {
    return { session: null, error: new Error("Missing verification token.") };
  }

  const verifyEmail = neonAuth._betterAuth?.verifyEmail;
  if (typeof verifyEmail !== "function") {
    return { session: null, error: new Error("Neon email verification is unavailable.") };
  }

  const result = await verifyEmail({
    query: {
      token,
      callbackURL,
    },
  });
  const error = asError(result?.error, "Email verification failed.");
  if (error) return { session: null, error };

  const { session } = await getNeonSession({ forceFetch: true });
  return { session, error: null };
}

export async function resetNeonPassword({ newPassword, token, email, otp }) {
  if (token) {
    const resetPassword = neonAuth._betterAuth?.resetPassword;
    if (typeof resetPassword !== "function") {
      return { error: new Error("Neon password reset is unavailable.") };
    }

    const result = await resetPassword({ newPassword, token });
    return { error: asError(result?.error, "Password reset failed.") };
  }

  if (email && otp) {
    const resetPasswordWithOtp = neonAuth._betterAuth?.emailOtp?.resetPassword;
    if (typeof resetPasswordWithOtp !== "function") {
      return { error: new Error("Neon password reset OTP is unavailable.") };
    }

    const result = await resetPasswordWithOtp({
      email,
      otp,
      password: newPassword,
    });
    return { error: asError(result?.error, "Password reset failed.") };
  }

  return { error: new Error("This reset link is invalid or expired.") };
}

export function setNeonAuthPersistence(mode) {
  try {
    localStorage.setItem("rememberMe", JSON.stringify(mode === "local"));
  } catch {
    /* ignore storage failures */
  }
}

export function clearNeonAuthPersistence() {
  try {
    localStorage.removeItem("rememberMe");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("userRole");
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    sessionStorage.removeItem("userRole");
  } catch {
    /* ignore storage failures */
  }
}
