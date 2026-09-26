import React, { useState } from 'react';
import IdCardCapture from './IdCardCapture';
import { submitTeacherApplication } from './api';
import './ApplyTeacherModal.css';

const ApplyTeacherModal = ({ user, isOpen, onClose, onSuccess }) => {
  const [reason, setReason] = useState('');
  const [expertise, setExpertise] = useState('');
  const [studentIdFile, setStudentIdFile] = useState(null);
  const [nidFile, setNidFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    if (submitting) return;
    setReason('');
    setExpertise('');
    setStudentIdFile(null);
    setNidFile(null);
    setError('');
    setSuccess(false);
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!reason.trim()) { setError('Please explain why you want to become a tutor.'); return; }
    if (reason.trim().length < 30) { setError('Reason must be at least 30 characters.'); return; }
    if (!studentIdFile) { setError('Please provide your Student ID card photo.'); return; }
    if (!nidFile) { setError('Please provide your National ID card photo.'); return; }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('user_id', user.user_id);
      formData.append('reason', reason.trim());
      formData.append('expertise', expertise.trim());
      formData.append('student_id_card', studentIdFile);
      formData.append('nid_card', nidFile);

      await submitTeacherApplication(formData);
      setSuccess(true);
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="atm-overlay" onClick={handleClose}>
      <div className="atm-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="atm-header">
          <div className="atm-header-icon">🎓</div>
          <div>
            <h2 className="atm-title">Apply to Teach</h2>
            <p className="atm-subtitle">Submit your application to become a verified tutor</p>
          </div>
          <button className="atm-close-btn" onClick={handleClose} aria-label="Close">×</button>
        </div>

        {success ? (
          <div className="atm-success">
            <div className="atm-success-icon">✅</div>
            <h3>Application Submitted!</h3>
            <p>Your application is under review. You'll be notified once an admin reviews it.</p>
            <button className="atm-done-btn" onClick={handleClose}>Done</button>
          </div>
        ) : (
          <form className="atm-form" onSubmit={handleSubmit}>
            {/* Why do you want to teach */}
            <div className="atm-field">
              <label className="atm-field-label">Why do you want to become a tutor? <span className="atm-req">*</span></label>
              <textarea
                className="atm-textarea"
                rows={4}
                placeholder="Describe your motivation, teaching experience, how you can help other students... (min. 30 chars)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={1000}
              />
              <div className="atm-char-hint">{reason.length}/1000</div>
            </div>

            {/* Expertise */}
            <div className="atm-field">
              <label className="atm-field-label">Subjects / Expertise (optional)</label>
              <input
                className="atm-input"
                type="text"
                placeholder="e.g. Calculus, Data Structures, English Writing"
                value={expertise}
                onChange={(e) => setExpertise(e.target.value)}
                maxLength={255}
              />
              <div className="atm-field-hint">Separate multiple subjects with commas</div>
            </div>

            {/* Document uploads */}
            <div className="atm-docs-section">
              <div className="atm-docs-title">
                <span className="atm-docs-icon">📄</span>
                Required Identity Documents
              </div>
              <p className="atm-docs-desc">
                Both documents are required for verification. Photos are stored securely and only visible to admins.
              </p>
              <div className="atm-docs-grid">
                <IdCardCapture
                  label="Student ID Card"
                  onCapture={(file) => setStudentIdFile(file)}
                  captured={null}
                />
                <IdCardCapture
                  label="National ID (NID) Card"
                  onCapture={(file) => setNidFile(file)}
                  captured={null}
                />
              </div>
            </div>

            {error && (
              <div className="atm-error">
                <span>⚠️</span> {error}
              </div>
            )}

            <div className="atm-form-actions">
              <button type="button" className="atm-cancel-btn" onClick={handleClose} disabled={submitting}>
                Cancel
              </button>
              <button type="submit" className="atm-submit-btn" disabled={submitting}>
                {submitting ? (
                  <><span className="atm-btn-spinner" /> Submitting...</>
                ) : (
                  'Submit Application'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ApplyTeacherModal;
