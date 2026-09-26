import React, { useState } from 'react';
import { submitTransactionDispute } from './api';
import './TransactionReportModal.css';

const REASON_OPTIONS = [
  'Tutor missed scheduled session / no-show',
  'Student missed scheduled session / no-show',
  'Incomplete deliverable or partial session only',
  'Substandard academic quality or incorrect material',
  'Deliverable completed but payment/completion withheld',
  'Technical breakdown / connection failure during call',
  'Mutual agreement to cancel and refund',
  'Other transaction or milestone dispute'
];

const TransactionReportModal = ({ post, user, isOpen, onClose, onSuccess }) => {
  const [disputeType, setDisputeType] = useState('full_refund'); // full_refund | split | full_payment
  const [splitPercentage, setSplitPercentage] = useState(50); // Student %
  const [reason, setReason] = useState(REASON_OPTIONS[0]);
  const [description, setDescription] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submittedCase, setSubmittedCase] = useState(null);

  if (!isOpen || !post) return null;

  const bounty = parseFloat(post.bounty) || 0;
  const isPoster = user && String(post.user_id) === String(user.user_id);
  const userRole = isPoster ? 'Student (Post Owner)' : 'Teacher (Tutor)';

  // Calculate live breakdown for split
  const studentSplitAmount = ((bounty * splitPercentage) / 100).toFixed(2);
  const tutorSplitAmount = (bounty - parseFloat(studentSplitAmount)).toFixed(2);

  const handleClose = () => {
    if (submitting) return;
    setError('');
    setDescription('');
    setEvidenceUrl('');
    setSubmittedCase(null);
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!description.trim() || description.trim().length < 20) {
      setError('Please provide a detailed statement of at least 20 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        post_id: post.post_id,
        reporter_id: user.user_id,
        dispute_type: disputeType,
        reason,
        split_percentage: disputeType === 'split' ? splitPercentage : 50,
        description: description.trim(),
        evidence_url: evidenceUrl.trim() || null
      };

      const res = await submitTransactionDispute(payload);
      setSubmittedCase(res.data.case_id || 'TX-DISP-ACK');
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit transaction dispute. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="trm-overlay" onClick={handleClose}>
      <div className="trm-modal" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="trm-header">
          <div className="trm-header-icon-box">
            <span className="trm-icon">⚖️</span>
          </div>
          <div className="trm-header-titles">
            <div className="trm-eyebrow">ESCROW &amp; TRANSACTION DISPUTE</div>
            <h2 className="trm-title">Report Transaction Issue</h2>
            <div className="trm-post-ref">
              <span className="trm-course-tag">{post.course_code}</span>
              <span className="trm-post-title-text">{post.title}</span>
            </div>
          </div>
          <button className="trm-close-btn" onClick={handleClose} aria-label="Close modal">×</button>
        </div>

        {/* Success View */}
        {submittedCase ? (
          <div className="trm-success-view">
            <div className="trm-success-badge">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <h3 className="trm-success-heading">Dispute Filed Successfully</h3>
            <div className="trm-case-pill">Case Reference: <strong>{submittedCase}</strong></div>
            <p className="trm-success-desc">
              Your dispute statement has been entered into the Institutional Arbitration Queue. Escrow funds 
              (<strong>৳ {bounty}</strong>) are flagged and held securely. An administrator will review both 
              parties' activity and issue a binding settlement.
            </p>
            <div className="trm-success-actions">
              <button className="trm-btn-primary" onClick={handleClose}>Done</button>
            </div>
          </div>
        ) : (
          /* Form View */
          <form className="trm-form" onSubmit={handleSubmit}>
            {/* Meta Strip */}
            <div className="trm-meta-strip">
              <div className="trm-meta-item">
                <span className="trm-meta-label">Contested Escrow:</span>
                <span className="trm-meta-val bounty-val">৳ {bounty} BDT</span>
              </div>
              <div className="trm-meta-item">
                <span className="trm-meta-label">Your Role:</span>
                <span className="trm-meta-val">{userRole}</span>
              </div>
              <div className="trm-meta-item">
                <span className="trm-meta-label">Status:</span>
                <span className="trm-meta-val status-locked">Escrow Flagged on Submit</span>
              </div>
            </div>

            {/* Topic / Remedy Selection */}
            <div className="trm-section">
              <label className="trm-section-label">
                Requested Resolution Remedy <span className="trm-req">*</span>
              </label>
              <p className="trm-section-hint">
                Select your preferred remedy according to industry standard escrow arbitration:
              </p>

              <div className="trm-remedy-grid">
                {/* 1. Full Refund */}
                <div
                  className={`trm-remedy-card ${disputeType === 'full_refund' ? 'active' : ''}`}
                  onClick={() => setDisputeType('full_refund')}
                >
                  <div className="trm-remedy-radio">
                    <input
                      type="radio"
                      name="disputeType"
                      checked={disputeType === 'full_refund'}
                      onChange={() => setDisputeType('full_refund')}
                    />
                  </div>
                  <div className="trm-remedy-info">
                    <div className="trm-remedy-name">
                      <span className="trm-remedy-emoji">🔄</span> Full Refund
                    </div>
                    <div className="trm-remedy-amount">৳ {bounty} to Student</div>
                    <div className="trm-remedy-desc">
                      100% refund of bounty returned to poster wallet. Recommended for no-shows or zero delivery.
                    </div>
                  </div>
                </div>

                {/* 2. Compromise Split */}
                <div
                  className={`trm-remedy-card ${disputeType === 'split' ? 'active' : ''}`}
                  onClick={() => setDisputeType('split')}
                >
                  <div className="trm-remedy-radio">
                    <input
                      type="radio"
                      name="disputeType"
                      checked={disputeType === 'split'}
                      onChange={() => setDisputeType('split')}
                    />
                  </div>
                  <div className="trm-remedy-info">
                    <div className="trm-remedy-name">
                      <span className="trm-remedy-emoji">⚖️</span> Compromise Split
                    </div>
                    <div className="trm-remedy-amount">
                      ৳ {studentSplitAmount} / ৳ {tutorSplitAmount}
                    </div>
                    <div className="trm-remedy-desc">
                      Fair prorated settlement between student and tutor based on partial completion.
                    </div>
                  </div>
                </div>

                {/* 3. Full Payment */}
                <div
                  className={`trm-remedy-card ${disputeType === 'full_payment' ? 'active' : ''}`}
                  onClick={() => setDisputeType('full_payment')}
                >
                  <div className="trm-remedy-radio">
                    <input
                      type="radio"
                      name="disputeType"
                      checked={disputeType === 'full_payment'}
                      onChange={() => setDisputeType('full_payment')}
                    />
                  </div>
                  <div className="trm-remedy-info">
                    <div className="trm-remedy-name">
                      <span className="trm-remedy-emoji">💰</span> Full Tutor Payout
                    </div>
                    <div className="trm-remedy-amount">৳ {bounty} to Tutor</div>
                    <div className="trm-remedy-desc">
                      100% release of bounty to tutor wallet. Recommended when full work was delivered.
                    </div>
                  </div>
                </div>
              </div>

              {/* Dynamic Split Customizer (when split is selected) */}
              {disputeType === 'split' && (
                <div className="trm-split-customizer">
                  <div className="trm-split-header">
                    <span>Proposed Split Allocation:</span>
                    <span className="trm-split-ratio">
                      Student: <strong>{splitPercentage}% (৳{studentSplitAmount})</strong> &bull; Tutor: <strong>{100 - splitPercentage}% (৳{tutorSplitAmount})</strong>
                    </span>
                  </div>
                  <div className="trm-split-presets">
                    {[50, 60, 75, 25].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        className={`trm-preset-btn ${splitPercentage === pct ? 'active' : ''}`}
                        onClick={() => setSplitPercentage(pct)}
                      >
                        {pct}/{100 - pct} {pct === 50 ? '(Equal)' : pct > 50 ? '(Student Favored)' : '(Tutor Favored)'}
                      </button>
                    ))}
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="90"
                    step="5"
                    value={splitPercentage}
                    onChange={(e) => setSplitPercentage(Number(e.target.value))}
                    className="trm-slider"
                  />
                  <div className="trm-slider-labels">
                    <span>10% Student</span>
                    <span>50% Equal</span>
                    <span>90% Student</span>
                  </div>
                </div>
              )}
            </div>

            {/* Dispute Category */}
            <div className="trm-section">
              <label className="trm-section-label">
                Primary Issue Category <span className="trm-req">*</span>
              </label>
              <select
                className="trm-select"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              >
                {REASON_OPTIONS.map((opt, i) => (
                  <option key={i} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            {/* Narrative Statement */}
            <div className="trm-section">
              <div className="trm-label-row">
                <label className="trm-section-label">
                  Dispute Narrative &amp; Claim Statement <span className="trm-req">*</span>
                </label>
                <span className={`trm-counter ${description.length < 20 ? 'insufficient' : ''}`}>
                  {description.length}/1500 chars (min 20)
                </span>
              </div>
              <textarea
                className="trm-textarea"
                rows={4}
                placeholder="State clearly what happened, agreed timestamps, what was or was not delivered, and the factual basis for your requested settlement..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={1500}
              />
            </div>

            {/* Evidence Link */}
            <div className="trm-section">
              <label className="trm-section-label">
                Supporting Evidence / Verification Link (Optional)
              </label>
              <input
                type="text"
                className="trm-input"
                placeholder="e.g. Google Drive link with screenshot, Google Meet call link, code gist..."
                value={evidenceUrl}
                onChange={(e) => setEvidenceUrl(e.target.value)}
              />
              <div className="trm-hint">
                Links will be examined by the admin arbitration panel during adjudication.
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="trm-error-alert">
                <span className="trm-error-icon">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {/* Actions */}
            <div className="trm-footer">
              <button
                type="button"
                className="trm-btn-secondary"
                onClick={handleClose}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="trm-btn-primary"
                disabled={submitting}
              >
                {submitting ? 'Submitting Dispute...' : 'Submit Transaction Dispute'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default TransactionReportModal;
