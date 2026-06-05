// src/components/Header.jsx
import React, { useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { logout as logoutRedux } from "../store/authSlice";
import { fetchNotifications, clearNotifications } from "../store/notificationsSlice";
import { FiBell, FiUser, FiLogOut, FiSettings } from "react-icons/fi";
import LoadingSpinner from "./ui/LoadingSpinner";
import { useAuth } from "../components/auth/AuthProvider";
import {
  ADMIN_VIEW_MODE_GROUPS,
  ADMIN_VIEW_MODES,
  useAdminViewMode,
} from "./auth/AdminViewModeProvider";
import { useEffectiveAuth } from "./auth/useEffectiveAuth";
import "../styles/Header.css";

const AdminViewModeControl = () => {
  const { isRealAdmin, mode, setMode, config, viewingAs } = useAdminViewMode();

  if (!isRealAdmin) return null;

  return (
    <div className="admin-view-mode-shell" aria-label="Admin view mode">
      <div className="admin-view-mode-control">
        {ADMIN_VIEW_MODE_GROUPS.map((group) => (
          <div className="admin-view-mode-group" key={group.label}>
            <span className="admin-view-mode-label">{group.label}</span>
            {group.modes.map((modeKey) => {
              const item = ADMIN_VIEW_MODES[modeKey];
              return (
                <button
                  key={modeKey}
                  type="button"
                  className={`admin-view-mode-dot ${mode === modeKey ? "active" : ""}`}
                  title={item.tooltip}
                  aria-label={`View as ${item.tooltip}`}
                  aria-pressed={mode === modeKey}
                  onClick={() => setMode(modeKey)}
                />
              );
            })}
          </div>
        ))}
      </div>
      {viewingAs && (
        <div className="admin-view-mode-badge">
          VIEWING AS: <strong>{config.label}</strong>
        </div>
      )}
    </div>
  );
};

const Header = () => {
  // 🔐 Single source of truth for auth
  const { session, user, profile, role: authRole, signOut } = useAuth();
  const effectiveAuth = useEffectiveAuth();
  const displayUser = effectiveAuth.user;
  const displayProfile = effectiveAuth.profile;
  const activeRole = effectiveAuth.role || authRole;

  // Keep using Redux for notifications (unchanged)
  const hasUnreadNotifications = useSelector(
    (state) => state.notifications.hasUnreadNotifications
  );
  const authState = useSelector((state) => state.auth || {});

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < 769;
  });

  const dropdownRef = useRef(null);

  useEffect(() => {
    setDropdownOpen(false);
    setDrawerOpen(false);
  }, [location.pathname, location.search]);

  // Resize listener
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 769);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Close account dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close drawer when clicking outside
  useEffect(() => {
    const handleClickOutsideDrawer = (event) => {
      const drawer = document.querySelector(".slide-drawer");
      const toggleButton = document.querySelector(".user-circle");
      if (
        drawer &&
        !drawer.contains(event.target) &&
        toggleButton &&
        !toggleButton.contains(event.target)
      ) {
        setDrawerOpen(false);
      }
    };
    if (drawerOpen) {
      document.addEventListener("mousedown", handleClickOutsideDrawer);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutsideDrawer);
    };
  }, [drawerOpen]);

  // ✅ Fetch notifications when a real session exists
  useEffect(() => {
    if (session && (user?.id || profile?.id)) {
      dispatch(fetchNotifications());
    }
  }, [dispatch, session, user?.id, profile?.id]);

  const openLogoutModal = () => {
    setDropdownOpen(false);
    setDrawerOpen(false);
    setShowLogoutModal(true);
  };
  const closeLogoutModal = () => setShowLogoutModal(false);

  const handleLogout = async () => {
    setLoading(true);
    setShowLogoutModal(false);

    // Sign out and clear local app state
    try {
      await signOut(); // AuthProvider signOut()
    } finally {
      dispatch(clearNotifications());
      // Keep Redux auth slice coherent for any legacy consumers
      dispatch(logoutRedux());
      localStorage.removeItem("user");
      sessionStorage.removeItem("user");
      setDropdownOpen(false);
      setDrawerOpen(false);
      setLoading(false);
      navigate("/");
    }
  };

  const getProfileLink = () => {
    const r = (activeRole || authState.userRole || authState.user?.userRole || "").toLowerCase();
    switch (r) {
      case "candidate":
        return "/candidate/profile";
      case "recruiter":
        return "/recruiter/profile";
      case "admin":
        return "/admin/profile";
      default:
        return null;
    }
  };

  const displayName =
    displayProfile?.firstName ||
    displayUser?.user_metadata?.firstName ||
    displayUser?.firstName ||
    displayProfile?.email ||
    displayUser?.email ||
    "User";

  const getInitials = () => {
    const first =
      displayProfile?.firstName ||
      displayUser?.user_metadata?.firstName ||
      displayUser?.firstName ||
      (displayProfile?.email || displayUser?.email || "").split("@")[0];
    const last =
      displayProfile?.lastName ||
      displayUser?.user_metadata?.lastName ||
      displayUser?.lastName ||
      "";
    const a = (first || "").trim().charAt(0);
    const b = (last || "").trim().charAt(0);
    return (a + b || (first || "U").slice(0, 2)).toUpperCase();
  };

  const isAuthed = effectiveAuth.isAuthenticated;

  return (
    <>
      {loading && <LoadingSpinner />}

      <header className="header">
        <div className="header-container">
          <Link to="/" className="logo">
            jobs<span style={{ color: "#e63946" }}>.</span>vision
          </Link>

          <AdminViewModeControl />

          {!isMobile && (
            <nav className="nav">{/* right-aligned via CSS */}
              <Link to="/notifications" className="icon notification-wrapper">
                <FiBell />
                {hasUnreadNotifications && <span className="notification-dot" />}
              </Link>

              {isAuthed ? (
                <div className="account-container" ref={dropdownRef}>
                  <button
                    className="account-link welcome-pill"
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    aria-haspopup="menu"
                    aria-expanded={dropdownOpen}
                  >
                    <FiUser className="pill-icon" />
                    <span className="user-name">
                      Welcome, <strong>{displayName}</strong>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="header-signout-button"
                    onClick={openLogoutModal}
                    aria-label="Sign Out"
                  >
                    <FiLogOut />
                    <span>Sign Out</span>
                  </button>

                  {dropdownOpen && (
                    <div className="dropdown-menu">
                      <button
                        className="dropdown-item"
                        onClick={() => {
                          navigate("/notifications");
                          setDropdownOpen(false);
                        }}
                      >
                        <span className="icon-wrapper">
                          <FiBell />
                          {hasUnreadNotifications && (
                            <span className="dropdown-notification-dot" />
                          )}
                        </span>
                        Notifications
                      </button>

                      {getProfileLink() && (
                        <Link to={getProfileLink()} className="dropdown-item">
                          <FiSettings /> Profile
                        </Link>
                      )}

                      <button className="dropdown-item" onClick={openLogoutModal}>
                        <FiLogOut /> Sign Out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <Link to="/login" className="icon">
                  <FiUser />
                  <span className="sign-in-text">Sign In</span>
                </Link>
              )}
            </nav>
          )}

          {isMobile && isAuthed && (
            <>
              <button
                className="user-circle"
                onClick={() => setDrawerOpen(!drawerOpen)}
                aria-label="Open account menu"
              >
                <span className="initials">{getInitials()}</span>
                {hasUnreadNotifications && <span className="notification-dot" />}
              </button>

              <div className={`slide-drawer ${drawerOpen ? "open" : ""}`}>
                <div className="drawer-content">
                  <p className="drawer-greeting">Welcome, {displayName}</p>

                  <button
                    className="drawer-item notification-button"
                    onClick={() => {
                      navigate("/notifications");
                      setDrawerOpen(false);
                    }}
                  >
                    <span className="icon-wrapper">
                      <FiBell />
                      {hasUnreadNotifications && (
                        <span className="drawer-notification-dot" />
                      )}
                    </span>
                    Notifications
                  </button>

                  {getProfileLink() && (
                    <button
                      className="drawer-item"
                      onClick={() => {
                        navigate(getProfileLink());
                        setDrawerOpen(false);
                      }}
                    >
                      <FiSettings /> Profile
                    </button>
                  )}

                  <button className="drawer-item" onClick={openLogoutModal}>
                    <FiLogOut /> Sign Out
                  </button>
                </div>
                <div className="drawer-top-slice"></div>
                <div className="drawer-card-space"></div>
              </div>
            </>
          )}
        </div>
      </header>

      {showLogoutModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: "20px",
              borderRadius: "8px",
              textAlign: "center",
              width: "300px",
              boxShadow: "0 4px 15px rgba(0,0,0,0.15)",
            }}
          >
            <h3>Confirm Sign Out</h3>
            <p>Are you sure you want to sign out?</p>
            <div
              style={{
                display: "flex",
                justifyContent: "space-around",
                marginTop: "10px",
              }}
            >
              <button
                onClick={handleLogout}
                style={{
                  backgroundColor: "#e63946",
                  color: "white",
                  padding: "8px 15px",
                  border: "none",
                  cursor: "pointer",
                  borderRadius: "4px",
                }}
              >
                Yes, Sign Out
              </button>
              <button
                onClick={closeLogoutModal}
                style={{
                  backgroundColor: "#ccc",
                  padding: "8px 15px",
                  border: "none",
                  cursor: "pointer",
                  borderRadius: "4px",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Header;
