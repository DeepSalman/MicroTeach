import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { deletePost, fetchTeachers, fetchUserProfile } from './api';
import './Profile.css';

const Profile = ({ user, activeMode, onModeChange }) => {
  const navigate = useNavigate();
  const { userId } = useParams();
  const profileUserId = userId || user?.user_id;
  const isOwnProfile = String(profileUserId) === String(user?.user_id);
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [teachers, setTeachers] = useState([]);

  async function loadProfile() {
    try {
      const response = await fetchUserProfile(profileUserId);
      setProfileData(response.data);
    } catch (err) {
      setError('Failed to load profile data.');
      console.error('Profile load error:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleDeletePost = async (postId) => {
    if (!window.confirm('Delete this post?')) return;

    try {
      await deletePost(postId, user.user_id);
      setProfileData((current) => ({
        ...current,
        posts: current.posts.filter((post) => post.post_id !== postId)
      }));
    } catch (err) {
      setError(err.response?.data?.message || 'Could not delete this post.');
    }
  };

  useEffect(() => {
    if (profileUserId) {
      loadProfile();
    }
  }, [profileUserId]);

  useEffect(() => {
    if (activeMode === 'student') {
      fetchTeachers(user.department)
        .then((response) => setTeachers(response.data))
        .catch(() => setTeachers([]));
    }
  }, [activeMode, user.department]);

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
  const expertise = userData?.expertise || '';
  const phone = userData?.phone || '';
  const studentId = userData?.student_id || '';
  const role = userData?.role || user?.role || 'student';
  const roleLabel = role === 'tutor' ? 'Peer Tutor' : role === 'both' ? 'Student & Peer Tutor' : 'Student';
  const memberSince = userData?.created_at
    ? new Date(userData.created_at).toLocaleDateString([], { month: 'short', year: 'numeric' })
    : 'Campus member';
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
          <button
            className={`mode-indicator ${activeMode}`}
            onClick={user.role === 'both' ? () => onModeChange(activeMode === 'student' ? 'teacher' : 'student') : undefined}
            title={user.role === 'both' ? 'Switch profile' : 'Current profile'}
            disabled={user.role !== 'both'}
          >
            {activeMode === 'teacher' ? 'Teacher Profile' : 'Student Profile'}
          </button>
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
                  <span className="verified-badge">{roleLabel}</span>
                  {studentId && <span className="class-badge">ID: {studentId}</span>}
                </div>
                <p className="hero-role">{roleLabel} in {department || 'the campus community'}</p>
              </div>
            </div>
            <div className="hero-right">
              {isOwnProfile && role === 'student' && (
                <button className="btn-primary" onClick={() => navigate('/become-teacher')}>Become a Teacher</button>
              )}
              {isOwnProfile && role === 'both' && (
                <button className="btn-secondary-sm" onClick={() => onModeChange(activeMode === 'student' ? 'teacher' : 'student')}>
                  Switch to {activeMode === 'student' ? 'Teacher' : 'Student'} Profile
                </button>
              )}
              {isOwnProfile && <button className="btn-primary" onClick={() => navigate('/edit-profile')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                Edit Profile
              </button>}
              {!isOwnProfile && <button className="btn-icon-action" title="Message Tutor">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </button>}
            </div>
          </div>
        </section>

        <section className="profile-info-grid">
          <div className="profile-info-panel profile-about-panel">
            <span className="panel-eyebrow">About</span>
            <h2>{bio ? 'A little about this member' : 'No bio added yet'}</h2>
            <p>{bio || 'This member has not added a personal introduction.'}</p>
          </div>
          <div className="profile-info-panel">
            <span className="panel-eyebrow">Profile details</span>
            <div className="profile-detail-row"><span>Department</span><strong>{department || 'Not added'}</strong></div>
            <div className="profile-detail-row"><span>Email</span><strong>{email || 'Not added'}</strong></div>
            {phone && <div className="profile-detail-row"><span>Phone</span><strong>{phone}</strong></div>}
            {expertise && <div className="profile-detail-row"><span>Expertise</span><strong>{expertise}</strong></div>}
          </div>
        </section>

        <section className="profile-overview" aria-label="Profile overview">
          <div className="overview-stat overview-stat-featured">
            <span className="overview-label">Profile focus</span>
            <strong>{role === 'student' ? 'Learning & asking' : 'Teaching & sharing'}</strong>
            <span className="overview-note">{department || 'Campus community'}</span>
          </div>
          <div className="overview-stat">
            <span className="overview-label">Posts</span>
            <strong>{posts?.length || 0}</strong>
            <span className="overview-note">Academic requests</span>
          </div>
          <div className="overview-stat">
            <span className="overview-label">Member since</span>
            <strong>{memberSince}</strong>
            <span className="overview-note">MicroTeach campus</span>
          </div>
          <div className="overview-stat">
            <span className="overview-label">Verification</span>
            <strong>{userData?.is_verified ? 'Verified' : 'Community'}</strong>
            <span className="overview-note">Identity status</span>
          </div>
        </section>

        {/* Posted Requests Section */}
        <section className="profile-section">
          <div className="section-header">
            <div className="section-header-left">
              <div className="section-icon-box primary">post_add</div>
              <div>
                <div className="section-title-row">
                  <h2>{activeMode === 'teacher' ? 'Teaching Activity' : 'My Posted Requests'}</h2>
                  <span className="count-badge primary">{posts?.length || 0} Active Posts</span>
                </div>
                <p>{isOwnProfile ? 'Your academic requests and current tutoring activity.' : `Academic requests and teaching activity from ${displayName}.`}</p>
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
                        <button className="btn-secondary-sm">Open request</button>
                        {isOwnProfile && <button className="btn-outline-sm" onClick={() => handleDeletePost(post.post_id)}>Delete Post</button>}
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

        {activeMode === 'student' && (
          <section className="profile-section">
            <div className="section-header">
              <div className="section-header-left">
                <div className="section-icon-box secondary">school</div>
                <div>
                  <div className="section-title-row">
                    <h2>Teachers in {department || 'Your Department'}</h2>
                    <span className="count-badge secondary">{teachers.length} Teachers</span>
                  </div>
                  <p>Browse teachers available to help with your coursework.</p>
                </div>
              </div>
            </div>
            <div className="teacher-profile-grid">
              {teachers.length > 0 ? teachers.map((teacher) => (
                <div className="teacher-profile-card" key={teacher.user_id}>
                  <div className="teacher-profile-avatar">{teacher.full_name.charAt(0).toUpperCase()}</div>
                  <div>
                    <h3>{teacher.full_name}</h3>
                    <p>{teacher.expertise || 'Teaching profile'}</p>
                    <span>{teacher.bio || 'Verified campus teacher'}</span>
                  </div>
                </div>
              )) : <div className="empty-state"><p>No teachers are listed in this department yet.</p></div>}
            </div>
          </section>
        )}

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
