import React, { useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { logout } from "../store/authSlice";
import { useNavigate } from "react-router-dom";
import { FiLogOut, FiSettings } from "react-icons/fi";
import "../styles/HeaderMobile.css";

const MobileUserMenu = () => {
  const user = useSelector((state) => state.auth.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const getInitials = () => {
    const first = user?.profile?.firstName || "";
    const last = user?.profile?.lastName || "";
    return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
  };

  const handleLogout = () => {
    dispatch(logout());
    localStorage.removeItem("user");
    sessionStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <>
      <button className="user-circle" onClick={() => setDrawerOpen(!drawerOpen)}>
        <span className="initials">{getInitials()}</span>
        <span className="notification-dot"></span>
      </button>

      <div className={`slide-drawer ${drawerOpen ? "open" : ""}`}>
        <div className="drawer-content">
          <p className="drawer-greeting">Welcome, {user?.profile?.firstName}</p>
          <button className="drawer-item" onClick={() => navigate("/profile")}> <FiSettings /> Profile </button>
          <button className="drawer-item" onClick={handleLogout}> <FiLogOut /> Logout </button>
        </div>
      </div>
    </>
  );
};

export default MobileUserMenu;
