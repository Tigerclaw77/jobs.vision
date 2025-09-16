// import React, { useState } from "react";

// const GlassCard = ({ title, content }) => {
//   const [hover, setHover] = useState(false);

//   return (
//     <div
//       style={{ ...styles.card, ...(hover ? styles.cardHover : {}) }}
//       onMouseEnter={() => setHover(true)}
//       onMouseLeave={() => setHover(false)}
//     >
//       <h2 style={styles.title}>{title}</h2>
//       <p style={styles.content}>{content}</p>
//       <div style={{ ...styles.highlight, ...(hover ? styles.highlightVisible : {}) }} />
//     </div>
//   );
// };

// // ✅ Smooth hover effects & animated highlights
// const styles = {
//   card: {
//     width: "300px",
//     padding: "20px",
//     borderRadius: "15px",
//     background: "rgba(255, 255, 255, 0.15)", // ✅ Transparent Glass Effect
//     backdropFilter: "blur(20px)",
//     boxShadow: "0 8px 32px rgba(0, 0, 0, 0.37)", // ✅ Stronger shadow
//     border: "1px solid rgba(255, 255, 255, 0.2)",
//     color: "white",
//     textAlign: "center",
//     position: "relative",
//     transition: "transform 0.3s ease-in-out",
//     overflow: "hidden",
//   },
//   cardHover: {
//     transform: "scale(1.05)", // ✅ Slight zoom on hover
//   },
//   title: {
//     fontSize: "24px",
//     fontWeight: "bold",
//     textShadow: "2px 2px 5px rgba(255, 255, 255, 0.5)",
//   },
//   highlight: {
//     position: "absolute",
//     top: "50%",
//     left: "50%",
//     width: "300px",
//     height: "300px",
//     background: "radial-gradient(circle, rgba(255, 255, 255, 0.2) 0%, transparent 70%)",
//     transform: "translate(-50%, -50%) scale(0)",
//     borderRadius: "50%",
//     transition: "transform 0.3s ease-in-out",
//   },
//   highlightVisible: {
//     transform: "translate(-50%, -50%) scale(1.5)", // ✅ Expands on hover
//   },
// };

// export default GlassCard;
