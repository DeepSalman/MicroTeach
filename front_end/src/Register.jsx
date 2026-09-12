import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Register.css';

const Register = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    role: 'Student'
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const name = formData.fullName.trim();
    const email = formData.email.trim();
    const password = formData.password.trim();

    if (!name || !email || !password) {
      setError('Full name, email, and password are required.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost:3001/api/users/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          full_name: name,
          email: email,
          password: password,
          role: formData.role.toLowerCase()
        })
      });

      const data = await response.json();

      if (response.ok) {
        navigate('/login');
      } else {
        setError(data.message || data.error || 'Registration failed. Please try again.');
      }
    } catch (err) {
      console.error('Registration fetch error:', err);
      setError('Cannot connect to Node server. Make sure "node server.js" is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page-wrapper">
      <div className="register-hero-container">
        
        {/* Left Branding Panel */}
        <div className="brand-panel">
          <div className="brand-logo">
            <div className="brand-logo-icon">M</div>
            <span>Microteach</span>
          </div>

          <div className="brand-hero-content">
            <h1>Join the Knowledge Sharing Network</h1>
            <p>
              Create an account to connect with top peer tutors, access curated 
              learning materials, and boost your academic journey.
            </p>
          </div>

          <div className="brand-footer-text">
            © 2026 Microteach Platform. All rights reserved.
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="form-panel">
          <div className="form-header-row">
            <div>
              <p className="subtitle">Start for free</p>
              <h2 className="main-title">Create account</h2>
            </div>
            <div className="top-login-link">
              Have an account? <Link to="/login">Log in</Link>
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}

          <form className="register-form" onSubmit={handleSubmit}>
            <div className="field-group">
              <label htmlFor="fullName">Full Name</label>
              <input
                type="text"
                id="fullName"
                name="fullName"
                className="custom-input"
                placeholder="e.g. Alex Johnson"
                value={formData.fullName}
                onChange={handleChange}
              />
            </div>

            <div className="field-group">
              <label htmlFor="email">Email Address</label>
              <input
                type="email"
                id="email"
                name="email"
                className="custom-input"
                placeholder="e.g. alex@example.com"
                value={formData.email}
                onChange={handleChange}
              />
            </div>

            <div className="field-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                name="password"
                className="custom-input"
                placeholder="Create a strong password"
                value={formData.password}
                onChange={handleChange}
              />
            </div>

            <div className="field-group">
              <label htmlFor="role">I am registering as a</label>
              <select
                id="role"
                name="role"
                className="custom-select"
                value={formData.role}
                onChange={handleChange}
              >
                <option value="Student">Student</option>
                <option value="Tutor">Tutor</option>
              </select>
            </div>

            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? 'Registering...' : 'Register'}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};

export default Register;