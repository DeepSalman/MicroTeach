import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerUser } from './api';
import './Register.css';

const Register = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    department: '',
    password: '',
    confirmPassword: '',
    role: 'student',
    agreeTerms: false
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const name = formData.fullName.trim();
    const email = formData.email.trim();
    const password = formData.password.trim();
    const confirmPassword = formData.confirmPassword.trim();

    if (!name || !email || !password) {
      setError('Full name, email, and password are required.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (!/\d/.test(password)) {
      setError('Password must contain at least one number.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!formData.agreeTerms) {
      setError('You must agree to the Honor Code and Terms of Service.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await registerUser({
        full_name: name,
        email: email,
        password: password,
        role: formData.role,
        department: formData.department
      });
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page-wrapper">
      <div className="register-card">
        
        {/* Brand Logo and Header */}
        <div className="register-header">
          <div className="register-logo">
            <div className="register-logo-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 3L1 9L12 15L21 10.09V17H23V9M5 13.18V17.18L12 21L19 17.18V13.18L12 17L5 13.18Z" />
              </svg>
            </div>
            <span className="register-logo-text">
              MicroTeach<span className="register-logo-dot">✦</span>
            </span>
          </div>
          <h1 className="register-title">Create your account</h1>
          <p className="register-subtitle">Join your campus peer learning &amp; micro-tutoring network</p>
        </div>

        {/* SSO Button */}
        <div className="register-sso-section">
          <button type="button" className="register-sso-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3L1 9l11 6l9-4.91V17h2V9M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z" />
            </svg>
            <span>Sign up with University / Work Email</span>
          </button>
        </div>

        {/* Divider */}
        <div className="register-divider">
          <div className="register-divider-line"></div>
          <span className="register-divider-text">Or register with email</span>
          <div className="register-divider-line"></div>
        </div>

        {error && <div className="register-error-message">{error}</div>}

        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="register-form">
          
          {/* Full Name */}
          <div className="register-field">
            <label className="register-label" htmlFor="fullName">Full Name</label>
            <div className="register-input-wrapper">
              <div className="register-input-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <path d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <input
                className="register-input"
                type="text"
                id="fullName"
                name="fullName"
                placeholder="Tahmid Kabir"
                value={formData.fullName}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          {/* Email */}
          <div className="register-field">
            <label className="register-label" htmlFor="email">Email Address</label>
            <div className="register-input-wrapper">
              <div className="register-input-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <path d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <input
                className="register-input"
                type="email"
                id="email"
                name="email"
                placeholder="name@example.com"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          {/* Department */}
          <div className="register-field">
            <label className="register-label" htmlFor="department">Department / Major</label>
            <div className="register-input-wrapper">
              <div className="register-input-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <path d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <select
                className="register-select"
                id="department"
                name="department"
                value={formData.department}
                onChange={handleChange}
                required
              >
                <option disabled value="">Select Department / Major</option>
                <option value="cs">Computer Science &amp; Engineering</option>
                <option value="ee">Electrical &amp; Electronics Engineering</option>
                <option value="math">Mathematics &amp; Applied Statistics</option>
                <option value="bio">Biology &amp; Biomedical Sciences</option>
                <option value="econ">Economics &amp; Finance</option>
                <option value="chem">Chemistry &amp; Chemical Engineering</option>
                <option value="other">Other Campus Department</option>
              </select>
              <div className="register-select-arrow">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </div>

          {/* Password */}
          <div className="register-field">
            <label className="register-label" htmlFor="password">Password</label>
            <div className="register-input-wrapper">
              <div className="register-input-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <path d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <input
                className="register-input"
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                required
              />
              <button
                type="button"
                className="register-password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                title="Toggle password visibility"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <path d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
            <div className="register-password-hints">
              <span className="register-hint">
                <span className="register-hint-dot"></span>
                8+ characters
              </span>
              <span className="register-hint">
                <span className="register-hint-dot"></span>
                At least 1 number
              </span>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="register-field">
            <label className="register-label" htmlFor="confirmPassword">Confirm Password</label>
            <div className="register-input-wrapper">
              <div className="register-input-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <path d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <input
                className="register-input"
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          {/* Terms Checkbox */}
          <div className="register-terms">
            <label className="register-terms-label">
              <input
                type="checkbox"
                name="agreeTerms"
                checked={formData.agreeTerms}
                onChange={handleChange}
                className="register-checkbox"
                required
              />
              <span>
                I agree to the <a href="#" onClick={(e) => e.preventDefault()}>Honor Code</a>, <a href="#" onClick={(e) => e.preventDefault()}>Academic Integrity Charter</a>, and <a href="#" onClick={(e) => e.preventDefault()}>Terms of Service</a>
              </span>
            </label>
          </div>

          {/* Submit Button */}
          <div className="register-submit-wrapper">
            <button type="submit" className="register-submit-btn" disabled={loading}>
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </div>
        </form>

        {/* Login Link */}
        <div className="register-login-link">
          Already have an account?
          <Link to="/login">Log in</Link>
        </div>

        {/* Trust Footer */}
        <div className="register-trust-footer">
          <svg width="14" height="14" viewBox="0 0 20 20" fill="#f59e0b">
            <path clipRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" fillRule="evenodd" />
          </svg>
          <span>Email verification required • Zero tolerance for academic dishonesty</span>
        </div>

      </div>
    </div>
  );
};

export default Register;
