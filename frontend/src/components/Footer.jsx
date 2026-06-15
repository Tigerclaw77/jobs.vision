import React from "react";
import { Link } from "react-router-dom"; // Import Link from React Router
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFacebook, faXTwitter, faInstagram } from "@fortawesome/free-brands-svg-icons";
import "../styles.css";

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer-container">
        {/* Left Section - Brand Name */}
        <div className="footer-brand">
        <h2>
            <Link to="/" className="footer-logo"> {/* Link to home */}
              jobs<span className="highlight">.</span>vision
            </Link>
          </h2>
        </div>

        {/* Middle Section - Navigation Links */}
        <div className="footer-links">
          <Link to="/about">About</Link>
          <Link to="/jobs">Jobs</Link>
          <Link to="/contact">Contact</Link>
          <Link to="/privacy">Privacy Policy</Link>
        </div>

        {/* Right Section - Social Media */}
        <div className="footer-social">
          <a href="https://facebook.com" target="_blank" rel="noopener noreferrer">
            <FontAwesomeIcon icon={faFacebook} />
          </a>
          <a href="https://twitter.com" target="_blank" rel="noopener noreferrer">
            <FontAwesomeIcon icon={faXTwitter} />
          </a>
          <a href="https://instagram.com" target="_blank" rel="noopener noreferrer">
            <FontAwesomeIcon icon={faInstagram} />
          </a>
        </div>
      </div>

      {/* Bottom Section - Copyright */}
      <div className="footer-bottom">
        <p>&copy; {new Date().getFullYear()} Passport™. All rights reserved.</p>
      </div>
    </footer>
  );
};

export default Footer;
