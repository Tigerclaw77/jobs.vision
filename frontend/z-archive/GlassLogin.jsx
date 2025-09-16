// import React, { useState } from "react";

// const GlassLogin = () => {
//   const [isRegister, setIsRegister] = useState(false);

//   return (
//     <div style={styles.container}>
//       <div style={styles.glassBox}>
//         <h2>{isRegister ? "Register" : "Login"}</h2>
//         <input type="email" placeholder="Email" style={styles.input} />
//         <input type="password" placeholder="Password" style={styles.input} />
//         {isRegister && <input type="text" placeholder="Full Name" style={styles.input} />}
//         <button style={styles.button}>{isRegister ? "Sign Up" : "Login"}</button>
//         <p onClick={() => setIsRegister(!isRegister)} style={styles.toggleText}>
//           {isRegister ? "Already have an account? Login" : "Don't have an account? Sign Up"}
//         </p>
//       </div>
//     </div>
//   );
// };

// // ✅ Glassmorphic Login & Register UI
// const styles = {
//   container: {
//     minHeight: "100vh",
//     display: "flex",
//     alignItems: "center",
//     justifyContent: "center",
//     background: "linear-gradient(135deg, #00c6ff, #0072ff)", // ✅ Vibrant Background
//   },
//   glassBox: {
//     width: "350px",
//     padding: "25px",
//     borderRadius: "15px",
//     background: "rgba(255, 255, 255, 0.1)", // ✅ Strong Glass Effect
//     backdropFilter: "blur(15px)",
//     boxShadow: "0 8px 32px rgba(0, 0, 0, 0.37)",
//     textAlign: "center",
//     color: "white",
//     display: "flex",
//     flexDirection: "column",
//     gap: "10px",
//   },
//   input: {
//     padding: "10px",
//     borderRadius: "5px",
//     border: "none",
//     outline: "none",
//     background: "rgba(255, 255, 255, 0.2)",
//     color: "white",
//     fontSize: "16px",
//     textAlign: "center",
//   },
//   button: {
//     padding: "10px",
//     borderRadius: "5px",
//     border: "none",
//     background: "#00c6ff",
//     color: "white",
//     fontSize: "18px",
//     cursor: "pointer",
//     transition: "0.3s",
//   },
//   buttonHover: {
//     background: "#0072ff",
//   },
//   toggleText: {
//     fontSize: "14px",
//     cursor: "pointer",
//     textDecoration: "underline",
//   },
// };

// export default GlassLogin;
