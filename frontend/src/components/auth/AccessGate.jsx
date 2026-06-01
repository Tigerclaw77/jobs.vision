import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";

/**
 * ✅ Combined role + tier gate with support for redirect, fallback UI, and OR logic.
 *
 * Props:
 * - allowedRoles: array of roles (e.g. ["admin", "recruiter"])
 * - allowedTiers: array of tiers (e.g. ["free", "premium"])
 * - orLogic: boolean (if true, role OR tier can match)
 * - redirect: string (optional path to redirect if blocked)
 * - fallback: ReactNode (optional UI shown if blocked)
 */
const AccessGate = ({
  allowedRoles = [],
  allowedTiers = [],
  orLogic = false,
  redirect = null,
  fallback = null,
  children,
}) => {
  const { user, userRole } = useSelector((state) => state.auth);
  const role = String(user?.userRole || user?.role || user?.accountRole || userRole || "")
    .toLowerCase();
  const tier = String(user?.tier || "").toLowerCase();

  const hasRole =
    allowedRoles.length === 0 ||
    allowedRoles.map((allowedRole) => String(allowedRole).toLowerCase()).includes(role);
  const hasTier =
    allowedTiers.length === 0 ||
    allowedTiers.map((allowedTier) => String(allowedTier).toLowerCase()).includes(tier);

  const isAllowed = orLogic ? hasRole || hasTier : hasRole && hasTier;

  if (!isAllowed) {
    if (redirect) return <Navigate to={redirect} replace />;
    if (fallback) return fallback;
    return null;
  }

  return children;
};

/**
 * Aliases for backward compatibility or readability
 */
export const RoleOnly = ({ role, ...props }) => (
  <AccessGate allowedRoles={[role]} {...props} />
);

export const RoleOnlyMulti = ({ roles, ...props }) => (
  <AccessGate allowedRoles={roles} {...props} />
);

export const TierOnly = ({ tier, ...props }) => (
  <AccessGate allowedTiers={[tier]} {...props} />
);

export const TierOnlyMulti = ({ tiers, ...props }) => (
  <AccessGate allowedTiers={tiers} {...props} />
);

export default AccessGate;
