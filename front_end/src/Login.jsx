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
          <div>
            <div className="eyebrow">BUILT FOR CAMPUS MICRO-LEARNING .</div>

            <div className="title-block">
              <div className="title-label">
                <svg viewBox="0 0 16 16" fill="currentColor" width="10" height="10">
                  <path d="M4 1h8v2H4V1zm0 12h8v2H4v-2zM1 4h14v8H1V4z"/>
                </svg>
                TITLE
              </div>
              <div className="title-box">
                <h1>MicroTeach. The campus exchange built for peer mastery.</h1>
              </div>
            </div>

            {message && <div className="error-message">{message}</div>}

            <form onSubmit={handleLogin}>
              <div className="form-group">
                <div className="form-label">
                  <span>Email Address</span>
                  <span className="required">REQUIRED</span>
                </div>
                <input
                  className="form-input"
                  type="email"
                  placeholder="you@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <div className="form-label">
                  <span>Password</span>
                  <Link to="/forgot-password" className="forgot">Forgot?</Link>
                </div>
                <div className="password-wrapper">
                  <input
                    className="form-input"
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    style={{ paddingRight: '40px' }}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label="Toggle password"
                  >
                    {showPassword ? '🙈' : '👁'}
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
                  Remember authenticated session
                </label>
                <span className="ttl">TTL: 14 DAYS</span>
              </div>

              <button type="submit" className="btn-signin" disabled={loading}>
                <span>{loading ? 'SIGNING IN...' : 'SIGN IN'}</span>
                <span className="arrow">&rarr;</span>
              </button>

              <div className="register-link">
                Don't have an account?
                <Link to="/register">Register student account &rarr;</Link>
              </div>
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
