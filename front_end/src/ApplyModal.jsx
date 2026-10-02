import { useState, useEffect, useCallback } from 'react';
import { fetchPostApplications, applyToPost, withdrawApplication, fetchUserProfile, fetchUserRating, fetchUserReviews } from './api';
import { formatDeadline, avatarStyle } from './utils';
import './ApplyModal.css';

const getTimeAgo = (dateStr) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const ApplyModal = ({ post, user, onClose, onApplySuccess, onWithdrawSuccess, onOpenTeacherModal }) => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showStudentProfile, setShowStudentProfile] = useState(false);
  const [studentProfileData, setStudentProfileData] = useState(null);
  const [studentRating, setStudentRating] = useState(null);
  const [studentReviews, setStudentReviews] = useState([]);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const handleOpenStudentProfile = async () => {
    if (!post?.user_id) return;
    setShowStudentProfile(true);
    setLoadingProfile(true);
    try {
      const [profileRes, ratingRes, reviewsRes] = await Promise.all([
        fetchUserProfile(post.user_id),
        fetchUserRating(post.user_id),
        fetchUserReviews(post.user_id)
      ]);
      setStudentProfileData(profileRes.data?.user || profileRes.data || null);
      setStudentRating(ratingRes.data || null);
      setStudentReviews(Array.isArray(reviewsRes.data) ? reviewsRes.data : []);
    } catch (err) {
      console.error('Failed to load student profile:', err);
    } finally {
      setLoadingProfile(false);
    }
  };

  const myApplication = user ? applications.find(a => String(a.user_id) === String(user.user_id)) : null;
  const isOwnPost = user && String(post.user_id) === String(user.user_id);
  const isTeacher = user && (user.role === 'both' || user.role === 'tutor');

  const loadApplications = useCallback(() => {
    return fetchPostApplications(post.post_id)
      .then((res) => { setApplications(res.data); })
      .catch((err) => { console.error('Failed to load applications:', err); })
      .finally(() => { setLoading(false); });
  }, [post.post_id]);

  useEffect(() => {
    loadApplications();
  }, [loadApplications]);

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
      const raw = err.response?.data?.message || err.response?.data?.error || err.message;
      const msg = typeof raw === 'string'
        ? raw
        : (raw?.message || (raw && typeof raw === 'object' ? JSON.stringify(raw) : null) || 'Failed to submit application.');
      setError(msg);
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
      const raw = err.response?.data?.message || err.response?.data?.error || err.message;
      const msg = typeof raw === 'string'
        ? raw
        : (raw?.message || (raw && typeof raw === 'object' ? JSON.stringify(raw) : null) || 'Failed to withdraw application.');
      setError(msg);
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

  const getAvatarTone = (name = '') => {
    let sum = 0;
    for (let i = 0; i < name.length; i += 1) sum += name.charCodeAt(i);
    return sum % 4;
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
              {post.course_code && <span className="apply-course-code">{post.course_code}</span>}
              <span className="apply-category">{post.category}</span>
            </div>
            <h4 className="apply-post-title">{post.title}</h4>
            <p className="apply-post-desc">{post.description}</p>
            <div className="apply-post-details">
              <span className="apply-bounty">৳{post.bounty}</span>
              <span className="apply-delivery">{getDeliveryLabel(post.delivery_format)}</span>
              {post.deadline && <span className="apply-deadline">Due: {formatDeadline(post.deadline)}</span>}
            </div>
          </div>

          {/* Poster Info */}
          <div className="apply-poster" onClick={handleOpenStudentProfile} style={{ cursor: 'pointer' }}>
            <div className={`apply-poster-avatar tone-${getAvatarTone(post.author_name)}`} style={avatarStyle(post.author_avatar_color)}>
              {post.author_name ? post.author_name.charAt(0).toUpperCase() : '?'}
            </div>
            <div className="apply-poster-info">
              <div className="apply-poster-name">{post.author_name}</div>
              <div className="apply-poster-dept">{post.author_department || 'Department'}</div>
            </div>
            <button
              type="button"
              className="apply-poster-link"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenStudentProfile();
              }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              View Profile
            </button>
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
                      <div className={`apply-item-avatar tone-${getAvatarTone(app.applicant_name)}`} style={avatarStyle(app.applicant_avatar_color)}>
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

      {/* Student Profile Popup Modal */}
      {showStudentProfile && (
        <div className="student-profile-overlay" onClick={() => setShowStudentProfile(false)}>
          <div className="student-profile-popup" onClick={(e) => e.stopPropagation()}>
            <div className="student-popup-header">
              <h4>Student Profile</h4>
              <button className="student-popup-close" onClick={() => setShowStudentProfile(false)}>&times;</button>
            </div>
            
            {loadingProfile ? (
              <div className="student-popup-loading">
                <div className="student-popup-spinner"></div>
                <p>Loading profile details...</p>
              </div>
            ) : (
              <div className="student-popup-body">
                {/* Hero / Avatar & Basic Info */}
                <div className="student-popup-hero">
                  <div
                    className={`student-popup-avatar tone-${getAvatarTone(studentProfileData?.name || post.author_name)}`}
                    style={avatarStyle(studentProfileData?.avatar_color || post.author_avatar_color)}
                  >
                    {(studentProfileData?.name || post.author_name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="student-popup-details">
                    <h3 className="student-popup-name">{studentProfileData?.name || post.author_name}</h3>
                    <div className="student-popup-badges">
                      <span className="student-popup-dept">
                        {studentProfileData?.department || post.author_department || 'Student'}
                      </span>
                      {studentProfileData?.institution && (
                        <span className="student-popup-inst">{studentProfileData.institution}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Rating Bar */}
                <div className="student-popup-rating-bar">
                  <div className="student-rating-stat">
                    <span className="student-star">★</span>
                    <span className="student-avg-score">
                      {studentRating?.average_rating ? Number(studentRating.average_rating).toFixed(1) : 'No ratings'}
                    </span>
                    {studentRating?.total_reviews > 0 && (
                      <span className="student-review-count">({studentRating.total_reviews} reviews)</span>
                    )}
                  </div>
                </div>

                {/* Bio / About */}
                {studentProfileData?.bio && (
                  <div className="student-popup-bio">
                    <span className="student-popup-section-title">About</span>
                    <p>{studentProfileData.bio}</p>
                  </div>
                )}

                {/* Reviews Section */}
                <div className="student-popup-reviews-section">
                  <span className="student-popup-section-title">Reviews</span>
                  {studentReviews.length === 0 ? (
                    <div className="student-no-reviews">No reviews recorded yet for this student.</div>
                  ) : (
                    <div className="student-reviews-list">
                      {studentReviews.map((rev, idx) => (
                        <div key={rev.review_id || idx} className="student-review-card">
                          <div className="student-rev-header">
                            <span className="student-rev-name">{rev.reviewer_name || 'Anonymous User'}</span>
                            <div className="student-rev-stars">
                              {'★'.repeat(rev.rating || 5)}{'☆'.repeat(Math.max(0, 5 - (rev.rating || 5)))}
                            </div>
                          </div>
                          {rev.comment && <p className="student-rev-comment">{rev.comment}</p>}
                          <span className="student-rev-time">{getTimeAgo(rev.created_at)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ApplyModal;
