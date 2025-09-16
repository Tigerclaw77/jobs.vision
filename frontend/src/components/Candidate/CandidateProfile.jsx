import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Navigate } from "react-router-dom";
import { updateUserProfile } from "../../utils/api";
import { login } from "../../store/authSlice";

const CandidateProfile = () => {
  const user = useSelector((state) => state.auth.user);
  const dispatch = useDispatch();

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    firstName: user?.profile?.firstName || "",
    lastName: user?.profile?.lastName || "",
    email: user?.email || "",
  });

  const [errors, setErrors] = useState({});

  if (!user) {
    return <Navigate to="/login" />;
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
          ...user,
          user: {
            ...user,
            profile: res.profile,
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
          <p><strong>First Name:</strong> {user.profile?.firstName || "N/A"}</p>
          <p><strong>Last Name:</strong> {user.profile?.lastName || "N/A"}</p>
          <p><strong>Email:</strong> {user.email}</p>
          <button onClick={() => setIsEditing(true)}>Edit Profile</button>
        </div>
      )}
    </div>
  );
};

export default CandidateProfile;
