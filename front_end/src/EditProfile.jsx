import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchUserProfile, updateUserProfile } from './api';
import './EditProfile.css';

const EditProfile = ({ user, onProfileUpdate }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    department: '',
    bio: '',
    phone: '',
    student_id: ''
  });

  useEffect(() => {
    if (user?.user_id) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    try {
      const response = await fetchUserProfile(user.user_id);
      const userData = response.data.user;
      setFormData({
        full_name: userData.full_name || '',
        email: userData.email || '',
        department: userData.department || '',
        bio: userData.bio || '',
        phone: userData.phone || '',
        student_id: userData.student_id || ''
      });
    } catch (err) {
      setError('Failed to load profile data.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.full_name.trim()) {
      setError('Full name is required.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await updateUserProfile(user.user_id, {
        full_name: formData.full_name,
        department: formData.department,
        bio: formData.bio,
        phone: formData.phone,
        student_id: formData.student_id
      });

      if (onProfileUpdate) {
        onProfileUpdate(response.data.user);
      }

      setSuccess('Profile updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const departments = [
    'Computer Science & Engineering',
    'Electrical & Electronic Engineering',
    'Mechanical Engineering',
    'Civil Engineering',
    'Information Technology',
    'Software Engineering',
    'Data Science & AI',
    'Mathematics',
    'Physics',
    'Chemistry',
    'Business Administration',
    'Economics',
    'English',
    'Other'
  ];

  const roleLabel = user?.role === 'tutor' ? 'Peer Tutor' : user?.role === 'both' ? 'Student & Tutor' : 'Student';

  if (loading) {
    return (
      <div className="edit-profile-page">
        <div className="edit-loading">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="edit-profile-page">

      {/* Header */}
      <header className="home-header">
        <div className="logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          <div className="logo-icon"><img src="/logo.png" alt="MicroTeach" /></div>
        </div>
        <div className="header-actions">
          <button className="back-btn" onClick={() => navigate('/profile')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Back to Profile
          </button>
          <div className="avatar">
            {formData.full_name ? formData.full_name.charAt(0).toUpperCase() : 'U'}
          </div>
        </div>
      </header>

      {/* Breadcrumb */}
      <div className="breadcrumb-bar">
        <div className="breadcrumb-inner">
          <a href="#" onClick={(e) => { e.preventDefault(); navigate('/'); }}>Home</a>
          <span>/</span>
          <a href="#" onClick={(e) => { e.preventDefault(); navigate('/profile'); }}>Profile</a>
          <span>/</span>
          <span className="current">Edit Profile</span>
        </div>
      </div>

      {/* Main Content */}
      <main className="edit-main">
        <div className="edit-card">
          <div className="edit-card-header">
            <h1>Edit Profile</h1>
            <p>Update your personal information and preferences. Changes are saved to your campus profile.</p>
          </div>

          {error && <div className="edit-error">{error}</div>}
          {success && <div className="edit-success">{success}</div>}

          <form onSubmit={handleSubmit} className="edit-form">
            {/* Profile Preview */}
            <div className="edit-preview">
              <div className="preview-avatar">
                {formData.full_name ? formData.full_name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="preview-info">
                <div className="preview-name-row">
                  <h2>{formData.full_name || 'Your Name'}</h2>
                  {user?.is_verified ? (
                    <span className="verified-badge">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                      Verified
                    </span>
                  ) : (
                    <span className="not-verified-badge">Not Verified</span>
                  )}
                </div>
                <p>{formData.email}</p>
                <span className="preview-role">{roleLabel}</span>
              </div>
            </div>

            {/* Section: Basic Info */}
            <div className="edit-section">
              <h3>Basic Information</h3>
              <div className="form-grid">
                <div className="form-field">
                  <label>Full Name <span className="required">*</span></label>
                  <input
                    type="text"
                    name="full_name"
                    value={formData.full_name}
                    onChange={handleChange}
                    placeholder="Enter your full name"
                    required
                  />
                </div>
                <div className="form-field">
                  <label>Email Address</label>
                  <input
                    type="email"
                    value={formData.email}
                    disabled
                    className="disabled"
                  />
                  <span className="field-hint">Email cannot be changed</span>
                </div>
              </div>
            </div>

            {/* Section: Academic Info */}
            <div className="edit-section">
              <h3>Academic Information</h3>
              <div className="form-grid">
                <div className="form-field">
                  <label>Student ID</label>
                  <input
                    type="text"
                    name="student_id"
                    value={formData.student_id}
                    onChange={handleChange}
                    placeholder="e.g. 21201489"
                  />
                  <span className="field-hint">Your campus student ID number</span>
                </div>
                <div className="form-field">
                  <label>Department</label>
                  <select
                    name="department"
                    value={formData.department}
                    onChange={handleChange}
                  >
                    <option value="">Select your department</option>
                    {departments.map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Section: Contact */}
            <div className="edit-section">
              <h3>Contact Information</h3>
              <div className="form-grid">
                <div className="form-field">
                  <label>Phone Number</label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="e.g. +880 1XXXXXXXXX"
                  />
                  <span className="field-hint">Optional. For urgent session coordination.</span>
                </div>
              </div>
            </div>

            {/* Section: Bio */}
            <div className="edit-section">
              <h3>About You</h3>
              <div className="form-field full-width">
                <label>Bio</label>
                <textarea
                  name="bio"
                  value={formData.bio}
                  onChange={handleChange}
                  rows="4"
                  maxLength="500"
                  placeholder="Tell other students about your expertise, courses you've completed, and how you can help..."
                />
                <span className="field-hint">{formData.bio.length} / 500 characters</span>
              </div>
            </div>

            {/* Actions */}
            <div className="edit-actions">
              <button
                type="button"
                className="btn-cancel"
                onClick={() => navigate('/profile')}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-save"
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="home-footer">
        <div className="footer-bottom">
          <div>
            &copy; 2025 MicroTeach, Inc. &nbsp;&middot;&nbsp;
            <a href="#" onClick={(e) => e.preventDefault()}>Privacy</a> &middot;
            <a href="#" onClick={(e) => e.preventDefault()}>Terms</a> &middot;
            <a href="#" onClick={(e) => e.preventDefault()}>Campus Safety & Escrow</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default EditProfile;
