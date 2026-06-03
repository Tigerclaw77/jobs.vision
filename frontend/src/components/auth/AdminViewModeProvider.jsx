import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "./AuthProvider";

const STORAGE_KEY = "jobsVision.adminViewMode";

export const ADMIN_VIEW_MODES = {
  guest: {
    key: "guest",
    role: "guest",
    plan: "guest",
    label: "Guest",
    tooltip: "Guest",
  },
  candidate_free: {
    key: "candidate_free",
    role: "candidate",
    plan: "free",
    label: "Candidate Free",
    tooltip: "Candidate Free",
  },
  candidate_plus: {
    key: "candidate_plus",
    role: "candidate",
    plan: "plus",
    label: "Candidate Plus",
    tooltip: "Candidate Plus",
  },
  candidate_premium: {
    key: "candidate_premium",
    role: "candidate",
    plan: "premium",
    label: "Candidate Premium",
    tooltip: "Candidate Premium",
  },
  recruiter_staff: {
    key: "recruiter_staff",
    role: "recruiter",
    plan: "staff",
    label: "Recruiter Staff",
    tooltip: "Recruiter Staff",
  },
  recruiter_manager: {
    key: "recruiter_manager",
    role: "recruiter",
    plan: "manager",
    label: "Recruiter Manager",
    tooltip: "Recruiter Manager",
  },
  recruiter_doctor: {
    key: "recruiter_doctor",
    role: "recruiter",
    plan: "doctor",
    label: "Recruiter Doctor",
    tooltip: "Recruiter Doctor",
  },
  admin: {
    key: "admin",
    role: "admin",
    plan: "admin",
    label: "Admin",
    tooltip: "Admin",
  },
};

export const ADMIN_VIEW_MODE_GROUPS = [
  { label: "G", modes: ["guest"] },
  { label: "C", modes: ["candidate_free", "candidate_plus", "candidate_premium"] },
  { label: "R", modes: ["recruiter_staff", "recruiter_manager", "recruiter_doctor"] },
  { label: "A", modes: ["admin"] },
];

const AdminViewModeContext = createContext(null);

function readStoredMode() {
  if (typeof window === "undefined") return "admin";
  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    return ADMIN_VIEW_MODES[stored] ? stored : "admin";
  } catch {
    return "admin";
  }
}

function storeMode(mode) {
  if (typeof window === "undefined") return;
  try {
    if (mode === "admin") window.sessionStorage.removeItem(STORAGE_KEY);
    else window.sessionStorage.setItem(STORAGE_KEY, mode);
  } catch {}
}

export function AdminViewModeProvider({ children }) {
  const { role: realRole, loading, loadingProfile } = useAuth();
  const [mode, setModeState] = useState(() => readStoredMode());

  const isRealAdmin = String(realRole || "").toLowerCase() === "admin";

  useEffect(() => {
    if (loading || loadingProfile) return;
    if (!isRealAdmin && mode !== "admin") {
      setModeState("admin");
      storeMode("admin");
    }
  }, [isRealAdmin, loading, loadingProfile, mode]);

  const setMode = useCallback((nextMode) => {
    if (!isRealAdmin) return;
    const safeMode = ADMIN_VIEW_MODES[nextMode] ? nextMode : "admin";
    setModeState(safeMode);
    storeMode(safeMode);
  }, [isRealAdmin]);

  const activeMode = isRealAdmin ? mode : "admin";
  const config = ADMIN_VIEW_MODES[activeMode] || ADMIN_VIEW_MODES.admin;

  const value = useMemo(
    () => ({
      isRealAdmin,
      mode: activeMode,
      setMode,
      config,
      effectiveRole: config.role,
      effectivePlan: config.plan,
      viewingAs: isRealAdmin && activeMode !== "admin",
    }),
    [activeMode, config, isRealAdmin, setMode]
  );

  return (
    <AdminViewModeContext.Provider value={value}>
      {children}
    </AdminViewModeContext.Provider>
  );
}

export function useAdminViewMode() {
  const ctx = useContext(AdminViewModeContext);
  if (!ctx) throw new Error("useAdminViewMode must be used within <AdminViewModeProvider/>");
  return ctx;
}
