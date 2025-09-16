import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { logout as logoutAction } from "../store/authSlice";
import { supabase, clearAuthPersistence } from "../utils/supabaseClient";

export default function Logout() {
  const dispatch = useDispatch();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // Supabase sign-out (both scopes if supported)
        try {
          await supabase.auth.signOut({ scope: "local" });
        } catch {
          await supabase.auth.signOut();
        }
        try {
          await supabase.auth.signOut({ scope: "global" });
        } catch {
          /* ignore if not supported */
        }
      } catch {
        /* ignore */
      }

      // Reset persistence + scrub any sb-* keys from both storages
      try {
        clearAuthPersistence();
      } catch {
        /* ignore */
      }

      // Clear your Redux/app state last
      if (!cancelled) {
        dispatch(logoutAction());
        window.location.replace("/login");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <h2>You have been logged out.</h2>
      <p>Redirecting to login…</p>
    </div>
  );
}
