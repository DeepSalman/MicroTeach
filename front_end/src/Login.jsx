import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { loginUser } from './api';
import BookAnimation from './BookAnimation';
import './Login.css';

const Login = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const response = await loginUser({ email, password });
      const user = response.data.user;
      
      if (onLogin) onLogin(user);
      navigate('/');
    } catch (err) {
      setMessage(err.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-wrapper">
      <div className="login-hero-container">
        
        {/* Left Panel: Login Form */}
        <section className="login-left-panel">
          <div className="login-form">
            <div className="login-brand">
              <span className="login-brand-mark">
                <img src="/logo.png" alt="" />
              </span>
              <span className="login-brand-name">MicroTeach</span>
            </div>

            <header className="login-heading">
              <h1>Welcome back</h1>
              <p>Sign in to continue.</p>
            </header>

            {message && <div className="error-message">{message}</div>}

            <form onSubmit={handleLogin}>
              <div className="form-group">
                <div className="field-label">
                  <label htmlFor="email">Email</label>
                </div>
                <input
                  id="email"
                  className="form-input"
                  type="email"
                  placeholder="you@bracu.ac.bd"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <div className="field-label">
                  <label htmlFor="password">Password</label>
                  <Link to="/forgot-password" className="forgot">Forgot password?</Link>
                </div>
                <div className="password-wrapper">
                  <input
                    id="password"
                    className="form-input"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 3l18 18" />
                        <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                        <path d="M9.4 5.3A9.6 9.6 0 0 1 12 5c5.5 0 9.5 7 9.5 7a17.7 17.7 0 0 1-3.4 4.3" />
                        <path d="M6.6 6.6A17.6 17.6 0 0 0 2.5 12S6.5 19 12 19a9.7 9.7 0 0 0 4.4-1.1" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="checkbox-row">
                <label>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  Keep me signed in
                </label>
              </div>

              <button type="submit" className="btn-signin" disabled={loading}>
                <span>{loading ? 'Signing in...' : 'Sign in'}</span>
                <span className="arrow">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14" />
                    <path d="m13 6 6 6-6 6" />
                  </svg>
                </span>
              </button>

              <p className="register-link">
                New to MicroTeach?
                <Link to="/register">Create an account</Link>
              </p>
            </form>
          </div>
        </section>

        {/* Right Panel: Book Animation */}
        <section className="login-right-panel">
          <BookAnimation />

          <div className="center-brand">
            <div className="brand-icon"><img src="/logo.png" alt="MicroTeach" /></div>
            <p>Campus peer tutoring network powered by escrow-secured sessions and verified .edu identities.</p>
          </div>
        </section>

      </div>
    </div>
  );
};

export default Login;
