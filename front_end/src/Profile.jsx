import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchUserProfile } from './api';
import './Profile.css';

const Profile = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user?.user_id) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    try {
      const response = await fetchUserProfile(user.user_id);
      setProfileData(response.data);
    } catch (err) {
      setError('Failed to load profile data.');
      console.error('Profile load error:', err);
    } finally {
      setLoading(false);
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
  const walletBalance = userData?.wallet_balance || 0;

  const roleLabels = { student: 'Student', tutor: 'Peer Tutor', both: 'Student & Tutor' };

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
          <div className="logo-icon">MT</div>
          <div className="logo-text">MicroTeach<span>Campus Hub</span></div>
        </div>
        <div className="header-actions">
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
                  <span className="verified-badge">{roleLabels[role] || 'Student'}</span>
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
              <button className="btn-icon-action" title="Message Tutor">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </button>
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
                      <span className="format-tag">{getDeliveryLabel(post.delivery_format)}</span>
                      <div className="post-card-actions">
                        <button className="btn-secondary-sm">View Details</button>
                        <button className="btn-outline-sm">Close Post</button>
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
                  <span className="count-badge secondary">0 Applications</span>
                </div>
                <p>Micro-tutoring requests and peer applications submitted by {displayName}</p>
              </div>
            </div>
            <div className="section-header-right">
              <button className="btn-filter">All Statuses</button>
            </div>
          </div>

          <div className="empty-state">
            <p>You haven't applied to any tutoring requests yet. Browse available bounties to start helping peers!</p>
            <button className="btn-primary" onClick={() => navigate('/')}>Browse Bounties</button>
          </div>
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
