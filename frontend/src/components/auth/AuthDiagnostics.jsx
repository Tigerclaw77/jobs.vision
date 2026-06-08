import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { useAuth } from "./AuthProvider";
import "./AuthDiagnostics.css";

const AuthDiagnosticsContext = createContext(null);

function authIdentity(auth) {
  const metadata = {
    ...(auth.user?.app_metadata || {}),
    ...(auth.user?.user_metadata || {}),
  };

  const role = String(
    auth.role ||
      auth.profile?.role ||
      auth.account?.profile?.role ||
      auth.account?.role ||
      metadata.role ||
      metadata.accountRole ||
      metadata.userRole ||
      ""
  ).toLowerCase();

  return {
    id:
      auth.profile?.id ||
      auth.account?.profile?.id ||
      auth.account?.id ||
      auth.user?.id ||
      null,
    email:
      auth.profile?.email ||
      auth.account?.profile?.email ||
      auth.account?.email ||
      auth.user?.email ||
      null,
    role: role || null,
  };
}

function formatList(value, fallback = "None") {
  if (Array.isArray(value) && value.length) return value.join(", ");
  if (value) return String(value);
  return fallback;
}

export function AuthDiagnosticsProvider({ children }) {
  const [lastCheck, setLastCheck] = useState(null);

  const setAuthCheck = useCallback((nextCheck) => {
    setLastCheck({
      evaluatedAt: new Date().toISOString(),
      ...nextCheck,
    });
  }, []);

  const value = useMemo(
    () => ({ lastCheck, setAuthCheck }),
    [lastCheck, setAuthCheck]
  );

  return (
    <AuthDiagnosticsContext.Provider value={value}>
      {children}
    </AuthDiagnosticsContext.Provider>
  );
}

export function useAuthDiagnostics() {
  const context = useContext(AuthDiagnosticsContext);
  if (!context) {
    return {
      lastCheck: null,
      setAuthCheck: () => {},
    };
  }
  return context;
}

export function AdminAuthDiagnosticsPanel() {
  const auth = useAuth();
  const { lastCheck } = useAuthDiagnostics();
  const identity = authIdentity(auth);

  if (identity.role !== "admin") return null;

  return (
    <aside className="auth-diagnostics-panel" aria-label="Admin auth diagnostics">
      <details>
        <summary>Auth diagnostics</summary>
        <dl>
          <div>
            <dt>User id</dt>
            <dd>{lastCheck?.authenticatedUserId || identity.id || "Unknown"}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{lastCheck?.authenticatedEmail || identity.email || "Unknown"}</dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>{lastCheck?.authenticatedRole || identity.role || "Unknown"}</dd>
          </div>
          <div>
            <dt>Route</dt>
            <dd>{lastCheck?.route || "No protected route evaluated yet"}</dd>
          </div>
          <div>
            <dt>Required role(s)</dt>
            <dd>{formatList(lastCheck?.requiredRoles, "Authenticated user")}</dd>
          </div>
          <div>
            <dt>Required tier(s)</dt>
            <dd>{formatList(lastCheck?.requiredTiers)}</dd>
          </div>
          <div>
            <dt>Result</dt>
            <dd>{lastCheck?.authorizationResult || "Not evaluated"}</dd>
          </div>
        </dl>
      </details>
    </aside>
  );
}
