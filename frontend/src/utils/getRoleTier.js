// src/utils/getRoleTier.js
import { supabase } from "./supabaseClient";

/**
 * Try metadata first, then profiles by id, then by email.
 * Do NOT silently default to "candidate" if we can't read yet.
 */
export async function getRoleTier() {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user || null;
  if (!user) return { role: null, tier: null, user };

  let role = user.user_metadata?.role || null;
  let tier = user.user_metadata?.tier || null;

  // profiles by id (preferred)
  if (!role) {
    const { data, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (!error && data?.role) role = data.role;
  }

  // fallback: profiles by email if id select didn’t return
  if (!role) {
    const { data, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("email", user.email)
      .single();
    if (!error && data?.role) role = data.role;
  }

  // DON'T force "candidate" here; let caller decide
  return { role, tier: tier || null, user };
}
