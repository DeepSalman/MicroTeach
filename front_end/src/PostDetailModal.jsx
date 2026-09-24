import { useState, useEffect } from 'react';
import { fetchPostApplications, updateApplicationStatus, closePost } from './api';
import ConfirmModal from './ConfirmModal';
import './PostDetailModal.css';

const PostDetailModal = ({ post, user, onClose, onStatusChange, onChat }) => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ open: false, title: '', message: '', type: 'info', onConfirm: () => {} });
  const [alertModal, setAlertModal] = useState({ open: false, title: '', message: '', type: 'info' });

  useEffect(() => {
    loadApplications();
  }, [post.post_id]);

  const handleClosePost = () => {
    setConfirmModal({
      open: true,
      title: 'Close Post',
      message: 'Are you sure you want to close this post?',
      type: 'danger',
      confirmText: 'Close Post',
      onConfirm: async () => {
        try {
          const res = await closePost(post.post_id, user.user_id);
          setAlertModal({ open: true, title: 'Post Closed', message: res.data.message, type: 'success' });
          setTimeout(() => onClose(), 1200);
        } catch (err) {
          setAlertModal({ open: true, title: 'Error', message: err.response?.data?.message || 'Failed to close post.', type: 'danger' });
        }
      }
    });
  };

  const loadApplications = async () => {
    setLoading(true);
    try {
      const response = await fetchPostApplications(post.post_id);
      setApplications(response.data);
    } catch (err) {
      console.error('Failed to load applications:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (applicationId, newStatus, requestedBy) => {
    setActionLoading(applicationId);
    try {
      await updateApplicationStatus(applicationId, { status: newStatus, owner_id: user.user_id, requested_by: requestedBy || null });
      loadApplications();
      if (onStatusChange) onStatusChange();
    } catch (err) {
      console.error('Failed to update status:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const getDeliveryLabel = (format) => {
    const labels = {
      'live_call': 'Google Meet (30m)',
      'annotated_pdf': 'Annotated Notes',
      'video_walkthrough': 'Video Walkthrough'
    };
    return labels[format] || 'Live Micro-Call';
  };

  const getStars = (rating) => {
    const r = Number(rating) || 0;
    const full = Math.floor(r);
    const half = r - full >= 0.3;
    let stars = '';
    for (let i = 0; i < full; i++) stars += '★';
    if (half) stars += '½';
    for (let i = full + (half ? 1 : 0); i < 5; i++) stars += '☆';
    return stars;
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

  const hasAcceptedApplicant = applications.some(a => a.status === 'accepted' || a.status === 'cancellation_requested' || a.status === 'completion_requested' || a.status === 'completed');

  const getStatusBadge = (status) => {
    const badges = {
      'pending': { class: 'status-pending', text: 'Pending' },
      'accepted': { class: 'status-accepted', text: 'Accepted' },
      'rejected': { class: 'status-rejected', text: 'Rejected' },
      'cancellation_requested': { class: 'status-pending', text: 'Cancel Requested' },
      'cancelled': { class: 'status-rejected', text: 'Cancelled' },
      'completion_requested': { class: 'status-accepted', text: 'Completion Requested' },
      'completed': { class: 'status-accepted', text: 'Completed' }
    };
    return badges[status] || badges['pending'];
  };

  return (
    <div className="pd-overlay" onClick={onClose}>
      <div className="pd-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pd-header">
          <h3>Post Details</h3>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {post.status !== 'closed' && (
              <button className="pd-close-post" onClick={handleClosePost}>Close Post</button>
            )}
            <button className="pd-close" onClick={onClose}>&times;</button>
          </div>
        </div>

        <div className="pd-body">
          {/* Post Info */}
          <div className="pd-post-info">
            <div className="pd-post-meta">
              <span className="pd-course-code">{post.course_code}</span>
              <span className="pd-category">{post.category}</span>
            </div>
            <h4 className="pd-post-title">{post.title}</h4>
            <p className="pd-post-desc">{post.description}</p>
            <div className="pd-post-details">
              <span className="pd-bounty">৳{post.bounty}</span>
              <span className="pd-delivery">{getDeliveryLabel(post.delivery_format)}</span>
              {post.deadline && <span className="pd-deadline">Due: {post.deadline}</span>}
            </div>
          </div>

          {/* Applied Teachers */}
          <div className="pd-section">
            <div className="pd-section-header">
              <h4>Applied Teachers</h4>
              <span className="pd-count">{applications.length}</span>
            </div>

            {loading ? (
              <div className="pd-loading">Loading applications...</div>
            ) : applications.length === 0 ? (
              <div className="pd-empty">No applications yet.</div>
            ) : (
              <div className="pd-list">
                {applications.map((app) => {
                  const badge = getStatusBadge(app.status);
                  const rating = Number(app.avg_rating) || 0;
                  const reviewCount = app.review_count || 0;
                  const isAccepted = app.status === 'accepted';
                  const isPending = app.status === 'pending';
                  const isCancelRequested = app.status === 'cancellation_requested';
                  const isCancelled = app.status === 'cancelled';
                  const isCompletionRequested = app.status === 'completion_requested';
                  const isCompleted = app.status === 'completed';
                  return (
                    <div key={app.application_id} className={`pd-item ${isAccepted ? 'pd-item--accepted' : ''} ${isCancelRequested ? 'pd-item--cancel-requested' : ''} ${isCancelled ? 'pd-item--cancelled' : ''} ${isCompleted ? 'pd-item--completed' : ''}`}>
                      <div className="pd-item-left">
                        <div className="pd-item-avatar">
                          {app.applicant_name ? app.applicant_name.charAt(0).toUpperCase() : '?'}
                        </div>
                        <div className="pd-item-info">
                          <div className="pd-item-name-row">
                            <span className="pd-item-name">{app.applicant_name}</span>
                            <span className={`pd-status-badge ${badge.class}`}>{badge.text}</span>
                          </div>
                          <div className="pd-item-dept">{app.applicant_department}</div>
                          {app.message && <div className="pd-item-message">"{app.message}"</div>}
                          <div className="pd-item-meta">
                            <span className="pd-item-time">Applied {getTimeAgo(app.created_at)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="pd-item-right">
                        <div className="pd-rating">
                          <span className="pd-stars">{getStars(rating)}</span>
                          <span className="pd-rating-num">{rating > 0 ? rating.toFixed(1) : '—'}</span>
                          {reviewCount > 0 && <span className="pd-review-count">({reviewCount})</span>}
                        </div>
                        <span className="pd-view-profile">View Profile</span>
                        {isAccepted && (
                          <div className="pd-accepted-actions">
                            <span className="pd-chat-icon" onClick={() => onChat && onChat(app.user_id)}>chat</span>
                            <button
                              className="pd-complete-btn"
                              onClick={() => handleStatusChange(app.application_id, 'completion_requested', post.user_id)}
                              disabled={actionLoading === app.application_id}
                            >
                              {actionLoading === app.application_id ? '...' : 'Mark Complete'}
                            </button>
                            <button
                              className="pd-cancel-btn"
                              onClick={() => handleStatusChange(app.application_id, 'cancellation_requested')}
                              disabled={actionLoading === app.application_id}
                            >
                              {actionLoading === app.application_id ? '...' : 'Request Cancellation'}
                            </button>
                          </div>
                        )}
                        {isCompletionRequested && String(app.completion_requested_by) !== String(post.user_id) && (
                          <div className="pd-accepted-actions">
                            <button
                              className="pd-complete-btn"
                              onClick={() => handleStatusChange(app.application_id, 'completed')}
                              disabled={actionLoading === app.application_id}
                            >
                              {actionLoading === app.application_id ? '...' : 'Accept Completion'}
                            </button>
                            <button
                              className="pd-cancel-btn"
                              onClick={() => handleStatusChange(app.application_id, 'accepted')}
                              disabled={actionLoading === app.application_id}
                            >
                              {actionLoading === app.application_id ? '...' : 'Not Yet'}
                            </button>
                          </div>
                        )}
                        {isCompletionRequested && String(app.completion_requested_by) === String(post.user_id) && (
                          <div className="pd-accepted-actions">
                            <span className="pd-waiting-badge">Waiting for tutor...</span>
                          </div>
                        )}
                        {isCompleted && (
                          <div className="pd-accepted-actions">
                            <span className="pd-completed-badge">Session Complete</span>
                          </div>
                        )}
                        {isCancelRequested && (
                          <div className="pd-accepted-actions">
                            <button
                              className="pd-cancel-btn"
                              onClick={() => handleStatusChange(app.application_id, 'cancelled')}
                              disabled={actionLoading === app.application_id}
                            >
                              {actionLoading === app.application_id ? '...' : 'Cancel Request'}
                            </button>
                            <button
                              className="pd-accept-btn"
                              onClick={() => handleStatusChange(app.application_id, 'accepted')}
                              disabled={actionLoading === app.application_id}
                            >
                              {actionLoading === app.application_id ? '...' : 'Keep Tutor'}
                            </button>
                          </div>
                        )}
                        {isPending && (
                          <div className="pd-actions">
                            <button
                              className="pd-accept-btn"
                              onClick={() => handleStatusChange(app.application_id, 'accepted')}
                              disabled={actionLoading === app.application_id || hasAcceptedApplicant}
                            >
                              {actionLoading === app.application_id ? '...' : 'Accept'}
                            </button>
                            <button
                              className="pd-reject-btn"
                              onClick={() => handleStatusChange(app.application_id, 'rejected')}
                              disabled={actionLoading === app.application_id || hasAcceptedApplicant}
                            >
                              {actionLoading === app.application_id ? '...' : 'Reject'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="pd-footer">
          <button className="pd-close-btn" onClick={onClose}>Close</button>
        </div>
      </div>

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirmModal.open}
        onClose={() => setConfirmModal({ ...confirmModal, open: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        confirmText={confirmModal.confirmText}
      />

      {/* Alert Modal */}
      <ConfirmModal
        isOpen={alertModal.open}
        onClose={() => setAlertModal({ ...alertModal, open: false })}
        onConfirm={() => setAlertModal({ ...alertModal, open: false })}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
        confirmText="OK"
      />
    </div>
  );
};

export default PostDetailModal;
