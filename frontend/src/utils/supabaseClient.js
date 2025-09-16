// src/utils/supabaseClient.js
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

function makeClient(storage) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      storage,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

// Two stable clients: sessionStorage (default) and localStorage (“Remember Me”)
const clients = {
  session: makeClient(window.sessionStorage),
  local: makeClient(window.localStorage),
};

// The client modules import
let supabase = clients.session;

/**
 * Switch where Supabase stores the session:
 *   - "session": keep user logged in across reloads; clears on browser/tab close.
 *   - "local":   keep user logged in across browser restarts (Remember Me).
 * Any other value falls back to "session".
 *
 * Call this BEFORE sign-in (your Login.jsx already does).
 */
function setAuthPersistence(mode) {
  const target = mode === "local" ? "local" : "session";
  supabase = clients[target];

  // Clean stale tokens from the other storage to avoid confusion.
  try {
    const other = target === "local" ? window.sessionStorage : window.localStorage;
    for (const k of Object.keys(other)) {
      if (k.startsWith("sb-") && k.endsWith("-auth-token")) other.removeItem(k);
    }
  } catch {}
}

/**
 * Clear any persisted Supabase tokens from BOTH storages and reset to session mode.
 * Use after sign-out to ensure a clean slate.
 */
function clearAuthPersistence() {
  try {
    for (const store of [window.localStorage, window.sessionStorage]) {
      for (const k of Object.keys(store)) {
        if (k.startsWith("sb-") && k.endsWith("-auth-token")) store.removeItem(k);
      }
    }
  } catch {}
  // Reset default client back to session-storage mode
  supabase = clients.session;
}

export { supabase, setAuthPersistence, clearAuthPersistence };
