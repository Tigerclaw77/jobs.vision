import React, { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { fetchUserProfile, updateUserProfile } from "../../utils/api";
import { login } from "../../store/authSlice";
import {
  joinInterests,
  profileSavePayload,
  shapeProfileForm,
  splitInterests,
} from "../Profile/profileUtils";
import "../../styles/Profile.css";

const SPECIALTY_INTEREST_OPTIONS = [
  "Dry Eye",
  "Pediatrics",
  "Scleral Lenses",
  "Myopia Management",
  "Vision Therapy",
  "Contact Lenses",
  "Optical Sales",
  "Bilingual Spanish",
];

const normalizeInterest = (value) => String(value || "").trim().toLowerCase();

const CandidateProfile = () => {
  const { user, token, userRole } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const [form, setForm] = useState(() => shapeProfileForm(user?.profile, user));
  const [interestsText, setInterestsText] = useState(() =>
    joinInterests(user?.profile?.specialtyInterests || user?.profile?.specialty_interests)
  );
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
        setInterestsText(joinInterests(next.specialtyInterests));
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

  const selectedInterestSet = new Set(splitInterests(interestsText).map(normalizeInterest));

  const toggleSpecialtyInterest = (interest) => {
    const current = splitInterests(interestsText);
    const normalized = normalizeInterest(interest);
    const exists = current.some((item) => normalizeInterest(item) === normalized);
    const next = exists
      ? current.filter((item) => normalizeInterest(item) !== normalized)
      : [...current, interest];
    setInterestsText(next.join(", "));
    setStatus("");
    setError("");
  };

  const handleSave = async () => {
    setSaving(true);
    setStatus("");
    setError("");

    try {
      const payload = {
        ...profileSavePayload(form),
        specialtyInterests: splitInterests(interestsText),
      };
      const res = await updateUserProfile(payload);
      const next = shapeProfileForm(res.profile, user);
      setForm(next);
      setInterestsText(joinInterests(next.specialtyInterests));
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
          <p className="profile-eyebrow">Candidate Account</p>
          <h1>Candidate Profile</h1>
          <p>
            Manage contact information and future alert preferences. Saved jobs and
            searches remain separate candidate workflows, but this structure is ready
            for future email and SMS alerts.
          </p>
        </div>
        <div className="profile-save-row">
          <button className="profile-save-button" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Profile"}
          </button>
          <Link to="/candidate/dashboard" className="profile-secondary-link">
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
          <div className="profile-layout">
            <div className="profile-main">
              <section className="profile-card" id="contact-information">
                <h2>Contact Information</h2>
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
                    <input
                      id="phone"
                      value={form.phone}
                      onChange={handleChange("phone")}
                      placeholder="Optional"
                    />
                  </div>
                </div>
              </section>

              <section className="profile-card" id="alert-preferences">
                <h2>Alert Preferences</h2>
                <div className="profile-check-list">
                  <label className="profile-check">
                    <input
                      type="checkbox"
                      checked={form.emailNotifications}
                      onChange={handleChange("emailNotifications")}
                    />
                    <span>Email alerts</span>
                  </label>
                  <label className="profile-check">
                    <input
                      type="checkbox"
                      checked={form.smsNotifications}
                      onChange={handleChange("smsNotifications")}
                    />
                    <span>SMS alerts</span>
                  </label>
                  <label className="profile-check">
                    <input
                      type="checkbox"
                      checked={form.savedSearchAlerts}
                      onChange={handleChange("savedSearchAlerts")}
                    />
                    <span>Saved search alerts</span>
                  </label>
                  <label className="profile-check">
                    <input
                      type="checkbox"
                      checked={form.weeklySummaryEmails}
                      onChange={handleChange("weeklySummaryEmails")}
                    />
                    <span>Weekly matching emails</span>
                  </label>
                </div>
                <p className="profile-help">AI matching and SMS delivery are not connected yet.</p>
              </section>

              <section className="profile-card" id="specialty-interests">
                <h2>Specialty Interests</h2>
                <p className="profile-section-intro">
                  Choose common interests or add your own. These preferences prepare
                  future alerts without changing today&apos;s job search behavior.
                </p>
                <div className="profile-interest-grid" aria-label="Specialty interest options">
                  {SPECIALTY_INTEREST_OPTIONS.map((interest) => {
                    const selected = selectedInterestSet.has(normalizeInterest(interest));
                    return (
                      <button
                        type="button"
                        key={interest}
                        className={`profile-interest-pill ${selected ? "selected" : ""}`}
                        aria-pressed={selected}
                        onClick={() => toggleSpecialtyInterest(interest)}
                      >
                        {interest}
                      </button>
                    );
                  })}
                </div>
                <div className="profile-field full">
                  <label htmlFor="specialtyInterests">Custom interests</label>
                  <input
                    id="specialtyInterests"
                    value={interestsText}
                    onChange={(event) => setInterestsText(event.target.value)}
                    placeholder="Add interests separated by commas"
                  />
                  <span className="profile-help">
                    Selected interests are saved as profile preferences for future alerts.
                  </span>
                </div>
              </section>
            </div>

            <aside className="profile-sidebar">
              <section className="profile-card">
                <h2>Candidate Shortcuts</h2>
                <ul className="profile-link-list">
                  <li><Link to="/jobs">Browse jobs</Link></li>
                  <li><Link to="/candidate/dashboard">Saved jobs</Link></li>
                  <li><Link to="/candidate/dashboard">Application summary</Link></li>
                </ul>
              </section>
              <section className="profile-card">
                <h2>Future Alert Areas</h2>
                <div className="profile-pill-row">
                  <span className="profile-pill">Saved searches</span>
                  <span className="profile-pill">Saved jobs</span>
                  <span className="profile-pill">Email alerts</span>
                  <span className="profile-pill">SMS alerts</span>
                </div>
              </section>
            </aside>
          </div>
        </>
      )}
    </main>
  );
};

export default CandidateProfile;
