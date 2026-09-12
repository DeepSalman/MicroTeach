import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { loginUser } from './api';
import './Login.css';

const Login = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const response = await loginUser({ email, password });
      const user = response.data.user;
      
      if (onLogin) onLogin(user);
      navigate('/home');
    } catch (err) {
      setMessage(err.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-wrapper">
      <div className="login-hero-container">
        
        {/* Left Side: Brand Showcase */}
        <div className="brand-panel">
          <div className="brand-logo">
            <div className="brand-logo-icon">M</div>
            <span>Microteach</span>
          </div>

          <div className="brand-hero-content">
            <h1>Empowering Peer-to-Peer Learning</h1>
            <p>Connect with expert student tutors, expand your technical skill set, and schedule interactive micro-sessions.</p>
          </div>

          <div className="brand-footer-text">
            © {new Date().getFullYear()} Microteach Platform. All rights reserved.
          </div>
        </div>

        {/* Right Side: Form */}
        <div className="form-panel">
          <div className="form-header-row">
            <div>
              <p className="subtitle">Welcome to Microteach</p>
              <h2 className="main-title">Log in</h2>
            </div>
            <div className="top-signup-link">
              No Account?
              <br />
              <Link to="/register">Sign up</Link>
            </div>
          </div>

          {message && <div className="error-message">{message}</div>}

          <form onSubmit={handleLogin} className="login-form">
            <div className="field-group">
              <label htmlFor="email">Enter your email address</label>
              <div className="input-wrapper">
                <input
                  id="email"
                  type="email"
                  className="custom-input"
                  placeholder="e.g. john@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="field-group">
              <label htmlFor="password">Enter your password</label>
              <div className="input-wrapper">
                <input
                  id="password"
                  type="password"
                  className="custom-input"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className="field-extras">
                <a href="#forgot" onClick={(e) => e.preventDefault()} className="forgot-password">
                  Forgot Password?
                </a>
              </div>
            </div>

            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};

export default Login;