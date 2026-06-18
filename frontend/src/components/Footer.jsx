import React from "react";
import { Link } from "react-router-dom";
import "../styles.css";

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-brand">
          <h2>
            <Link to="/" className="footer-logo">
              jobs<span className="highlight">.</span>vision
            </Link>
          </h2>
        </div>

        <div className="footer-links">
          <Link to="/jobs">Jobs</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/contact">Contact</Link>
        </div>
      </div>

      <div className="footer-bottom">
        <p>&copy; {new Date().getFullYear()} jobs.vision. All rights reserved.</p>
      </div>
    </footer>
  );
};

export default Footer;
