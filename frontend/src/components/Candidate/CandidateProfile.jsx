import React, { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Navigate } from "react-router-dom";
import { fetchUserProfile, updateUserProfile } from "../../utils/api";
import { login } from "../../store/authSlice";

const CandidateProfile = () => {
  const { user, token, userRole } = useSelector((state) => state.auth);
  const dispatch = useDispatch();

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    firstName: user?.profile?.firstName || user?.firstName || "",
    lastName: user?.profile?.lastName || user?.lastName || "",
    email: user?.email || "",
  });

  const [errors, setErrors] = useState({});
  const [loadingProfile, setLoadingProfile] = useState(true);
  const loadedUserIdRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      if (!user) {
        setLoadingProfile(false);
        return;
      }
      if (loadedUserIdRef.current === user.id) {
        setLoadingProfile(false);
        return;
      }
      loadedUserIdRef.current = user.id;

      try {
        const res = await fetchUserProfile();
        if (!mounted) return;

        const profile = res.profile || {};
        setFormData({
          firstName: profile.firstName || user?.firstName || "",
          lastName: profile.lastName || user?.lastName || "",
          email: res.email || user?.email || "",
        });

        dispatch(
          login({
            token,
            userRole: userRole || res.userRole || res.role || user?.userRole,
            user: {
              ...user,
              email: res.email || user.email,
              userRole: res.userRole || res.role || user.userRole,
              profile,
              firstName: profile.firstName || user.firstName,
              lastName: profile.lastName || user.lastName,
            },
          })
        );
      } catch (err) {
        console.error("Error loading profile:", err);
      } finally {
        if (mounted) setLoadingProfile(false);
      }
    }

    loadProfile();
    return () => {
      mounted = false;
    };
  }, [dispatch, token, user, userRole]);

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (loadingProfile) {
    return <p>Loading profile...</p>;
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" })); // clear field error
  };

  const validate = () => {
    const errs = {};
    if (!formData.firstName.trim()) errs.firstName = "First name is required";
    if (!formData.lastName.trim()) errs.lastName = "Last name is required";
    return errs;
  };

  const handleSave = async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    try {
      const res = await updateUserProfile({
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
      });

      dispatch(
        login({
          token,
          userRole: userRole || user?.userRole,
          user: {
            ...user,
            profile: res.profile,
            firstName: res.profile?.firstName || user?.firstName,
            lastName: res.profile?.lastName || user?.lastName,
          },
        })
      );

      alert("Profile updated successfully.");
      setIsEditing(false);
    } catch (err) {
      console.error("❌ Error updating profile:", err);
      alert("Failed to update profile.");
    }
  };

  return (
    <div>
      <h2>Candidate Profile</h2>

      {isEditing ? (
        <div>
          <label>
            First Name:
            <input
              type="text"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
            />
            {errors.firstName && (
              <span style={{ color: "red" }}>{errors.firstName}</span>
            )}
          </label>
          <br />
          <label>
            Last Name:
            <input
              type="text"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
            />
            {errors.lastName && (
              <span style={{ color: "red" }}>{errors.lastName}</span>
            )}
          </label>
          <br />
          <label>
            Email (readonly):
            <input type="email" value={formData.email} readOnly />
          </label>
          <br />
          <button onClick={handleSave}>Save</button>
          <button onClick={() => setIsEditing(false)}>Cancel</button>
        </div>
      ) : (
        <div>
          <p><strong>First Name:</strong> {formData.firstName || "N/A"}</p>
          <p><strong>Last Name:</strong> {formData.lastName || "N/A"}</p>
          <p><strong>Email:</strong> {user.email}</p>
          <button onClick={() => setIsEditing(true)}>Edit Profile</button>
        </div>
      )}
    </div>
  );
};

export default CandidateProfile;
