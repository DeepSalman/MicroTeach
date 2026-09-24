import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchUserProfile, fetchUserApplications, submitTeacherApplication, fetchUserPostApplications, fetchPostApplicationCount, updateApplicationStatus, closePost } from './api';
import PostDetailModal from './PostDetailModal';
import ChatModal from './ChatModal';
import WalletModal from './WalletModal';
import ConfirmModal from './ConfirmModal';
import './Profile.css';

const Profile = ({ user, onLogout, onProfileUpdate }) => {
  const navigate = useNavigate();
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [applicationStatus, setApplicationStatus] = useState(null);
  const [applicationData, setApplicationData] = useState(null);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applyReason, setApplyReason] = useState('');
  const [applyExpertise, setApplyExpertise] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [postApplications, setPostApplications] = useState([]);
  const [postApplicantCounts, setPostApplicantCounts] = useState({});
  const [detailModalPost, setDetailModalPost] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatStartUser, setChatStartUser] = useState(null);
  const [walletOpen, setWalletOpen] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [confirmModal, setConfirmModal] = useState({ open: false, title: '', message: '', type: 'info', onConfirm: () => {} });
  const [alertModal, setAlertModal] = useState({ open: false, title: '', message: '', type: 'info' });

  useEffect(() => {
    if (user?.user_id) {
      loadProfile();
      checkApplicationStatus();
      loadPostApplications();
    }
  }, [user]);

  const loadProfile = async () => {
    try {
      const response = await fetchUserProfile(user.user_id);
      setProfileData(response.data);
      setWalletBalance(response.data.user?.wallet_balance || 0);

      const freshRole = response.data.user.role;
      if (freshRole !== user.role) {
        const updatedUser = { ...user, role: freshRole };
        localStorage.setItem('microteach_user', JSON.stringify(updatedUser));
        if (onProfileUpdate) onProfileUpdate(updatedUser);
      }

      if (response.data.posts?.length > 0) {
        loadApplicantCounts(response.data.posts);
      }
    } catch (err) {
      setError('Failed to load profile data.');
      console.error('Profile load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const checkApplicationStatus = async () => {
    try {
      const response = await fetchUserApplications(user.user_id);
      if (response.data.length > 0) {
        const latest = response.data[0];
        setApplicationStatus(latest.status);
        setApplicationData(latest);
      }
    } catch (err) {
      console.error('Failed to check application status:', err);
    }
  };

  const loadPostApplications = async () => {
    try {
      const response = await fetchUserPostApplications(user.user_id);
      setPostApplications(response.data);
    } catch (err) {
      console.error('Failed to load post applications:', err);
    }
  };

  const handleClosePost = async (postId) => {
    setConfirmModal({
      open: true,
      title: 'Close Post',
      message: 'Are you sure you want to close this post? The bounty will be refunded to your wallet.',
      type: 'danger',
      confirmText: 'Close Post',
      onConfirm: async () => {
        try {
          const res = await closePost(postId, user.user_id);
          setAlertModal({ open: true, title: 'Post Closed', message: res.data.message, type: 'success' });
          await loadPostApplications();
        } catch (err) {
          setAlertModal({ open: true, title: 'Error', message: err.response?.data?.message || 'Failed to close post.', type: 'danger' });
        }
      }
    });
  };

  const loadApplicantCounts = async (posts) => {
    const counts = {};
    await Promise.all(
      posts.map(async (post) => {
        try {
          const response = await fetchPostApplicationCount(post.post_id);
          counts[post.post_id] = response.data.count;
        } catch {
          counts[post.post_id] = 0;
        }
      })
    );
    setPostApplicantCounts(counts);
  };

  const handleApply = async () => {
    if (!applyReason.trim()) {
      setAlertModal({ open: true, title: 'Missing Reason', message: 'Please provide a reason for your application.', type: 'danger' });
      return;
    }

    setSubmitting(true);
    try {
      await submitTeacherApplication({
        user_id: user.user_id,
        reason: applyReason,
        expertise: applyExpertise
      });
      setApplicationStatus('pending');
      setShowApplyModal(false);
      setApplyReason('');
      setApplyExpertise('');
      setAlertModal({ open: true, title: 'Application Submitted', message: 'Application submitted successfully! Admin will review it shortly.', type: 'success' });
    } catch (err) {
      setAlertModal({ open: true, title: 'Error', message: err.response?.data?.message || 'Failed to submit application.', type: 'danger' });
    } finally {
      setSubmitting(false);
    }
  };

  const getDeliveryLabel = (format) => {
    const labels = {
      'live_call': 'Live Micro-Call',
      'annotated_pdf': 'Annotated PDF',
      'video_walkthrough': 'Video Walkthrough'
    };
    return labels[format] || 'Live Micro-Call';
  };

  const getStatusBadge = (status) => {
    const badges = {
      'active': { class: 'active', text: 'Active' },
      'pending': { class: 'pending', text: 'Pending' },
      'resolved': { class: 'resolved', text: 'Resolved' },
      'closed': { class: 'closed', text: 'Closed' }
    };
    return badges[status] || badges['active'];
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="profile-page">
        <div className="profile-loading">Loading profile...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="profile-page">
        <div className="profile-error">{error}</div>
      </div>
    );
  }

  const { user: userData, posts } = profileData || {};
  const displayName = userData?.full_name || user?.full_name || 'User';
  const email = userData?.email || user?.email || '';
  const department = userData?.department || '';
  const bio = userData?.bio || '';
  const phone = userData?.phone || '';
  const studentId = userData?.student_id || '';
  const role = userData?.role || user?.role || 'student';
  const memberSince = userData?.created_at ? new Date(userData.created_at).getFullYear() : '2025';

  const roleLabels = { student: 'Student', tutor: 'Peer Tutor', both: 'Student & Tutor' };
  const isStudentOnly = role === 'student';
  const isApprovedTutor = applicationStatus === 'approved' || role === 'both';

  return (
    <div className="profile-page">
      {/* Top Banner */}
      <div className="top-banner">
        <span className="dot"></span>
        <strong>Spring Midterm Sprint:</strong> Verified peer STEM tutors are live on campus.
        <a href="#" onClick={(e) => e.preventDefault()}>Learn how it works</a>
      </div>

      {/* Header */}
      <header className="home-header">
        <div className="logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          <div className="logo-icon"><img src="/logo.png" alt="MicroTeach" /></div>
        </div>
        <div className="header-actions">
          <button className="wallet-balance-btn" onClick={() => setWalletOpen(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/>
              <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/>
              <path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>
            </svg>
            <span>৳{walletBalance ? Number(walletBalance).toLocaleString('en-IN', { minimumFractionDigits: 0 }) : '0'}</span>
          </button>
          <button className="icon-btn" title="Messages" onClick={() => setChatOpen(true)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </button>
          <button className="icon-btn" onClick={() => navigate('/')}>Home</button>
          <div className="avatar">
            {displayName.charAt(0).toUpperCase()}
          </div>
        </div>
      </header>

      {/* Breadcrumb */}
      <div className="breadcrumb-bar">
        <div className="breadcrumb-inner">
          <a href="#" onClick={(e) => { e.preventDefault(); navigate('/'); }}>Home</a>
          <span>/</span>
          <a href="#" onClick={(e) => e.preventDefault()}>Peer Tutors</a>
          <span>/</span>
          <span className="current">{displayName}</span>
        </div>
      </div>

      {/* Main Content */}
      <main className="profile-main">
        {/* Approval Success Banner */}
        {isApprovedTutor && (
          <div className="approval-banner">
            <div className="approval-banner-inner">
              <div className="approval-icon">&#10003;</div>
              <div className="approval-text">
                <strong>Congratulations! Your tutor application has been approved.</strong>
                <span>You can now respond to student posts and start tutoring on MicroTeach.</span>
              </div>
            </div>
          </div>
        )}

        {/* Pending Application Banner */}
        {applicationStatus === 'pending' && (
          <div className="pending-banner">
            <div className="pending-banner-inner">
              <div className="pending-icon">&#8987;</div>
              <div className="pending-text">
                <strong>Your tutor application is under review.</strong>
                <span>An admin will review your application shortly. You'll be notified once a decision is made.</span>
              </div>
            </div>
          </div>
        )}

        {/* Rejected Application Banner */}
        {applicationStatus === 'rejected' && (
          <div className="rejected-banner">
            <div className="rejected-banner-inner">
              <div className="rejected-icon">&#10007;</div>
              <div className="rejected-text">
                <strong>Your tutor application was not approved.</strong>
                <span>You can reapply with updated information below.</span>
              </div>
            </div>
          </div>
        )}

        {/* Profile Header Card */}
        <section className="profile-hero">
          <div className="hero-content">
            <div className="hero-left">
              <div className="avatar-large">
                {displayName.charAt(0).toUpperCase()}
                <span className="online-dot"></span>
              </div>
              <div className="hero-info">
                <div className="hero-name-row">
                  <h1>{displayName}</h1>
                  <span className={`verified-badge ${isApprovedTutor ? 'tutor' : ''}`}>
                    {roleLabels[role] || 'Student'}
                  </span>
                  {studentId && <span className="class-badge">ID: {studentId}</span>}
                </div>
                {bio && <p className="hero-role">{bio}</p>}
                {!bio && <p className="hero-role">Campus peer tutor and student</p>}
                <div className="hero-meta">
                  {department && (
                    <>
                      <span>
                        <span className="meta-icon">school</span>
                        Dept. of {department}
                      </span>
                      <span className="dot-sep">•</span>
                    </>
                  )}
                  <span>
                    <span className="meta-icon">email</span>
                    {email}
                  </span>
                  {phone && (
                    <>
                      <span className="dot-sep">•</span>
                      <span>
                        <span className="meta-icon">phone</span>
                        {phone}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="hero-right">
              <button className="btn-primary" onClick={() => navigate('/edit-profile')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                Edit Profile
              </button>
              {isStudentOnly && applicationStatus === null && (
                <button className="btn-apply-teacher" onClick={() => setShowApplyModal(true)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                  Apply to Teach
                </button>
              )}
              {isStudentOnly && applicationStatus === 'pending' && (
                <span className="application-badge pending">Application Pending</span>
              )}
              {isStudentOnly && applicationStatus === 'rejected' && (
                <button className="btn-apply-teacher" onClick={() => setShowApplyModal(true)}>
                  Apply Again
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Posted Requests Section */}
        <section className="profile-section">
          <div className="section-header">
            <div className="section-header-left">
              <div className="section-icon-box primary">post_add</div>
              <div>
                <div className="section-title-row">
                  <h2>Posted Requests</h2>
                  <span className="count-badge primary">{posts?.length || 0} Active Posts</span>
                </div>
                <p>Academic problems and course questions requested by {displayName}</p>
              </div>
            </div>
            <div className="section-header-right">
              <button className="btn-filter">Most Recent</button>
              <button className="btn-primary-sm" onClick={() => navigate('/create-post')}>
                <span>+</span> New Problem
              </button>
            </div>
          </div>

          <div className="posts-grid">
            {posts && posts.length > 0 ? (
              posts.map((post) => {
                const statusBadge = getStatusBadge(post.status);
                const applicantCount = postApplicantCounts[post.post_id] || 0;
                return (
                  <div key={post.post_id} className="post-card">
                    <div className="post-card-header">
                      <span className="course-badge">{post.course_code.split(' ')[0]}</span>
                      <span className="status-badge">● {statusBadge.text}</span>
                    </div>
                    <div className="post-card-meta">
                      <span className="posted-time">
                        <span className="meta-icon">schedule</span>
                        Posted {formatDate(post.created_at)}
                      </span>
                      <span className="bounty">৳ {post.bounty}</span>
                    </div>
                    <h3 className="post-card-title">{post.title}</h3>
                    <p className="post-card-desc">{post.description || 'No description provided.'}</p>
                    <div className="post-card-footer">
                      <div className="post-card-footer-top">
                        <span className="format-tag">{getDeliveryLabel(post.delivery_format)}</span>
                        {applicantCount > 0 && (
                          <span className="applicant-count-tag">
                            <span className="meta-icon">people</span>
                            {applicantCount} applicant{applicantCount !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      <div className="post-card-footer-bottom">
                        <div className="post-card-actions">
                          <button className="btn-secondary-sm" onClick={() => setDetailModalPost(post)}>View Details</button>
                          {post.status !== 'closed' && (
                            <button className="btn-outline-sm" onClick={() => handleClosePost(post.post_id)}>Close Post</button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="empty-state">
                <p>No posts yet. Create your first post to get help from peer tutors!</p>
                <button className="btn-primary" onClick={() => navigate('/create-post')}>Create Post</button>
              </div>
            )}
          </div>
        </section>

        {/* Applied Requests Section */}
        <section className="profile-section">
          <div className="section-header">
            <div className="section-header-left">
              <div className="section-icon-box secondary">co_present</div>
              <div>
                <div className="section-title-row">
                  <h2>Applied Requests</h2>
                  <span className="count-badge secondary">{postApplications.length} Application{postApplications.length !== 1 ? 's' : ''}</span>
                </div>
                <p>Micro-tutoring requests and peer applications submitted by {displayName}</p>
              </div>
            </div>
            <div className="section-header-right">
              <button className="btn-filter">All Statuses</button>
            </div>
          </div>

          {postApplications.length > 0 ? (
            <div className="posts-grid">
              {postApplications.map((app) => {
                const isAccepted = app.status === 'accepted';
                const isRejected = app.status === 'rejected';
                const isPending = app.status === 'pending';
                const isCancelRequested = app.status === 'cancellation_requested';
                const isCancelled = app.status === 'cancelled';
                const isCompletionRequested = app.status === 'completion_requested';
                const isCompleted = app.status === 'completed';
                return (
                  <div key={app.application_id} className={`post-card ${isAccepted ? 'post-card--accepted' : ''} ${isCancelRequested ? 'post-card--cancel-requested' : ''} ${isCancelled ? 'post-card--cancelled' : ''} ${isCompleted ? 'post-card--completed' : ''}`}>
                    <div className="post-card-header">
                      <span className="course-badge">{app.course_code?.split(' ')[0]}</span>
                      {isAccepted && <span className="status-badge status-badge--accepted">✓ Accepted</span>}
                      {isRejected && <span className="status-badge status-badge--rejected">✕ Rejected</span>}
                      {isPending && <span className="status-badge status-badge--pending">● Pending</span>}
                      {isCancelRequested && <span className="status-badge status-badge--pending">⚠ Cancel Requested</span>}
                      {isCancelled && <span className="status-badge status-badge--rejected">✕ Cancelled</span>}
                      {isCompletionRequested && <span className="status-badge status-badge--accepted">✓ Complete Requested</span>}
                      {isCompleted && <span className="status-badge status-badge--accepted">✓ Completed</span>}
                    </div>
                    <div className="post-card-meta">
                      <span className="posted-time">
                        <span className="meta-icon">schedule</span>
                        Applied {formatDate(app.created_at)}
                      </span>
                      <span className="bounty">৳ {app.bounty}</span>
                    </div>
                    <h3 className="post-card-title">{app.post_title}</h3>
                    {app.message && <p className="post-card-desc">Your message: "{app.message}"</p>}
                    <div className="post-card-footer">
                      <div className="post-card-footer-top">
                        <span className="format-tag">Posted by {app.post_author}</span>
                        {isAccepted && (
                          <span className="accepted-tag">You've been matched!</span>
                        )}
                        {isCancelRequested && (
                          <span className="cancel-requested-tag">Post owner wants to cancel</span>
                        )}
                        {isCancelled && (
                          <span className="cancelled-tag">Session cancelled</span>
                        )}
                        {isCompletionRequested && (
                          <span className="completion-requested-tag">Post owner marked complete</span>
                        )}
                        {isCompleted && (
                          <span className="completed-tag">Session completed</span>
                        )}
                      </div>
                      {isAccepted && (
                        <div className="post-card-footer-bottom">
                          <div className="post-card-actions">
                            <button className="btn-complete-sm" onClick={async () => {
                              await updateApplicationStatus(app.application_id, { status: 'completion_requested', owner_id: app.post_author_id, requested_by: user.user_id });
                              loadPostApplications();
                            }}>
                              Mark Complete
                            </button>
                            <button className="btn-message-sm" onClick={() => {
                              setChatStartUser(app.post_author_id);
                              setChatOpen(true);
                            }}>
                              <span className="meta-icon">chat</span> Message
                            </button>
                          </div>
                        </div>
                      )}
                      {isCompletionRequested && String(app.completion_requested_by) !== String(user.user_id) && (
                        <div className="post-card-footer-bottom">
                          <div className="post-card-actions">
                            <button className="btn-complete-sm" onClick={async () => {
                              await updateApplicationStatus(app.application_id, { status: 'completed', owner_id: app.post_author_id });
                              loadPostApplications();
                            }}>
                              Accept Completion
                            </button>
                            <button className="btn-keep-sm" onClick={async () => {
                              await updateApplicationStatus(app.application_id, { status: 'accepted', owner_id: app.post_author_id });
                              loadPostApplications();
                            }}>
                              Not Yet
                            </button>
                          </div>
                        </div>
                      )}
                      {isCompletionRequested && String(app.completion_requested_by) === String(user.user_id) && (
                        <div className="post-card-footer-bottom">
                          <div className="post-card-actions">
                            <span className="waiting-tag">Waiting for post owner...</span>
                          </div>
                        </div>
                      )}
                      {isCancelRequested && (
                        <div className="post-card-footer-bottom">
                          <div className="post-card-actions">
                            <button className="btn-confirm-cancel-sm" onClick={async () => {
                              await updateApplicationStatus(app.application_id, { status: 'cancelled', owner_id: app.post_author_id });
                              loadPostApplications();
                            }}>
                              Confirm Cancellation
                            </button>
                            <button className="btn-keep-sm" onClick={async () => {
                              await updateApplicationStatus(app.application_id, { status: 'accepted', owner_id: app.post_author_id });
                              loadPostApplications();
                            }}>
                              Keep Tutoring
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">
              <p>You haven't applied to any tutoring requests yet. Browse available bounties to start helping peers!</p>
              <button className="btn-primary" onClick={() => navigate('/')}>Browse Bounties</button>
            </div>
          )}
        </section>

        {/* Reviews Section */}
        <section className="profile-section">
          <div className="section-header">
            <div className="section-header-left">
              <div className="section-icon-box tertiary">rate_review</div>
              <div>
                <div className="section-title-row">
                  <h2>Student Reviews & Endorsements</h2>
                  <span className="count-badge tertiary">0 Verified Sessions</span>
                </div>
                <p>Feedback and academic peer endorsements across semesters</p>
              </div>
            </div>
            <div className="section-header-right">
              <div className="rating-box">
                <span className="rating-number">0.00</span>
                <div className="rating-info">
                  <div className="stars">☆☆☆☆☆</div>
                  <span className="completion-rate">No sessions yet</span>
                </div>
              </div>
            </div>
          </div>

          <div className="empty-state">
            <p>No reviews yet. Complete tutoring sessions to build your reputation!</p>
          </div>
        </section>
      </main>

      {/* Apply to Teach Modal */}
      {showApplyModal && (
        <div className="modal-overlay" onClick={() => setShowApplyModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Apply to Become a Teacher</h2>
            <p className="modal-subtitle">Submit your application to start tutoring peers on MicroTeach.</p>
            
            <div className="modal-form">
              <div className="form-group">
                <label>Why do you want to become a tutor?</label>
                <textarea
                  value={applyReason}
                  onChange={(e) => setApplyReason(e.target.value)}
                  placeholder="Tell us about your tutoring experience and why you want to help peers..."
                  rows={4}
                />
              </div>
              
              <div className="form-group">
                <label>Areas of Expertise (optional)</label>
                <input
                  type="text"
                  value={applyExpertise}
                  onChange={(e) => setApplyExpertise(e.target.value)}
                  placeholder="e.g., Algorithms, Calculus, Physics"
                />
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowApplyModal(false)}>Cancel</button>
              <button className="btn-submit" onClick={handleApply} disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Application'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post Detail Modal */}
      {detailModalPost && (
        <PostDetailModal
          post={detailModalPost}
          user={user}
          onClose={() => setDetailModalPost(null)}
          onStatusChange={() => loadApplicantCounts(posts)}
          onChat={(otherUserId) => {
            setDetailModalPost(null);
            setChatStartUser(otherUserId);
            setChatOpen(true);
          }}
        />
      )}

      {/* Chat Modal */}
      {chatOpen && user && (
        <ChatModal user={user} onClose={() => { setChatOpen(false); setChatStartUser(null); }} startWithUserId={chatStartUser} />
      )}

      {/* Wallet Modal */}
      <WalletModal isOpen={walletOpen} onClose={() => setWalletOpen(false)} user={user} onBalanceUpdate={(bal) => setWalletBalance(bal)} />

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

export default Profile;
