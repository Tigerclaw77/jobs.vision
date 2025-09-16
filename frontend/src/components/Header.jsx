// src/components/Header.jsx
import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { logout as logoutRedux } from "../store/authSlice";
import { fetchNotifications, clearNotifications } from "../store/notificationsSlice";
import { FiBell, FiUser, FiLogOut, FiSettings } from "react-icons/fi";
import LoadingSpinner from "./ui/LoadingSpinner";
import { useAuth } from "../components/auth/AuthProvider";
import "../styles/Header.css";

const Header = () => {
  // 🔐 Single source of truth for auth
  const { session, user, profile, role, accessToken, signOut } = useAuth();

  // Keep using Redux for notifications (unchanged)
  const hasUnreadNotifications = useSelector(
    (state) => state.notifications.hasUnreadNotifications
  );

  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < 769;
  });

  const dropdownRef = useRef(null);

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

  const openLogoutModal = () => setShowLogoutModal(true);
  const closeLogoutModal = () => setShowLogoutModal(false);

  const handleLogout = async () => {
    setLoading(true);
    setShowLogoutModal(false);

    // Sign out from Supabase and clear local app state
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
      navigate("/login");
    }
  };

  const getProfileLink = () => {
    const r = (role || "").toLowerCase();
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
    profile?.firstName ||
    user?.user_metadata?.firstName ||
    profile?.email ||
    user?.email ||
    "User";

  const getInitials = () => {
    const first =
      profile?.firstName ||
      user?.user_metadata?.firstName ||
      (profile?.email || user?.email || "").split("@")[0];
    const last = profile?.lastName || user?.user_metadata?.lastName || "";
    const a = (first || "").trim().charAt(0);
    const b = (last || "").trim().charAt(0);
    return (a + b || (first || "U").slice(0, 2)).toUpperCase();
  };

  const isAuthed = !!session;

  return (
    <>
      {loading && <LoadingSpinner />}

      <header className="header">
        <div className="header-container">
          <Link to="/" className="logo">
            jobs<span style={{ color: "#e63946" }}>.</span>vision
          </Link>

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
                        <FiLogOut /> Logout
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
                    <FiLogOut /> Logout
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
            <h3>Confirm Logout</h3>
            <p>Are you sure you want to log out?</p>
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
                Yes, Logout
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
