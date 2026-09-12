import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { loginUser } from './api';
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

        {/* Right Panel: Orbital Background */}
        <section className="login-right-panel">
          <div className="orbital">
            <svg viewBox="0 0 1000 1000">
              <defs>
                <path d="M 500, 500 m -440, 0 a 440,440 0 1,1 880,0 a 440,440 0 1,1 -880,0" id="c-outer"/>
                <path d="M 500, 500 m -350, 0 a 350,350 0 1,1 700,0 a 350,350 0 1,1 -700,0" id="c-mid1"/>
                <path d="M 500, 500 m -260, 0 a 260,260 0 1,1 520,0 a 260,260 0 1,1 -520,0" id="c-mid2"/>
                <path d="M 500, 500 m -170, 0 a 170,170 0 1,1 340,0 a 170,170 0 1,1 -340,0" id="c-inner"/>
              </defs>
              <text opacity="0.5">
                <textPath href="#c-outer" startOffset="0%">
                  THE CONTENT ARCHITECTURE • MICROTEACH PEER LEARNING • ACADEMIC INTEGRITY • THE CONTENT ARCHITECTURE •
                </textPath>
              </text>
              <text opacity="0.7">
                <textPath href="#c-mid1" startOffset="25%">
                  CAMPUS KNOWLEDGE EXCHANGE • REAL-TIME MICRO-TUTORING • VERIFIED .EDU NETWORK •
                </textPath>
              </text>
              <text opacity="0.6">
                <textPath href="#c-mid2" startOffset="50%">
                  THE CONTENT ARCHITECTURE • STRICT IDENTITY VERIFICATION • ZERO FRAUD ESCROW •
                </textPath>
              </text>
              <text opacity="0.8">
                <textPath href="#c-inner" startOffset="10%">
                  PEER SOLVING • TUTOR PROTOCOL • MICROTEACH •
                </textPath>
              </text>
            </svg>
          </div>

          <div className="center-brand">
            <div className="brand-icon">MT</div>
            <h2>MicroTeach</h2>
            <p>Campus peer tutoring network powered by escrow-secured sessions and verified .edu identities.</p>
          </div>
        </section>

      </div>
    </div>
  );
};

export default Login;
