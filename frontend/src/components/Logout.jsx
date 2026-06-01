import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { logout as logoutAction } from "../store/authSlice";
import { clearNeonAuthPersistence, neonAuth } from "../utils/neonAuthClient";

export default function Logout() {
  const dispatch = useDispatch();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await neonAuth.signOut();
      } catch {
        /* ignore */
      }

      try {
        clearNeonAuthPersistence();
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
