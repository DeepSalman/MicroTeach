import { useState, useEffect } from 'react';
import { fetchPostApplications, updateApplicationStatus } from './api';
import './PostDetailModal.css';

const PostDetailModal = ({ post, user, onClose, onStatusChange }) => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    loadApplications();
  }, [post.post_id]);

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

  const handleStatusChange = async (applicationId, newStatus) => {
    setActionLoading(applicationId);
    try {
      await updateApplicationStatus(applicationId, { status: newStatus, owner_id: user.user_id });
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

  const getStatusBadge = (status) => {
    const badges = {
      'pending': { class: 'status-pending', text: 'Pending' },
      'accepted': { class: 'status-accepted', text: 'Accepted' },
      'rejected': { class: 'status-rejected', text: 'Rejected' }
    };
    return badges[status] || badges['pending'];
  };

  return (
    <div className="pd-overlay" onClick={onClose}>
      <div className="pd-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pd-header">
          <h3>Post Details</h3>
          <button className="pd-close" onClick={onClose}>&times;</button>
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
                  return (
                    <div key={app.application_id} className="pd-item">
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
                        {app.status === 'pending' && (
                          <div className="pd-actions">
                            <button
                              className="pd-accept-btn"
                              onClick={() => handleStatusChange(app.application_id, 'accepted')}
                              disabled={actionLoading === app.application_id}
                            >
                              {actionLoading === app.application_id ? '...' : 'Accept'}
                            </button>
                            <button
                              className="pd-reject-btn"
                              onClick={() => handleStatusChange(app.application_id, 'rejected')}
                              disabled={actionLoading === app.application_id}
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
    </div>
  );
};

export default PostDetailModal;
