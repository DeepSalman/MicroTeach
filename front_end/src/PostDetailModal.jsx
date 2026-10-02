import { useState, useEffect, useCallback } from 'react';
import { fetchPostApplications, updateApplicationStatus, closePost, checkReviewExists } from './api';
import ConfirmModal from './ConfirmModal';
import ReviewModal from './ReviewModal';
import TransactionReportModal from './TransactionReportModal';
import { formatDeadline, avatarStyle } from './utils';
import './PostDetailModal.css';

const getTimeAgo = (dateStr) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const PostDetailModal = ({ post, user, onClose, onStatusChange, onChat }) => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ open: false, title: '', message: '', type: 'info', onConfirm: () => {} });
  const [alertModal, setAlertModal] = useState({ open: false, title: '', message: '', type: 'info' });
  const [reviewModal, setReviewModal] = useState({ open: false, revieweeId: null, revieweeName: '' });
  const [txDisputeOpen, setTxDisputeOpen] = useState(false);
  const [reviewedApps, setReviewedApps] = useState(new Set());

  const loadApplications = useCallback(() => {
    return fetchPostApplications(post.post_id)
      .then((response) => {
        setApplications(response.data);
        const reviewed = new Set();
        const checks = response.data
          .filter((app) => app.status === 'completed')
          .map((app) => {
            if (!user?.user_id) return Promise.resolve();
            return checkReviewExists(post.post_id, user.user_id)
              .then((res) => {
                if (res.data.exists) reviewed.add(app.application_id);
              })
              .catch(() => {});
          });
        return Promise.all(checks).then(() => { setReviewedApps(reviewed); });
      })
      .catch((err) => { console.error('Failed to load applications:', err); })
      .finally(() => { setLoading(false); });
  }, [post.post_id, user?.user_id]);

  useEffect(() => {
    loadApplications();
  }, [loadApplications]);

  const handleClosePost = () => {
    setConfirmModal({
      open: true,
      title: 'Close Post',
      message: 'Are you sure you want to close this post?',
      type: 'danger',
      confirmText: 'Close Post',
      onConfirm: async () => {
        try {
          const res = await closePost(post.post_id, user?.user_id);
          setAlertModal({ open: true, title: 'Post Closed', message: res.data.message, type: 'success' });
          setTimeout(() => onClose(), 1200);
        } catch (err) {
          setAlertModal({ open: true, title: 'Error', message: err.response?.data?.message || 'Failed to close post.', type: 'danger' });
        }
      }
    });
  };

  const handleStatusChange = async (applicationId, newStatus, requestedBy) => {
    setActionLoading(applicationId);
    try {
      await updateApplicationStatus(applicationId, { status: newStatus, owner_id: user?.user_id, requested_by: requestedBy || null });
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

  const isPostSettled = post.status === 'completed' || post.status === 'resolved' || Boolean(post.is_completed) || applications.some(a => a.status === 'completed');
  const hasAcceptedApplicant = applications.some(a => a.status === 'accepted' || a.status === 'cancellation_requested' || a.status === 'completion_requested' || a.status === 'completed');

  const getAvatarTone = (name = '') => {
    let sum = 0;
    for (let i = 0; i < name.length; i += 1) sum += name.charCodeAt(i);
    return sum % 4;
  };

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
            {post.status !== 'closed' && !isPostSettled && (
              <button className="pd-close-post" onClick={handleClosePost}>Close Post</button>
            )}
            {isPostSettled && (
              <span className="pd-completed-badge">✓ Settled</span>
            )}
            <button className="pd-close" onClick={onClose}>&times;</button>
          </div>
        </div>

        <div className="pd-body">
          {/* Post Info */}
          <div className="pd-post-info">
            <div className="pd-post-meta">
              {post.course_code && <span className="pd-course-code">{post.course_code}</span>}
              <span className="pd-category">{post.category}</span>
            </div>
            <h4 className="pd-post-title">{post.title}</h4>
            <p className="pd-post-desc">{post.description}</p>
            <div className="pd-post-details">
              <span className="pd-bounty">৳{post.bounty}</span>
              <span className="pd-delivery">{getDeliveryLabel(post.delivery_format)}</span>
              {post.deadline && <span className="pd-deadline">Due: {formatDeadline(post.deadline)}</span>}
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
                      <div className="pd-item-top">
                        <div className={`pd-item-avatar tone-${getAvatarTone(app.applicant_name)}`} style={avatarStyle(app.applicant_avatar_color)}>
                          {app.applicant_name ? app.applicant_name.charAt(0).toUpperCase() : '?'}
                        </div>
                        <div className="pd-item-info">
                          <div className="pd-item-name-row">
                            <span className="pd-item-name">{app.applicant_name}</span>
                            <span className={`pd-status-badge ${badge.class}`}>{badge.text}</span>
                          </div>
                          {app.applicant_department && <div className="pd-item-dept">{app.applicant_department}</div>}
                          <div className="pd-item-meta">Applied {getTimeAgo(app.created_at)}</div>
                        </div>
                        <div className="pd-item-side">
                          <div className="pd-rating">
                            <span className="pd-stars">{getStars(rating)}</span>
                            <span className="pd-rating-num">{rating > 0 ? rating.toFixed(1) : '—'}</span>
                            {reviewCount > 0 && <span className="pd-review-count">({reviewCount})</span>}
                          </div>
                          <span className="pd-view-profile">View Profile</span>
                        </div>
                      </div>

                      {app.message && <p className="pd-item-message">"{app.message}"</p>}
                        {isAccepted && !isPostSettled && (
                          <div className="pd-actions">
                            <button className="pd-chat-btn" onClick={() => onChat && onChat(app.user_id)}>Chat</button>
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
                            <button
                              className="pd-dispute-btn"
                              onClick={() => setTxDisputeOpen(true)}
                              title="Report Transaction / Escrow Issue"
                            >
                              Dispute Escrow
                            </button>
                          </div>
                        )}
                        {isCompletionRequested && !isPostSettled && app.completion_requested_by && String(app.completion_requested_by) !== String(post.user_id) && (
                          <div className="pd-actions">
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
                            <button
                              className="pd-dispute-btn"
                              onClick={() => setTxDisputeOpen(true)}
                              title="Report Transaction / Escrow Issue"
                            >
                              Dispute Escrow
                            </button>
                          </div>
                        )}
                        {isCompletionRequested && !isPostSettled && (!app.completion_requested_by || String(app.completion_requested_by) === String(post.user_id)) && (
                          <div className="pd-actions">
                            <span className="pd-waiting-badge">Waiting for tutor...</span>
                            <button
                              className="pd-dispute-btn"
                              onClick={() => setTxDisputeOpen(true)}
                              title="Report Transaction / Escrow Issue"
                            >
                              Dispute Escrow
                            </button>
                          </div>
                        )}
                        {isCompleted && (
                          <div className="pd-actions">
                            <span className="pd-completed-badge">Session Complete</span>
                            {!reviewedApps.has(app.application_id) && (
                              <button
                                className="pd-review-btn"
                                onClick={() => setReviewModal({ open: true, revieweeId: app.user_id, revieweeName: app.applicant_name })}
                              >
                                Write Review
                              </button>
                            )}
                            {reviewedApps.has(app.application_id) && (
                              <span className="pd-reviewed-badge">Reviewed</span>
                            )}
                          </div>
                        )}
                        {isCancelRequested && !isPostSettled && (
                          <div className="pd-actions">
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
                            <button
                              className="pd-dispute-btn"
                              onClick={() => setTxDisputeOpen(true)}
                              title="Report Transaction / Escrow Issue"
                            >
                              Dispute Escrow
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

      {/* Review Modal */}
      <ReviewModal
        isOpen={reviewModal.open}
        onClose={() => setReviewModal({ open: false, revieweeId: null, revieweeName: '' })}
        reviewerId={user?.user_id}
        revieweeId={reviewModal.revieweeId}
        postId={post.post_id}
        revieweeName={reviewModal.revieweeName}
        onReviewSubmitted={loadApplications}
      />

      {/* Transaction Dispute / Escrow Report Modal */}
      {txDisputeOpen && (
        <TransactionReportModal
          post={{
            ...post,
            is_completed: isPostSettled
          }}
          user={user}
          isOpen={txDisputeOpen}
          onClose={() => setTxDisputeOpen(false)}
          onSuccess={() => {
            setTxDisputeOpen(false);
            loadApplications();
            if (onStatusChange) onStatusChange();
          }}
        />
      )}
    </div>
  );
};

export default PostDetailModal;
