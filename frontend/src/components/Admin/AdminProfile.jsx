import React, { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { fetchUserProfile, updateUserProfile } from "../../utils/api";
import { login } from "../../store/authSlice";
import { profileSavePayload, roleLabel, shapeProfileForm } from "../Profile/profileUtils";
import "../../styles/Profile.css";

const AdminProfile = () => {
  const { user, token, userRole } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const [form, setForm] = useState(() => shapeProfileForm(user?.profile, user));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetchUserProfile();
        if (!mounted) return;
        setForm(shapeProfileForm(res.profile, user));
      } catch (err) {
        if (mounted) setError(err?.message || "Failed to load profile.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadProfile();
    return () => {
      mounted = false;
    };
  }, [user]);

  if (!user) return <Navigate to="/login" />;

  const handleChange = (field) => (event) => {
    const value =
      event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
    setStatus("");
    setError("");
  };

  const handleSave = async () => {
    setSaving(true);
    setStatus("");
    setError("");

    try {
      const res = await updateUserProfile(profileSavePayload(form));
      const next = shapeProfileForm(res.profile, user);
      setForm(next);
      dispatch(
        login({
          token,
          userRole: userRole || res.userRole || res.role || user?.userRole,
          user: {
            ...user,
            email: res.email || user.email,
            userRole: res.userRole || res.role || user.userRole,
            profile: res.profile,
            firstName: res.profile?.firstName || user.firstName,
            lastName: res.profile?.lastName || user.lastName,
          },
        })
      );
      setStatus("Profile saved.");
    } catch (err) {
      setError(err?.response?.data?.error || "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="profile-page">
      <section className="profile-hero">
        <div>
          <h1>Admin Profile</h1>
          <p>
            Manage account information and notification preferences.
          </p>
        </div>
        <div className="profile-save-row">
          <button className="profile-save-button" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Profile"}
          </button>
          <Link to="/admin" className="profile-secondary-link">
            Admin Dashboard
          </Link>
        </div>
      </section>

      {loading ? (
        <div className="profile-card">Loading profile...</div>
      ) : (
        <>
          <div className={`profile-status ${error ? "error" : ""}`}>
            {error || status}
          </div>
          <div className="profile-layout">
            <div className="profile-main">
              <section className="profile-card" id="account-information">
                <h2>Account Information</h2>
                <div className="profile-grid">
                  <div className="profile-field">
                    <label htmlFor="firstName">First Name</label>
                    <input
                      id="firstName"
                      value={form.firstName}
                      onChange={handleChange("firstName")}
                    />
                  </div>
                  <div className="profile-field">
                    <label htmlFor="lastName">Last Name</label>
                    <input
                      id="lastName"
                      value={form.lastName}
                      onChange={handleChange("lastName")}
                    />
                  </div>
                  <div className="profile-field">
                    <label htmlFor="email">Email</label>
                    <input id="email" value={form.email} readOnly />
                  </div>
                  <div className="profile-field">
                    <label htmlFor="phone">Phone</label>
                    <input id="phone" value={form.phone} onChange={handleChange("phone")} />
                  </div>
                </div>
              </section>

              <section className="profile-card" id="notification-preferences">
                <h2>Notification Preferences</h2>
                <div className="profile-check-list">
                  <label className="profile-check">
                    <input
                      type="checkbox"
                      checked={form.emailNotifications}
                      onChange={handleChange("emailNotifications")}
                    />
                    <span>Email notifications</span>
                  </label>
                  <label className="profile-check">
                    <input
                      type="checkbox"
                      checked={form.weeklySummaryEmails}
                      onChange={handleChange("weeklySummaryEmails")}
                    />
                    <span>Weekly summary emails</span>
                  </label>
                </div>
              </section>
            </div>

            <aside className="profile-sidebar">
              <section className="profile-card">
                <h2>Admin Status</h2>
                <p><strong>Role:</strong> {roleLabel(userRole || user?.userRole || "admin")}</p>
                <p><strong>Email:</strong> {form.email || "N/A"}</p>
              </section>
              <section className="profile-card">
                <h2>Admin Tools</h2>
                <ul className="profile-link-list">
                  <li><Link to="/admin">Dashboard</Link></li>
                  <li><Link to="/users">User management</Link></li>
                  <li><Link to="/admin/manual-overrides">Manual overrides</Link></li>
                </ul>
              </section>
            </aside>
          </div>
        </>
      )}
    </main>
  );
};

export default AdminProfile;
