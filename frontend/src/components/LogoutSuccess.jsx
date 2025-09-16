// import React, { useEffect } from "react";
// import { useNavigate } from "react-router-dom";

// const LogoutSuccess = () => {
//   const navigate = useNavigate();

//   useEffect(() => {
//     setTimeout(() => {
//       navigate("/auth/login");
//     }, 5000); // Redirect after 5 seconds
//   }, [navigate]);

//   return (
//     <div style={styles.container}>
//       <h2>You have been logged out</h2>
//       <p>Redirecting to login in 5 seconds...</p>
//       <button onClick={() => navigate("/login")} style={styles.button}>
//         Back to Login
//       </button>
//     </div>
//   );
// };

// const styles = {
//   container: {
//     textAlign: "center",
//     padding: "20px",
//     fontSize: "18px",
//   },
//   button: {
//     marginTop: "15px",
//     padding: "10px",
//     fontSize: "16px",
//     backgroundColor: "#005a78",
//     color: "white",
//     border: "none",
//     borderRadius: "5px",
//     cursor: "pointer",
//   },
// };

// export default LogoutSuccess;
