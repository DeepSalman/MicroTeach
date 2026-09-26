import { useState, useEffect } from 'react';
import { fetchPostApplications, applyToPost, withdrawApplication } from './api';
import './ApplyModal.css';

const ApplyModal = ({ post, user, onClose, onApplySuccess, onWithdrawSuccess, onOpenTeacherModal }) => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const myApplication = user ? applications.find(a => String(a.user_id) === String(user.user_id)) : null;
  const isOwnPost = user && String(post.user_id) === String(user.user_id);
  const isTeacher = user && (user.role === 'both' || user.role === 'tutor');

  useEffect(() => {
    loadApplications();
  }, [post.post_id]);

  const loadApplications = async () => {
    try {
      const response = await fetchPostApplications(post.post_id);
      setApplications(response.data);
    } catch (err) {
      console.error('Failed to load applications:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await applyToPost({
        post_id: post.post_id,
        user_id: user.user_id,
        message: message.trim(),
      });
      setSuccess('Application submitted successfully!');
      setMessage('');
      loadApplications();
      if (onApplySuccess) onApplySuccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit application.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    if (!myApplication) return;
    setSubmitting(true);
    setError('');
    try {
      await withdrawApplication(myApplication.application_id);
      setSuccess('Application withdrawn.');
      loadApplications();
      if (onWithdrawSuccess) onWithdrawSuccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to withdraw application.');
    } finally {
      setSubmitting(false);
    }
  };

  const getDeliveryLabel = (format) => {
    const labels = {
      'live_call': 'Google Meet (30m)',
      'annotated_pdf': 'Annotated Notes',
      'video_walkthrough': 'Video Walkthrough'
    };
    return labels[format] || 'Google Meet (30m)';
  };

  const getStatusBadge = (status) => {
    const badges = {
      'pending': { class: 'status-pending', text: 'Pending' },
      'accepted': { class: 'status-accepted', text: 'Accepted' },
      'rejected': { class: 'status-rejected', text: 'Rejected' }
    };
    return badges[status] || badges['pending'];
  };

  const getTimeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="apply-overlay" onClick={onClose}>
      <div className="apply-modal" onClick={(e) => e.stopPropagation()}>
        <div className="apply-modal-header">
          <h3>Post Details</h3>
          <button className="apply-close" onClick={onClose}>&times;</button>
        </div>

        <div className="apply-modal-body">
          {/* Post Info */}
          <div className="apply-post-info">
            <div className="apply-post-meta">
              <span className="apply-course-code">{post.course_code}</span>
              <span className="apply-category">{post.category}</span>
            </div>
            <h4 className="apply-post-title">{post.title}</h4>
            <p className="apply-post-desc">{post.description}</p>
            <div className="apply-post-details">
              <span className="apply-bounty">৳{post.bounty}</span>
              <span className="apply-delivery">{getDeliveryLabel(post.delivery_format)}</span>
              {post.deadline && <span className="apply-deadline">Due: {post.deadline}</span>}
            </div>
          </div>

          {/* Poster Info */}
          <div className="apply-poster">
            <div className="apply-poster-avatar">
              {post.author_name ? post.author_name.charAt(0).toUpperCase() : '?'}
            </div>
            <div className="apply-poster-info">
              <div className="apply-poster-name">{post.author_name}</div>
              <div className="apply-poster-dept">{post.author_department || 'Department'}</div>
            </div>
            <span className="apply-poster-link">View Profile</span>
          </div>

          {/* Applied Teachers */}
          <div className="apply-section">
            <div className="apply-section-header">
              <h4>Applied Teachers</h4>
              <span className="apply-count">{applications.length}</span>
            </div>

            {loading ? (
              <div className="apply-loading">Loading applications...</div>
            ) : applications.length === 0 ? (
              <div className="apply-empty">No applications yet. Be the first to apply!</div>
            ) : (
              <div className="apply-list">
                {applications.map((app) => {
                  const badge = getStatusBadge(app.status);
                  return (
                    <div key={app.application_id} className="apply-item">
                      <div className="apply-item-avatar">
                        {app.applicant_name ? app.applicant_name.charAt(0).toUpperCase() : '?'}
                      </div>
                      <div className="apply-item-info">
                        <div className="apply-item-name">{app.applicant_name}</div>
                        <div className="apply-item-dept">{app.applicant_department}</div>
                        {app.message && <div className="apply-item-message">"{app.message}"</div>}
                      </div>
                      <div className="apply-item-right">
                        <span className={`apply-status-badge ${badge.class}`}>{badge.text}</span>
                        <span className="apply-time">{getTimeAgo(app.created_at)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Apply Form or Teacher Requirement Notice */}
          {user && !isOwnPost && !myApplication && (
            isTeacher ? (
              <div className="apply-form-section">
                <div className="apply-form-label">Your Message (optional)</div>
                <textarea
                  className="apply-message-input"
                  placeholder="Why are you a good fit for this? Mention your experience..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                />
              </div>
            ) : (
              <div className="apply-teacher-required-banner">
                <div className="apply-teacher-banner-icon">🎓</div>
                <div className="apply-teacher-banner-content">
                  <h4>Teacher Verification Required</h4>
                  <p>
                    Only verified peer tutors can apply for tutoring gigs and claim bounties. 
                    Submit your student ID and NID card verification to start tutoring peers.
                  </p>
                </div>
              </div>
            )
          )}

          {error && <div className="apply-error">{error}</div>}
          {success && <div className="apply-success">{success}</div>}
        </div>

        <div className="apply-modal-footer">
          <button className="apply-cancel-btn" onClick={onClose}>Close</button>
          {user && !isOwnPost && !myApplication && (
            isTeacher ? (
              <button
                className="apply-submit-btn"
                onClick={handleApply}
                disabled={submitting}
              >
                {submitting ? 'Applying...' : 'Apply Now'}
              </button>
            ) : (
              <button
                className="apply-submit-btn apply-teacher-redirect-btn"
                onClick={() => {
                  onClose();
                  if (onOpenTeacherModal) onOpenTeacherModal();
                }}
              >
                🎓 Apply for Teacher &rarr;
              </button>
            )
          )}
          {myApplication && (
            <div className="apply-my-status">
              <span className={`apply-status-badge ${getStatusBadge(myApplication.status).class}`}>
                Your Application: {getStatusBadge(myApplication.status).text}
              </span>
              {myApplication.status === 'pending' && (
                <button
                  className="apply-withdraw-btn"
                  onClick={handleWithdraw}
                  disabled={submitting}
                >
                  {submitting ? 'Withdrawing...' : 'Withdraw'}
                </button>
              )}
            </div>
          )}
          {isOwnPost && (
            <div className="apply-own-post-msg">This is your post</div>
          )}
          {!user && (
            <div className="apply-login-msg">Log in to apply</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ApplyModal;
