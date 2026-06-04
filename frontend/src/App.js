// App.jsx
import React, { useEffect } from "react";
import {
  BrowserRouter as Router,
  Route,
  Routes,
  useLocation,
  Navigate,
} from "react-router-dom";
import { useDispatch } from "react-redux";

import { fetchUserSession } from "./store/authSlice";
import { clearNotifications } from "./store/notificationsSlice";

import Login from "./components/Login";
import Logout from "./components/Logout";
import Header from "./components/Header";
import Home from "./components/Home";
import Notifications from "./components/Notifications";
import AdminDashboard from "./components/Admin/AdminDashboard";
import ManualOverrideReview from "./components/Admin/ManualOverrideReview";
import RecruiterDashboard from "./components/Recruiter/RecruiterDashboard";
import RecruiterRegistration from "./components/Recruiter/RecruiterRegistration";
import RecruiterApplications from "./components/Recruiter/RecruiterApplications";
import RecruiterDomains from "./components/Recruiter/RecruiterDomains";
import CandidateRegistration from "./components/Candidate/CandidateRegistration";
import CandidateProfile from "./components/Candidate/CandidateProfile";
import RecruiterProfile from "./components/Recruiter/RecruiterProfile";
import AdminProfile from "./components/Admin/AdminProfile";
import Profile from "./components/Profile";
import CandidateDashboard from "./components/Candidate/CandidateDashboard";
import SearchJobs from "./components/Candidate/SearchJobs";
import JobList from "./components/JobSearch/JobList";
import CheckYourEmail from "./components/CheckYourEmail";
import VerifyEmail from "./components/VerifyEmail";
import ForgotPassword from "./components/ForgotPassword";
import ResetPassword from "./components/ResetPassword";
import Users from "./components/Users";
import AddJob from "./components/Recruiter/AddJob";
import EditJob from "./components/Recruiter/EditJob";
import ProtectedRoute from "./ProtectedRoute";
import Unauthorized from "./components/Unauthorized";
import ManualOverride from "./components/ManualOverride.jsx";
import Footer from "./components/Footer";

// 🔑 Single source of truth for auth/session/profile
import AuthProvider, { useAuth } from "./components/auth/AuthProvider";
import { AdminViewModeProvider, useAdminViewMode } from "./components/auth/AdminViewModeProvider";

import "./styles.css";
import "./styles/forms.css";
/* 👇 ensure this is the LAST stylesheet import so our overrides always win */
import "./styles/overrides.css";

/** Dim background on content pages, keep Home + auth pages bright */
function RouteDimming() {
  const { pathname } = useLocation();

  useEffect(() => {
    const b = document.body;
    b.classList.remove("dim-bg", "dim-strong");

    if (pathname === "/") return; // Home stays bright
    b.classList.add("dim-bg");
  }, [pathname]);

  return null;
}

/** Disable browser autofill globally (MVP-friendly; can remove later) */
function AutoFillPatch() {
  useEffect(() => {
    const apply = (root = document) => {
      root
        .querySelectorAll("form")
        .forEach((f) => f.setAttribute("autocomplete", "off"));
      root
        .querySelectorAll('input[type="password"]')
        .forEach((i) => i.setAttribute("autocomplete", "new-password"));
      root
        .querySelectorAll('input[type="email"]')
        .forEach((i) => i.setAttribute("autocomplete", "new-email"));
      root
        .querySelectorAll('input[name*="first" i], input[name*="last" i]')
        .forEach((i) => i.setAttribute("autocomplete", "off"));
    };

    apply();

    const mo = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.addedNodes && m.addedNodes.length) {
          m.addedNodes.forEach((n) => {
            if (n.nodeType === 1) apply(n);
          });
        }
      }
    });

    mo.observe(document.documentElement, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);

  return null;
}

/**
 * PublicOnlyRoute
 * - If logged in, redirects away from auth pages.
 * - If not logged in, renders children.
 */
function PublicOnlyRoute({ children }) {
  const { session, loading, role } = useAuth();
  const { isRealAdmin, effectiveRole } = useAdminViewMode();
  const viewingAsGuest = isRealAdmin && effectiveRole === "guest";

  if (loading) return <RouteLoading message="Loading..." />;
  if (session && !viewingAsGuest) {
    // If we don't know role yet, just park at Home; private pages will route correctly once role is loaded.
    const routeRole = isRealAdmin && effectiveRole && effectiveRole !== "admin" ? effectiveRole : role;
    const dest =
      routeRole === "recruiter"
        ? "/recruiter/dashboard"
        : routeRole === "candidate"
        ? "/candidate/dashboard"
        : routeRole === "admin"
        ? "/admin"
        : "/";
    return <Navigate to={dest} replace />;
  }
  return children;
}

function RouteLoading({ message = "Loading..." }) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        minHeight: "220px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#f8fafc",
        fontWeight: 700,
      }}
    >
      {message}
    </div>
  );
}

/**
 * AppShell
 * - Renders the page shell immediately.
 * - Hydrates legacy Redux auth state after AuthProvider resolves the account.
 * - Lets protected routes handle private-route loading states.
 */
function AppShell() {
  const dispatch = useDispatch();
  const { session, user, account, loading, loadingProfile } = useAuth();

  // Session-gated bootstrap: only fetch user/notifications when a real session exists
  useEffect(() => {
    let mounted = true;

    async function run() {
      if (loading) return; // wait for AuthProvider
      if (!session) {
        // signed-out: clear any user-specific state and render public routes
        dispatch(clearNotifications());
        return;
      }

      if (loadingProfile && !account) return;

      try {
        // Hydrate legacy Redux auth state from AuthProvider's already-loaded account.
        const res = await dispatch(fetchUserSession({ session, user, account })).unwrap();

        if (!res?.user) {
          dispatch(clearNotifications());
        }
      } catch {
        if (mounted) dispatch(clearNotifications());
      }
    }

    run();
    return () => {
      mounted = false;
    };
  }, [dispatch, session, user, account, loading, loadingProfile]);

  return (
    <Router>
      <div className="App">
        <Header />

        {/* Controllers */}
        <RouteDimming />
        <AutoFillPatch />
        <div className="bg-dimmer" />

        <div className="main-content">
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Home />} />

            {/* Auth pages are public-only to avoid the "logged in but see login again" loop */}
            <Route
              path="/login"
              element={
                <PublicOnlyRoute>
                  <Login />
                </PublicOnlyRoute>
              }
            />
            <Route path="/signin" element={<Navigate to="/login" replace />} />
            <Route path="/logout" element={<Logout />} />
            <Route
              path="/email-verification"
              element={
                <PublicOnlyRoute>
                  <CheckYourEmail />
                </PublicOnlyRoute>
              }
            />
            <Route
              path="/verify-email"
              element={<VerifyEmail />}
            />
            <Route
              path="/forgot-password"
              element={
                <PublicOnlyRoute>
                  <ForgotPassword />
                </PublicOnlyRoute>
              }
            />
            <Route
              path="/reset-password"
              element={<ResetPassword />}
            />

            {/* Open job search page */}
            <Route path="/jobs" element={<JobList />} />

            <Route path="/unauthorized" element={<Unauthorized />} />

            {/* Shared Profile */}
            <Route
              path="/profile"
              element={
                <ProtectedRoute
                  allowedUserRoles={["admin", "recruiter", "candidate"]}
                >
                  <Profile />
                </ProtectedRoute>
              }
            />

            {/* Admin Routes */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedUserRoles={["admin"]}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/profile"
              element={
                <ProtectedRoute allowedUserRoles={["admin"]}>
                  <AdminProfile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/addjob"
              element={
                <ProtectedRoute allowedUserRoles={["admin"]}>
                  <AddJob />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/manual-overrides"
              element={
                <ProtectedRoute allowedUserRoles={["admin"]}>
                  <ManualOverrideReview />
                </ProtectedRoute>
              }
            />

            <Route
              path="/users"
              element={
                <ProtectedRoute allowedUserRoles={["admin"]}>
                  <Users />
                </ProtectedRoute>
              }
            />

            {/* Recruiter Routes */}
            <Route
              path="/recruiter/register"
              element={
                <PublicOnlyRoute>
                  <RecruiterRegistration />
                </PublicOnlyRoute>
              }
            />
            <Route
              path="/recruiter/dashboard"
              element={
                <ProtectedRoute allowedUserRoles={["recruiter", "admin"]}>
                  <RecruiterDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/recruiter/profile"
              element={
                <ProtectedRoute allowedUserRoles={["recruiter", "admin"]}>
                  <RecruiterProfile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/recruiter/addjob"
              element={
                <ProtectedRoute allowedUserRoles={["recruiter", "admin"]}>
                  <AddJob />
                </ProtectedRoute>
              }
            />
            <Route
              path="/recruiter/domains"
              element={
                <ProtectedRoute allowedUserRoles={["recruiter", "admin"]}>
                  <RecruiterDomains />
                </ProtectedRoute>
              }
            />
            <Route
              path="/recruiter/applications"
              element={
                <ProtectedRoute allowedUserRoles={["recruiter", "admin"]}>
                  <RecruiterApplications />
                </ProtectedRoute>
              }
            />
            <Route
              path="/recruiter/editjob/:jobId"
              element={
                <ProtectedRoute allowedUserRoles={["recruiter", "admin"]}>
                  <EditJob />
                </ProtectedRoute>
              }
            />

            {/* Candidate Routes */}
            <Route
              path="/candidate/register"
              element={
                <PublicOnlyRoute>
                  <CandidateRegistration />
                </PublicOnlyRoute>
              }
            />
            <Route
              path="/candidate/dashboard"
              element={
                <ProtectedRoute allowedUserRoles={["candidate", "admin"]}>
                  <CandidateDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/candidate/profile"
              element={
                <ProtectedRoute allowedUserRoles={["candidate", "admin"]}>
                  <CandidateProfile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/search-jobs"
              element={
                <ProtectedRoute allowedUserRoles={["candidate", "admin"]}>
                  <SearchJobs />
                </ProtectedRoute>
              }
            />

            {/* Shared Notifications */}
            <Route
              path="/notifications"
              element={
                <ProtectedRoute>
                  <Notifications />
                </ProtectedRoute>
              }
            />

            <Route path="/manual-override" element={<ManualOverride />} />
          </Routes>
        </div>

        <Footer />
      </div>
    </Router>
  );
}

function App() {
  // Wrap the whole app with the AuthProvider so everyone shares the SAME session state
  return (
    <AuthProvider>
      <AdminViewModeProvider>
        <AppShell />
      </AdminViewModeProvider>
    </AuthProvider>
  );
}

export default App;
