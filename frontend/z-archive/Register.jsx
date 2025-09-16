// import React, { useState } from "react";
// import { useNavigate } from "react-router-dom"; // ✅ Navigation
// import { registerUser } from "../utils/api";     // ✅ Centralized API call
// import "../styles/Register.css";                // ✅ Styles

// const Register = ({ role }) => {
//   const [formData, setFormData] = useState({
//     firstName: "",
//     lastName: "",
//     email: "",
//     password: "",
//   });

//   const [message, setMessage] = useState("");
//   const [errors, setErrors] = useState({});
//   const [isSubmitting, setIsSubmitting] = useState(false); // ✅ Optional spinner/disable
//   const navigate = useNavigate(); // ✅ useNavigate, not history.push

//   // ✅ Handle input changes
//   const handleChange = (e) => {
//     const { name, value } = e.target;
//     setFormData((prev) => ({ ...prev, [name]: value }));
//   };

//   // ✅ Frontend Validation
//   const validateForm = () => {
//     const newErrors = {};
//     const { firstName, lastName, email, password } = formData;

//     if (!firstName) newErrors.firstName = "First name is required";
//     if (!lastName) newErrors.lastName = "Last name is required";

//     if (!email) {
//       newErrors.email = "Email is required";
//     } else if (!/\S+@\S+\.\S+/.test(email)) {
//       newErrors.email = "Email is invalid";
//     }

//     if (!password) {
//       newErrors.password = "Password is required";
//     } else if (password.length < 8) {
//       newErrors.password = "Password must be at least 8 characters";
//     } else if (!/[A-Z]/.test(password)) {
//       newErrors.password = "Password must contain at least one uppercase letter";
//     } else if (!/[0-9]/.test(password)) {
//       newErrors.password = "Password must contain at least one number";
//     } else if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
//       newErrors.password = "Password must contain at least one special character";
//     }

//     return newErrors;
//   };

//   // ✅ Submit handler
//   const handleSubmit = async (e) => {
//     e.preventDefault();

//     const formErrors = validateForm();
//     if (Object.keys(formErrors).length > 0) {
//       setErrors(formErrors);
//       return;
//     }

//     setIsSubmitting(true);
//     setErrors({});
//     setMessage("");

//     try {
//       // ✅ Calling centralized API util
//       const result = await registerUser({
//         firstName: formData.firstName,
//         lastName: formData.lastName,
//         email: formData.email,
//         password: formData.password,
//         userRole: role,
//       });

//       setMessage(result.message || "Registration successful!");

//       // ✅ Clear form fields
//       setFormData({
//         firstName: "",
//         lastName: "",
//         email: "",
//         password: "",
//       });

//       // ✅ Redirect after success
//       navigate("/verify-email"); // or navigate("/login");

//     } catch (error) {
//       console.error("❌ Registration failed:", error);
//       setMessage(error.message || "Registration failed. Please try again.");
//     } finally {
//       setIsSubmitting(false);
//     }
//   };

//   return (
//     <div className="register-container">
//       <div className="register-form">
//         <h2>{role === "recruiter" ? "Recruiter Registration" : "Candidate Registration"}</h2>

//         {/* ✅ Display success/error message */}
//         {message && <p className="message">{message}</p>}

//         <form onSubmit={handleSubmit}>

//           {/* ✅ First Name */}
//           <div className="input-group">
//             <input
//               type="text"
//               name="firstName"
//               placeholder="First Name"
//               value={formData.firstName}
//               onChange={handleChange}
//               className={errors.firstName ? "error" : ""}
//             />
//             {errors.firstName && <span className="error-message">{errors.firstName}</span>}
//           </div>

//           {/* ✅ Last Name */}
//           <div className="input-group">
//             <input
//               type="text"
//               name="lastName"
//               placeholder="Last Name"
//               value={formData.lastName}
//               onChange={handleChange}
//               className={errors.lastName ? "error" : ""}
//             />
//             {errors.lastName && <span className="error-message">{errors.lastName}</span>}
//           </div>

//           {/* ✅ Email */}
//           <div className="input-group">
//             <input
//               type="email"
//               name="email"
//               placeholder="Email"
//               value={formData.email}
//               onChange={handleChange}
//               className={errors.email ? "error" : ""}
//             />
//             {errors.email && <span className="error-message">{errors.email}</span>}
//           </div>

//           {/* ✅ Password */}
//           <div className="input-group">
//             <input
//               type="password"
//               name="password"
//               placeholder="Password"
//               value={formData.password}
//               onChange={handleChange}
//               className={errors.password ? "error" : ""}
//             />
//             {errors.password && <span className="error-message">{errors.password}</span>}
//           </div>

//           {/* ✅ Submit */}
//           <button
//             type="submit"
//             className="submit-button"
//             disabled={isSubmitting}
//           >
//             {isSubmitting ? "Registering..." : `Register as ${role === "recruiter" ? "Recruiter" : "Candidate"}`}
//           </button>
//         </form>
//       </div>
//     </div>
//   );
// };

// export default Register;
