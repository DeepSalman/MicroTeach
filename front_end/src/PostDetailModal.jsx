import { useState, useEffect, useCallback } from 'react';
import { fetchPostApplications, updateApplicationStatus, closePost, checkReviewExists, fetchUserProfile, applyToPost, withdrawApplication } from './api';
import ConfirmModal from './ConfirmModal';
import ReviewModal from './ReviewModal';
import TransactionReportModal from './TransactionReportModal';
import PostComments from './PostComments';
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

const ApplicantProfileModal = ({ applicant, onClose }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    fetchUserProfile(applicant.user_id)
      .then((response) => {
        if (isMounted) setProfile(response.data?.user ? response.data : { user: response.data, posts: [] });
      })
      .catch(() => {})
      .finally(() => { if (isMounted) setLoading(false); });
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      isMounted = false;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [applicant.user_id, onClose]);

  const profileUser = profile?.user || applicant;
  const posts = Array.isArray(profile?.posts) ? profile.posts : [];

  return (
    <div className="pd-profile-overlay" onMouseDown={onClose}>
      <section className="pd-profile-modal" role="dialog" aria-modal="true" aria-labelledby="pd-profile-name" onMouseDown={(event) => event.stopPropagation()}>
        <header className="pd-profile-header">
          <span>Teacher Profile</span>
          <button type="button" className="pd-profile-close" onClick={onClose} aria-label="Close teacher profile">&times;</button>
        </header>
        <div className="pd-profile-body">
          <div className="pd-profile-identity">
            <div className="pd-profile-avatar" style={avatarStyle(profileUser.avatar_color || applicant.applicant_avatar_color)}>
              {(profileUser.full_name || applicant.applicant_name || '?').charAt(0).toUpperCase()}
            </div>
            <div>
              <h4 id="pd-profile-name">{profileUser.full_name || applicant.applicant_name}</h4>
              <p>{profileUser.department || applicant.applicant_department || 'Department not listed'}</p>
              <span className="pd-profile-role">Verified teacher</span>
            </div>
          </div>

          <div className="pd-profile-rating">
            <span className="pd-stars">{'★'.repeat(Math.round(Number(applicant.avg_rating) || 0))}{'☆'.repeat(5 - Math.round(Number(applicant.avg_rating) || 0))}</span>
            <strong>{Number(applicant.avg_rating || 0).toFixed(1)}</strong>
            <span>{applicant.review_count || 0} reviews</span>
          </div>

          <section className="pd-profile-section">
            <h5>About</h5>
            <p>{loading ? 'Loading profile...' : profileUser.bio || 'No introduction added yet.'}</p>
          </section>

          <section className="pd-profile-section">
            <h5>Posts</h5>
            {loading ? (
              <p>Loading posts...</p>
            ) : posts.length === 0 ? (
              <p>No active posts yet.</p>
            ) : (
              <ul className="pd-profile-posts">
                {posts.slice(0, 5).map((profilePost) => (
                  <li key={profilePost.post_id}>
                    <strong>{profilePost.title}</strong>
                    <span>{profilePost.category}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </section>
    </div>
  );
};

const PostDetailModal = ({ post, user, onClose, onStatusChange, onChat, onLoginRequired, onApplyTeacher, canApply, teacherApplicationPending, onApplySuccess, onWithdrawSuccess }) => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [applicationMessage, setApplicationMessage] = useState('');
  const [applicationSubmitting, setApplicationSubmitting] = useState(false);
  const [applicationError, setApplicationError] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ open: false, title: '', message: '', type: 'info', onConfirm: () => {} });
  const [alertModal, setAlertModal] = useState({ open: false, title: '', message: '', type: 'info' });
  const [reviewModal, setReviewModal] = useState({ open: false, revieweeId: null, revieweeName: '' });
  const [txDisputeOpen, setTxDisputeOpen] = useState(false);
  const [reviewedApps, setReviewedApps] = useState(new Set());
  const [postOwnerProfile, setPostOwnerProfile] = useState(null);
  const [profileApplicant, setProfileApplicant] = useState(null);
  const isPostOwner = Boolean(user?.user_id && String(user.user_id) === String(post.user_id));

  useEffect(() => {
    let isMounted = true;
    fetchUserProfile(post.user_id)
      .then((response) => {
        if (isMounted) setPostOwnerProfile(response.data?.user || response.data);
      })
      .catch(() => {});
    return () => { isMounted = false; };
  }, [post.user_id]);

  const loadApplications = useCallback(() => {
    return fetchPostApplications(post.post_id, user?.user_id)
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
    if (user?.user_id) {
      loadApplications();
    } else {
      setApplications([]);
      setLoading(false);
    }
  }, [user?.user_id, loadApplications]);

  const myApplication = user?.user_id
    ? applications.find((application) => String(application.user_id) === String(user.user_id))
    : null;
  const canUserApply = canApply ?? ['tutor', 'both'].includes(user?.role);

  const handleApply = async () => {
    if (!user?.user_id || !canUserApply || isPostOwner || applicationSubmitting) return;
    setApplicationSubmitting(true);
    setApplicationError('');
    try {
      await applyToPost({
        post_id: post.post_id,
        user_id: user.user_id,
        message: applicationMessage.trim()
      });
      setApplicationMessage('');
      await loadApplications();
      onApplySuccess?.(post.post_id);
      onStatusChange?.();
    } catch (error) {
      setApplicationError(error.response?.data?.message || 'Could not apply to this post. Please try again.');
    } finally {
      setApplicationSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    if (!myApplication || applicationSubmitting) return;
    setApplicationSubmitting(true);
    setApplicationError('');
    try {
      await withdrawApplication(myApplication.application_id);
      await loadApplications();
      onWithdrawSuccess?.(post.post_id);
      onStatusChange?.();
    } catch (error) {
      setApplicationError(error.response?.data?.message || 'Could not withdraw this application. Please try again.');
    } finally {
      setApplicationSubmitting(false);
    }
  };

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
      await updateApplicationStatus(applicationId, {
        status: newStatus,
        owner_id: post.user_id,
        actor_id: user?.user_id,
        requested_by: requestedBy || null
      });
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

  const ownerName = postOwnerProfile?.full_name || post.author_name || 'Post owner';
  const ownerDepartment = postOwnerProfile?.department || post.author_department;
  const ownerAvatarColor = postOwnerProfile?.avatar_color || post.author_avatar_color;
  const ownerRole = postOwnerProfile?.role === 'tutor'
    ? 'Verified teacher'
    : postOwnerProfile?.role === 'both'
      ? 'Student and teacher'
      : 'Student';

  const handleMessageOwner = () => {
    if (!user?.user_id) {
      onLoginRequired?.();
      return;
    }
    if (!isPostOwner) onChat?.(post.user_id, post.post_id);
  };

  return (
    <div className="pd-overlay" onClick={onClose}>
      <div className="pd-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pd-header">
          <h3>Post Details</h3>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {isPostOwner && post.status !== 'closed' && !isPostSettled && (
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
              {post.course_code && (
                <span className="pd-course-code">
                  {post.category === 'University Level' ? 'Course' : 'Subject'}: {post.course_code}
                </span>
              )}
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

          <section className="pd-post-owner" aria-label="Post owner profile">
            <div className="pd-post-owner-avatar" style={avatarStyle(ownerAvatarColor)}>
              {ownerName.charAt(0).toUpperCase()}
            </div>
            <div className="pd-post-owner-info">
              <div className="pd-post-owner-name">{ownerName}</div>
              <div className="pd-post-owner-details">
                {ownerDepartment && <span>{ownerDepartment}</span>}
                <span>{ownerRole}</span>
              </div>
              {postOwnerProfile?.bio && <p>{postOwnerProfile.bio}</p>}
            </div>
            <div className="pd-post-owner-actions">
              {isPostOwner ? (
                <span className="pd-post-owner-self">Your post</span>
              ) : (
                <button type="button" className="pd-message-owner" onClick={handleMessageOwner}>
                  {user?.user_id ? 'Message' : 'Log in to message'}
                </button>
              )}
            </div>
          </section>

          {!isPostOwner && (
            <section className="pd-section pd-apply-section">
              <div className="pd-section-header">
                <h4>Your Application</h4>
                {myApplication && <span className={`pd-status-badge ${getStatusBadge(myApplication.status).class}`}>{getStatusBadge(myApplication.status).text}</span>}
              </div>
              {loading ? (
                <div className="pd-loading">Checking your application...</div>
              ) : myApplication ? (
                <div className="pd-my-application">
                  <span>You have applied to this post.</span>
                </div>
              ) : !user ? (
                <p className="pd-apply-notice">Log in to apply for this post.</p>
              ) : canUserApply ? (
                <>
                  <div className="pd-apply-message-heading">
                    <label className="pd-apply-label" htmlFor={`pd-apply-message-${post.post_id}`}>Message to the student</label>
                    <span>Optional</span>
                  </div>
                  <textarea
                    id={`pd-apply-message-${post.post_id}`}
                    className="pd-apply-message"
                    value={applicationMessage}
                    onChange={(event) => setApplicationMessage(event.target.value)}
                    maxLength={1000}
                    rows={3}
                    placeholder="Introduce yourself and explain how you can help..."
                  />
                  <p className="pd-apply-hint">Your message will be sent with your application.</p>
                </>
              ) : teacherApplicationPending ? (
                <span className="pd-apply-notice">Your teacher application is pending approval.</span>
              ) : (
                <div className="pd-apply-requirement">
                  <span>Only verified teachers can apply to this post.</span>
                </div>
              )}
              {applicationError && <p className="pd-apply-error" role="alert">{applicationError}</p>}
            </section>
          )}

          <PostComments
            postId={post.post_id}
            user={user}
            onLoginRequired={onLoginRequired}
          />

          {/* Applied Teachers */}
          {isPostOwner && <div className="pd-section">
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
                          <button
                            type="button"
                            className="pd-view-profile"
                            onClick={() => setProfileApplicant(app)}
                            aria-haspopup="dialog"
                          >
                            View Profile
                          </button>
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
                              onClick={() => setConfirmModal({
                                open: true,
                                title: 'Cancel this tutoring session?',
                                message: 'This will cancel the accepted application and refund the post bounty to the student. This action cannot be undone.',
                                type: 'danger',
                                confirmText: 'Confirm Cancel',
                                cancelText: 'Keep Session',
                                onConfirm: () => handleStatusChange(app.application_id, 'cancelled')
                              })}
                              disabled={actionLoading === app.application_id}
                            >
                              {actionLoading === app.application_id ? '...' : 'Cancel'}
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
                              onClick={() => setConfirmModal({
                                open: true,
                                title: 'Confirm cancellation?',
                                message: 'This will cancel the tutoring session and refund the bounty to the student. This action cannot be undone.',
                                type: 'danger',
                                confirmText: 'Confirm Cancel',
                                cancelText: 'Keep Tutor',
                                onConfirm: () => handleStatusChange(app.application_id, 'cancelled')
                              })}
                              disabled={actionLoading === app.application_id}
                            >
                              {actionLoading === app.application_id ? '...' : 'Confirm Cancel'}
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
          </div>}
        </div>

        <div className="pd-footer">
          {!isPostOwner && !loading && (
            myApplication?.status === 'pending' ? (
              <button type="button" className="pd-withdraw-btn" onClick={handleWithdraw} disabled={applicationSubmitting}>
                {applicationSubmitting ? 'Withdrawing...' : 'Withdraw'}
              </button>
            ) : !myApplication && !user ? (
              <button type="button" className="pd-apply-btn" onClick={onLoginRequired}>Log in to apply</button>
            ) : !myApplication && canUserApply ? (
              <button type="button" className="pd-apply-btn" onClick={handleApply} disabled={applicationSubmitting}>
                {applicationSubmitting ? 'Applying...' : 'Apply to this post'}
              </button>
            ) : !myApplication && teacherApplicationPending ? (
              <span className="pd-apply-notice">Application Pending</span>
            ) : !myApplication ? (
              <button type="button" className="pd-apply-btn" onClick={onApplyTeacher}>Apply to Teach</button>
            ) : null
          )}
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
        cancelText={confirmModal.cancelText}
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

      {profileApplicant && (
        <ApplicantProfileModal
          applicant={profileApplicant}
          onClose={() => setProfileApplicant(null)}
        />
      )}
    </div>
  );
};

export default PostDetailModal;
