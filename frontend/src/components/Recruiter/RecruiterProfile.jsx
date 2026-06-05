import React, { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { fetchUserProfile, updateUserProfile } from "../../utils/api";
import { login } from "../../store/authSlice";
import {
  profileSavePayload,
  recruiterCompletionSummary,
  shapeProfileForm,
} from "../Profile/profileUtils";
import ProfileCompletionModule from "../Profile/ProfileCompletionModule";
import "../../styles/Profile.css";

const RECRUITER_PROFILE_COMPLETION_TASKS = [
  "profile:recruiter:company-name",
  "profile:recruiter:company-description",
  "profile:recruiter:company-website",
  "profile:recruiter:company-logo",
];

const RECRUITER_PROFILE_COMPLETION_LABELS = {
  "profile:recruiter:company-name": "Company Name",
  "profile:recruiter:company-description": "Company Description",
  "profile:recruiter:company-website": "Company Website",
  "profile:recruiter:company-logo": "Company Logo",
};

const RecruiterProfile = () => {
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
        const next = shapeProfileForm(res.profile, user);
        setForm(next);
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

  const completion = recruiterCompletionSummary(form);

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
          <h1>Recruiter Profile</h1>
          <p>
            Manage company information, candidate contact methods, and notification
            preferences.
          </p>
        </div>
        <div className="profile-save-row">
          <button className="profile-save-button" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Profile"}
          </button>
          <Link to="/recruiter/dashboard" className="profile-secondary-link">
            Dashboard
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
          <div className="profile-layout recruiter-profile-layout">
            <div className="profile-main">
              <section className="profile-card profile-completion-card">
                <ProfileCompletionModule
                  completion={completion}
                  includeOptional
                  displayTaskIds={RECRUITER_PROFILE_COMPLETION_TASKS}
                  labelOverrides={RECRUITER_PROFILE_COMPLETION_LABELS}
                  showNote={false}
                  showTaskDetails={false}
                  collapseWhenComplete
                />
              </section>

              <section className="profile-card" id="company-information">
                <h2>Company Information</h2>
                <div className="profile-grid">
                  <div className="profile-field">
                    <label htmlFor="companyName">Company Name</label>
                    <input
                      id="companyName"
                      value={form.companyName}
                      onChange={handleChange("companyName")}
                    />
                  </div>
                  <div className="profile-field">
                    <label htmlFor="companyWebsite">Website</label>
                    <input
                      id="companyWebsite"
                      value={form.companyWebsite}
                      onChange={handleChange("companyWebsite")}
                      placeholder="https://example.com"
                    />
                  </div>
                  <div className="profile-field">
                    <label htmlFor="companyLocation">Location</label>
                    <input
                      id="companyLocation"
                      value={form.companyLocation}
                      onChange={handleChange("companyLocation")}
                      placeholder="City, State"
                    />
                  </div>
                  <div className="profile-field">
                    <label htmlFor="companyLogoUrl">Company Logo</label>
                    <input
                      id="companyLogoUrl"
                      value={form.companyLogoUrl}
                      onChange={handleChange("companyLogoUrl")}
                      placeholder="Future-ready logo URL"
                    />
                    <span className="profile-help">Logo upload can be connected later.</span>
                  </div>
                  <div className="profile-field full">
                    <label htmlFor="companyDescription">Company Description</label>
                    <textarea
                      id="companyDescription"
                      value={form.companyDescription}
                      onChange={handleChange("companyDescription")}
                      placeholder="Describe the practice, team, locations, or patient focus."
                    />
                  </div>
                </div>
              </section>

              <section className="profile-card emphasis" id="application-preferences">
                <h2>Application Preferences</h2>
                <div className="profile-check-list">
                  <label className="profile-check">
                    <input
                      type="checkbox"
                      checked={form.applicationUseAccountEmail}
                      onChange={handleChange("applicationUseAccountEmail")}
                    />
                    <span>Use account email for applications ({form.email || "no email on file"})</span>
                  </label>
                </div>
                <div className="profile-grid" style={{ marginTop: 14 }}>
                  <div className="profile-field">
                    <label htmlFor="applicationEmail">Application Email</label>
                    <input
                      id="applicationEmail"
                      value={form.applicationEmail}
                      onChange={handleChange("applicationEmail")}
                      type="email"
                    />
                  </div>
                  <div className="profile-field">
                    <label htmlFor="applicationPhone">Application Phone</label>
                    <input
                      id="applicationPhone"
                      value={form.applicationPhone}
                      onChange={handleChange("applicationPhone")}
                    />
                  </div>
                  <div className="profile-field full">
                    <label htmlFor="applicationWebsite">Application Website / URL</label>
                    <input
                      id="applicationWebsite"
                      value={form.applicationWebsite}
                      onChange={handleChange("applicationWebsite")}
                      placeholder="Optional website, contact form, or scheduling URL"
                    />
                  </div>
                  <div className="profile-field full">
                    <label htmlFor="applicationInstructions">Application Instructions</label>
                    <textarea
                      id="applicationInstructions"
                      value={form.applicationInstructions}
                      onChange={handleChange("applicationInstructions")}
                      placeholder="Tell candidates whether to email, call, text, or use a website form."
                    />
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
                      checked={form.smsNotifications}
                      onChange={handleChange("smsNotifications")}
                    />
                    <span>SMS notifications</span>
                  </label>
                  <label className="profile-check">
                    <input
                      type="checkbox"
                      checked={form.leadNotifications}
                      onChange={handleChange("leadNotifications")}
                    />
                    <span>Lead notifications</span>
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
                <p className="profile-help">SMS delivery is not connected yet.</p>
              </section>

              <section className="profile-card profile-contact-methods-card">
                <h2>Contact Methods</h2>
                <div className="profile-pill-row">
                  {form.applicationUseAccountEmail && form.email && (
                    <span className="profile-pill">Account email</span>
                  )}
                  {form.applicationEmail && <span className="profile-pill">Application email</span>}
                  {form.applicationPhone && <span className="profile-pill">Phone</span>}
                  {form.applicationWebsite && <span className="profile-pill">Website</span>}
                  {!form.applicationUseAccountEmail &&
                    !form.applicationEmail &&
                    !form.applicationPhone &&
                    !form.applicationWebsite && (
                      <span className="profile-empty">No contact method yet.</span>
                    )}
                </div>
              </section>
            </div>
          </div>
        </>
      )}
    </main>
  );
};

export default RecruiterProfile;
