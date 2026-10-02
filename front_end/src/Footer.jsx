import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

const Footer = () => {
  return (
    <footer className="app-footer">
      <div className="footer-container">
        <div className="footer-brand">
          <Link to="/" className="footer-logo" title="MicroTeach Home">
            <span className="footer-logo-icon">
              <img src="/logo.png" alt="MicroTeach" />
            </span>
            <span className="footer-logo-title">MicroTeach</span>
          </Link>
          <span className="footer-brand-divider">/</span>
          <p className="footer-tagline">
            Peer Tutoring &amp; Academic Bounty Exchange
          </p>
        </div>

        <div className="footer-links">
          <Link to="/">Home</Link>
          <a href="#" onClick={(e) => e.preventDefault()}>Campus Safety</a>
          <a href="#" onClick={(e) => e.preventDefault()}>Terms</a>
          <a href="#" onClick={(e) => e.preventDefault()}>Privacy</a>
          <a href="#" onClick={(e) => e.preventDefault()}>Support</a>
        </div>
      </div>

      <div className="footer-subline">
        <span>&copy; {new Date().getFullYear()} MicroTeach, Inc. All rights reserved.</span>
        <div className="footer-meta-right">
          <span className="footer-network-status">
            <span className="campus-indicator-dot" />
            Campus Network Active
          </span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
