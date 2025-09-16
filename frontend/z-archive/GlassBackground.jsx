// import React from "react";

// const GlassBackground = ({ children }) => {
//   return <div style={styles.background}>{children}</div>;
// };

// // ✅ Animated Background with Moving Light Effect
// const styles = {
//   background: {
//     minHeight: "100vh",
//     display: "flex",
//     alignItems: "center",
//     justifyContent: "center",
//     // background: "linear-gradient(135deg, #00c6ff, #0072ff)", // ✅ Base Gradient
//     position: "relative",
//     overflow: "hidden",
//   },
// };

// // ✅ Inject Animated Light Effect
// const globalStyles = `
// @keyframes moveLight {
//   0% { transform: translate(-100px, -100px); }
//   50% { transform: translate(200px, 200px); }
//   100% { transform: translate(-100px, -100px); }
// }

// .light-effect {
//   position: absolute;
//   width: 300px;
//   height: 300px;
//   background: radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%);
//   filter: blur(100px);
//   animation: moveLight 10s infinite alternate ease-in-out;
// }
// `;

// // ✅ Inject Global Styles
// const styleSheet = document.createElement("style");
// styleSheet.type = "text/css";
// styleSheet.innerText = globalStyles;
// document.head.appendChild(styleSheet);

// export default GlassBackground;
