import { supabase } from './supabaseClient';

/** Email + password login */
export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

/** Email + password signup */
export async function signup(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data.user;
}

/** Passwordless (magic link) */
export async function sendMagicLink(email) {
  const { error } = await supabase.auth.signInWithOtp({ email });
  if (error) throw error;
  return true;
}

/** Send password reset email */
export async function sendResetEmail(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw error;
  return true;
}

/** Complete password reset (called on /reset-password page) */
export async function updatePassword(newPassword) {
  const { data: { user }, error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
  return user;
}

/** Get current session */
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session || null;
}

/** Logout */
export async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
