import { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchPosts, fetchPostById, reportPost, fetchUserPostApplications, fetchPostApplicationCount, fetchWalletBalance, fetchUserProfile, fetchUserApplications } from './api';
import PostDetailModal from './PostDetailModal';
import ChatModal from './ChatModal';
import WalletModal from './WalletModal';
import ApplyTeacherModal from './ApplyTeacherModal';
import TransactionReportModal from './TransactionReportModal';
import TeacherDirectory from './TeacherDirectory';
import { formatDeadline, formatTimeRemaining, parseDeadline } from './utils';
import './Home.css';

const POSTS_PER_PAGE = 10;

const getPaginationItems = (totalPages, currentPage) => {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);

  let start = Math.max(2, currentPage - 1);
  let end = Math.min(totalPages - 1, currentPage + 1);
  if (currentPage <= 3) end = Math.min(totalPages - 1, 4);
  if (currentPage >= totalPages - 2) start = Math.max(2, totalPages - 3);

  const pages = [1];
  if (start > 2) pages.push('start-ellipsis');
  for (let page = start; page <= end; page += 1) pages.push(page);
  if (end < totalPages - 1) pages.push('end-ellipsis');
  pages.push(totalPages);
  return pages;
};

const Home = ({ user, onLogout, onProfileUpdate }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [posts, setPosts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('posts');
  const [postLevel, setPostLevel] = useState('all');
  const [postsPage, setPostsPage] = useState(1);
  const [currentTime, setCurrentTime] = useState(Date.now);
  const [loading, setLoading] = useState(true);
  const [reportModal, setReportModal] = useState({ open: false, postId: null, postTitle: '' });
  const [reportReason, setReportReason] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [txDisputeModalPost, setTxDisputeModalPost] = useState(null);
  const [appliedPostIds, setAppliedPostIds] = useState(new Set());
  const [postApplicantCounts, setPostApplicantCounts] = useState({});
  const [detailModalPost, setDetailModalPost] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatStartUser, setChatStartUser] = useState(null);
  const [chatStartPost, setChatStartPost] = useState(null);
  const [walletOpen, setWalletOpen] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [applyTeacherOpen, setApplyTeacherOpen] = useState(false);
  const [dbUserRole, setDbUserRole] = useState(user?.role || 'student');
  const [teacherAppStatus, setTeacherAppStatus] = useState(null);
  const [showApprovedBanner, setShowApprovedBanner] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const timerId = window.setInterval(() => setCurrentTime(Date.now()), 60000);
    return () => window.clearInterval(timerId);
  }, []);

  // Reset session-scoped state safely when the signed-in user changes
  useEffect(() => {
    setAppliedPostIds(new Set());
    setDbUserRole(user?.role || 'student');
    setTeacherAppStatus(null);
    setShowApprovedBanner(false);
  }, [user?.user_id]);

  const loadApplicantCounts = useCallback((postsData) => {
    const counts = {};
    return Promise.all(
      postsData.map((postData) =>
        fetchPostApplicationCount(postData.post_id)
          .then((response) => { counts[postData.post_id] = response.data.count; })
          .catch(() => { counts[postData.post_id] = 0; })
      )
    ).then(() => { setPostApplicantCounts(counts); });
  }, []);

  const loadPosts = useCallback(() => {
    return fetchPosts()
      .then((response) => {
        setPosts(response.data);
        return loadApplicantCounts(response.data);
      })
      .catch((err) => { console.error('Failed to load posts:', err); })
      .finally(() => { setLoading(false); });
  }, [loadApplicantCounts]);

  const loadAppliedPosts = useCallback(() => {
    if (!user?.user_id) return Promise.resolve();
    return fetchUserPostApplications(user.user_id)
      .then((response) => {
        const ids = new Set(response.data.map((app) => app.post_id));
        setAppliedPostIds(ids);
      })
      .catch((err) => { console.error('Failed to load applied posts:', err); });
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    if (user?.user_id) {
      loadAppliedPosts();
      fetchWalletBalance(user.user_id).then(res => setWalletBalance(res.data.balance || 0)).catch(() => {});

      // Fetch live role from DB to verify teacher privileges
      fetchUserProfile(user.user_id)
        .then(res => {
          const profileUser = res.data && (res.data.user || res.data);
          if (profileUser) {
            if (profileUser.role) {
              setDbUserRole(profileUser.role);
            }
            // Only update parent if valid values exist and actually differ
            const roleChanged = Boolean(profileUser.role && user.role && profileUser.role !== user.role);
            const colorChanged = Boolean(profileUser.avatar_color && user.avatar_color && profileUser.avatar_color !== user.avatar_color);
            if (onProfileUpdate && (roleChanged || colorChanged)) {
              onProfileUpdate({
                ...user,
                role: profileUser.role || user.role,
                avatar_color: profileUser.avatar_color || user.avatar_color
              });
            }
          }
        })
        .catch(() => {});

      // Check if user has submitted teacher application
      fetchUserApplications(user.user_id)
        .then(res => {
          if (res.data && res.data.length > 0) {
            const hasApproved = res.data.some(a => a.status === 'approved');
            const latest = res.data[0];
            if (hasApproved || latest.status === 'approved') {
              setTeacherAppStatus('approved');
              const storageKey = `microteach_teacher_approved_seen_${user.user_id}`;
              if (!localStorage.getItem(storageKey)) {
                setShowApprovedBanner(true);
              }
            } else if (latest.status === 'pending') {
              setTeacherAppStatus('pending');
              setShowApprovedBanner(false);
            } else {
              setTeacherAppStatus(latest.status);
              setShowApprovedBanner(false);
            }
          } else {
            setTeacherAppStatus(null);
            setShowApprovedBanner(false);
          }
        })
        .catch(() => {});
    }
  }, [user?.user_id, loadAppliedPosts]);

  const handleDismissApprovedBanner = () => {
    if (user?.user_id) {
      localStorage.setItem(`microteach_teacher_approved_seen_${user.user_id}`, 'true');
    }
    setShowApprovedBanner(false);
  };

  const handleLogout = () => {
    setDropdownOpen(false);
    if (onLogout) onLogout();
  };

  const openPostConversation = (otherUserId, postId) => {
    if (!user?.user_id) {
      navigate('/login');
      return;
    }
    setChatStartUser(otherUserId);
    setChatStartPost(postId);
    setChatOpen(true);
  };

  const openReportModal = (post) => {
    if (!user) { navigate('/login'); return; }
    setReportModal({ open: true, postId: post.post_id, postTitle: post.title });
    setReportReason('');
    setReportSuccess(false);
  };

  const closeReportModal = () => {
    setReportModal({ open: false, postId: null, postTitle: '' });
    setReportReason('');
    setReportSuccess(false);
  };

  const submitReport = async () => {
    if (!reportReason.trim()) return;
    setReportSubmitting(true);
    try {
      await reportPost({
        post_id: reportModal.postId,
        user_id: user.user_id,
        reason: reportReason,
      });
      setReportSuccess(true);
    } catch (err) {
      console.error('Report failed:', err);
      setReportSuccess(true);
    } finally {
      setReportSubmitting(false);
    }
  };

  const getDeliveryLabel = (format) => {
    const labels = {
      'live_call': 'Google Meet · 30 min',
      'annotated_pdf': 'Annotated Notes',
      'video_walkthrough': 'Video Walkthrough'
    };
    return labels[format] || 'Google Meet · 30 min';
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase();
  };

  const getAvatarTone = (name = '') => {
    let sum = 0;
    for (let i = 0; i < name.length; i += 1) sum += name.charCodeAt(i);
    return sum % 4;
  };

  const query = searchQuery.trim().toLowerCase();
  const filteredPosts = posts.filter((post) => {
    const matchesLevel = postLevel === 'all' || post.category === postLevel;
    const matchesSearch = !query || [post.title, post.course_code, post.category, post.author_name, post.description]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
    return matchesLevel && matchesSearch;
  });
  const totalPostPages = Math.max(1, Math.ceil(filteredPosts.length / POSTS_PER_PAGE));
  const visiblePosts = filteredPosts.slice((postsPage - 1) * POSTS_PER_PAGE, postsPage * POSTS_PER_PAGE);
  const paginationItems = getPaginationItems(totalPostPages, postsPage);
  const isTeacherApproved = teacherAppStatus === 'approved' || dbUserRole === 'tutor' || dbUserRole === 'both';

  useEffect(() => {
    setPostsPage(1);
  }, [activeTab, searchQuery, postLevel]);

  useEffect(() => {
    setPostsPage((page) => Math.min(page, totalPostPages));
  }, [totalPostPages]);

  return (
    <div className="home-page">

      {/* Header */}
      <header className="home-header">
        <Link to="/" className="logo" title="MicroTeach Home">
          <span className="logo-icon"><img src="/logo.png" alt="MicroTeach" /></span>
        </Link>

        <div className="search-bar">
          <svg className="search-icon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') setSearchQuery(''); }}
            placeholder={activeTab === 'posts' ? 'Search posts, courses, or tutors...' : 'Search teachers by name, department, or bio...'}
            aria-label={activeTab === 'posts' ? 'Search posts' : 'Search teachers'}
          />
          {searchQuery && (
            <button className="search-clear" type="button" aria-label="Clear search" onClick={() => setSearchQuery('')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>

        <div className="header-actions">
          {user && isTeacherApproved ? (
            <span className="teacher-status-nav" role="status" aria-label="Verified teacher">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m5 12 4 4L19 6" />
              </svg>
              Teacher
            </span>
          ) : user && dbUserRole === 'student' && user.role === 'student' && teacherAppStatus !== 'approved' ? (
            <button
              className={`btn-become-tutor-nav${teacherAppStatus === 'pending' ? ' btn-become-tutor-nav--pending' : ''}`}
              onClick={() => setApplyTeacherOpen(true)}
              disabled={teacherAppStatus === 'pending'}
            >
              {teacherAppStatus === 'pending' ? 'Application Pending' : 'Apply to Teach'}
            </button>
          ) : null}

          {user && (
            <button className="wallet-balance-btn" onClick={() => setWalletOpen(true)} title="Open wallet">
              <span className="wallet-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3"/>
                </svg>
              </span>
              <span className="wallet-amount">৳{walletBalance ? Number(walletBalance).toLocaleString('en-IN', { minimumFractionDigits: 0 }) : '0'}</span>
            </button>
          )}

          <button className="icon-btn" title="Messages" aria-label="Messages" onClick={() => user ? setChatOpen(true) : navigate('/login')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </button>

          {/* Avatar with Dropdown */}
          <div className="avatar-wrapper" ref={dropdownRef}>
            <button
              type="button"
              className="avatar"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              title={user ? (user.full_name || user.email) : 'Guest'}
              aria-haspopup="menu"
              aria-expanded={dropdownOpen}
            >
              <span className="avatar-initials">
                {user ? (user.full_name ? user.full_name.charAt(0).toUpperCase() : 'U') : 'G'}
              </span>
            </button>

            {dropdownOpen && (
              <div className="avatar-dropdown">
                {user ? (
                  <>
                    <div className="dropdown-user-info">
                      <div className="dropdown-user-name">{user.full_name}</div>
                      <div className="dropdown-user-email">{user.email}</div>
                    </div>
                    <div className="dropdown-divider"></div>
                    <button className="dropdown-item" onClick={() => { setDropdownOpen(false); navigate('/profile'); }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round"/>
                        <circle cx="12" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Your Profile
                    </button>
                    {user.is_admin === 1 && (
                      <button className="dropdown-item" onClick={() => { setDropdownOpen(false); navigate('/admin'); }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 15a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        Admin Panel
                      </button>
                    )}
                    {user.role === 'student' && dbUserRole === 'student' && teacherAppStatus !== 'approved' && (
                      <button
                        className="dropdown-item"
                        onClick={() => { setDropdownOpen(false); setApplyTeacherOpen(true); }}
                        disabled={teacherAppStatus === 'pending'}
                      >
                        {teacherAppStatus === 'pending' ? 'Application Pending' : 'Apply to Teach'}
                      </button>
                    )}
                    <button className="dropdown-item logout" onClick={handleLogout}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" strokeLinecap="round" strokeLinejoin="round"/>
                        <polyline points="16 17 21 12 16 7" strokeLinecap="round" strokeLinejoin="round"/>
                        <line x1="21" y1="12" x2="9" y2="12" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Log out
                    </button>
                  </>
                ) : (
                  <>
                    <Link to="/login" className="dropdown-item" onClick={() => setDropdownOpen(false)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" strokeLinecap="round" strokeLinejoin="round"/>
                        <polyline points="10 17 15 12 10 7" strokeLinecap="round" strokeLinejoin="round"/>
                        <line x1="15" y1="12" x2="3" y2="12" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Log in
                    </Link>
                    <Link to="/register" className="dropdown-item" onClick={() => setDropdownOpen(false)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round"/>
                        <circle cx="8.5" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round"/>
                        <line x1="20" y1="8" x2="20" y2="14" strokeLinecap="round" strokeLinejoin="round"/>
                        <line x1="23" y1="11" x2="17" y2="11" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Sign up
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="home-main">
        {showApprovedBanner && (
          <div className="home-approval-banner">
            <div className="home-approval-inner">
              <div className="home-approval-badge">
                <span className="home-approval-check">✓</span>
                <span>Teacher Application Approved</span>
              </div>
              <p className="home-approval-text">
                Congratulations! You are now verified to teach and respond to student posts on MicroTeach.
              </p>
              <button 
                className="home-approval-dismiss"
                onClick={handleDismissApprovedBanner}
                aria-label="Dismiss message"
                title="Dismiss"
              >
                ✕
              </button>
            </div>
          </div>
        )}
        <div className="main-header">
          <div>
            <h1>{activeTab === 'posts' ? 'All posts' : 'Teachers'}</h1>
            <p className="subtitle">{activeTab === 'posts' ? 'Manage live peer-tutoring calls, pending solution pitches, and milestone payouts.' : 'Find verified teachers by department, ratings, and completed work.'}</p>
          </div>
          {user && activeTab === 'posts' && (
            <button className="create-post-btn" onClick={() => navigate('/create-post')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="5" y1="12" x2="19" y2="12" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Create Post
            </button>
          )}
        </div>

        <div className="home-tabs" role="tablist" aria-label="Browse MicroTeach">
          <button
            type="button"
            role="tab"
            id="posts-tab"
            aria-selected={activeTab === 'posts'}
            aria-controls="posts-panel"
            className={activeTab === 'posts' ? 'home-tab home-tab--active' : 'home-tab'}
            onClick={() => setActiveTab('posts')}
          >
            Posts
          </button>
          <button
            type="button"
            role="tab"
            id="teachers-tab"
            aria-selected={activeTab === 'teachers'}
            aria-controls="teachers-panel"
            className={activeTab === 'teachers' ? 'home-tab home-tab--active' : 'home-tab'}
            onClick={() => setActiveTab('teachers')}
          >
            Teachers
          </button>
        </div>

        {activeTab === 'posts' ? (
        <>
        <div className="posts-filter-row">
          <label htmlFor="post-level-filter">Study level</label>
          <select id="post-level-filter" value={postLevel} onChange={(event) => setPostLevel(event.target.value)}>
            <option value="all">All levels</option>
            <option value="University Level">University Level</option>
            <option value="HSC Level">HSC Level</option>
            <option value="SSC Level">SSC Level</option>
          </select>
          <span aria-live="polite">{filteredPosts.length} post{filteredPosts.length === 1 ? '' : 's'}</span>
        </div>
        <div className="cards" id="posts-panel" role="tabpanel" aria-labelledby="posts-tab">
          {loading ? (
            <div className="loading-message">Loading posts...</div>
          ) : filteredPosts.length === 0 ? (
            <div className="empty-message">
              {query || postLevel !== 'all' ? (
                <>
                  <strong>No posts match the selected filters.</strong>
                  <span className="empty-hint">Try another study level or search term.</span>
                </>
              ) : (
                'No posts yet. Create the first one!'
              )}
            </div>
          ) : (
            visiblePosts.map((post) => {
              const isOwnPost = user && String(post.user_id) === String(user.user_id);
              const isCancelledByOwner = Boolean(
                user?.user_id &&
                post.cancelled_tutor_id &&
                String(post.cancelled_tutor_id) === String(user.user_id) &&
                String(post.cancelled_by) === String(post.user_id)
              );
              const acceptedTutorId = post.accepted_tutor_id;
              const hasActiveTutor = Boolean(acceptedTutorId);
              const isAcceptedTutor = Boolean(user?.user_id && acceptedTutorId && String(user.user_id) === String(acceptedTutorId));
              const isActiveParty = Boolean(hasActiveTutor && (isOwnPost || isAcceptedTutor));
              const countdown = formatTimeRemaining(post.deadline, currentTime);
              const deadlineTimestamp = parseDeadline(post.deadline)?.getTime();
              const isDeadlineOverdue = countdown === 'Overdue';
              const isDeadlineSoon = !isDeadlineOverdue && deadlineTimestamp && deadlineTimestamp - currentTime <= 24 * 60 * 60 * 1000;
              return (
                <div
                  key={post.post_id}
                  className={`card${isActiveParty ? ' card--active-session' : ''}`}
                  onClick={(event) => {
                    if (event.target.closest('button, a, .report-btn')) return;
                    setDetailModalPost(post);
                  }}
                >
                  <div className="card-header">
                    <div className="card-header-main">
                      {post.is_urgent ? (
                        <div className="urgent-row">
                          <span className="meta-chip urgent-chip">High Urgency</span>
                        </div>
                      ) : null}
                      <h3 className="card-title">
                        <button className="card-title-button" type="button" onClick={() => setDetailModalPost(post)}>
                          {post.title}
                        </button>
                      </h3>
                    </div>
                    <div className="card-header-actions">
                      <span className="report-btn" title="Report Content" onClick={(event) => { event.stopPropagation(); openReportModal(post); }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
                          <line x1="4" y1="22" x2="4" y2="15"/>
                        </svg>
                      </span>
                      {isActiveParty && (
                        <span className="report-btn tx-dispute-btn" title="Report Transaction / Escrow Issue" onClick={(e) => { e.stopPropagation(); if (!user) { navigate('/login'); return; } setTxDisputeModalPost(post); }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                          </svg>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="card-subject">{post.category}</div>
                  {post.course_code && (
                    <div className="card-course-name">
                      <span>{post.category === 'University Level' ? 'Course' : 'Subject'}</span>
                      {post.course_code}
                    </div>
                  )}

                  <div className="card-meta">
                    <span className="meta-chip">{getDeliveryLabel(post.delivery_format)}</span>
                    {isActiveParty && <span className="meta-chip active-session-chip">Active</span>}
                    {hasActiveTutor && !isActiveParty && <span className="meta-chip in-progress-chip">In Progress</span>}
                    {countdown && (
                      <span className={`meta-chip countdown-chip${isDeadlineSoon ? ' countdown-chip--soon' : ''}${isDeadlineOverdue ? ' countdown-chip--overdue' : ''}`}>
                        {countdown}
                      </span>
                    )}
                    {post.deadline && <span className="meta-chip due-chip">Due {formatDeadline(post.deadline)}</span>}
                  </div>

                  <div className="card-bottom">
                    <div className="card-poster">
                      <span className={`poster-avatar tone-${getAvatarTone(post.author_name)}`}>{getInitials(post.author_name)}</span>
                      <span className="poster-info">
                        <span className="poster-name">{post.author_name}</span>
                        <span className="poster-sub">{post.author_department || 'Dept'}</span>
                      </span>
                      <span className="applicant-count">
                        {postApplicantCounts[post.post_id] || 0} applicant{(postApplicantCounts[post.post_id] || 0) === 1 ? '' : 's'}
                      </span>
                    </div>
                    <div className="card-bottom-row">
                      <div className="price">
                        <span className="price-label">Bounty</span>
                        <strong>৳{post.bounty}</strong>
                      </div>
                      <div className="card-cta">
                        {isCancelledByOwner ? (
                          <span className="cancelled-owner-label" role="status">Cancelled by owner</span>
                        ) : isActiveParty ? (
                          <button
                            className="active-session-message-btn"
                            onClick={() => openPostConversation(isOwnPost ? acceptedTutorId : post.user_id, post.post_id)}
                          >
                            Message
                          </button>
                        ) : hasActiveTutor ? (
                          <span className="active-session-other-label">Tutor accepted</span>
                        ) : isOwnPost ? (
                          <button className="view-details-btn" onClick={() => setDetailModalPost(post)}>View Details</button>
                        ) : user ? (
                          (dbUserRole === 'both' || dbUserRole === 'tutor' || teacherAppStatus === 'approved') ? (
                            appliedPostIds.has(post.post_id) ? (
                              <button className="apply-btn applied-btn" onClick={() => setDetailModalPost(post)}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12"/>
                                </svg>
                                Applied
                              </button>
                            ) : (
                              <button className="apply-btn" onClick={() => setDetailModalPost(post)}>Apply Now</button>
                            )
                          ) : teacherAppStatus === 'pending' ? (
                            <button
                              className="apply-btn pending-teacher-btn"
                              title="Your teacher application is under review by admin"
                              onClick={() => setApplyTeacherOpen(true)}
                            >
                              Application Pending
                            </button>
                          ) : (
                            <button
                              className="apply-btn apply-teacher-btn"
                              title="Only verified teachers can apply. Click to apply for teacher"
                              onClick={() => setApplyTeacherOpen(true)}
                            >
                              Apply for Teacher
                            </button>
                          )
                        ) : null}
                      </div>
                    </div>
                    {!isOwnPost && !user && (
                      <Link to="/login" className="apply-btn login-apply-btn login-apply-btn--full">Login or Sign Up to Apply</Link>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
        </>
        ) : (
          <div id="teachers-panel" role="tabpanel" aria-labelledby="teachers-tab">
            <TeacherDirectory searchQuery={searchQuery} />
          </div>
        )}

        {activeTab === 'posts' && !loading && filteredPosts.length > 0 && (
          <nav className="posts-pagination" aria-label="Post pages">
            <span className="posts-pagination-summary">
              Showing {(postsPage - 1) * POSTS_PER_PAGE + 1} - {Math.min(postsPage * POSTS_PER_PAGE, filteredPosts.length)} of {filteredPosts.length} posts
            </span>
            {totalPostPages > 1 && (
              <div className="posts-pagination-controls">
                <button
                  type="button"
                  className="posts-page-button posts-page-arrow"
                  onClick={() => setPostsPage((page) => Math.max(1, page - 1))}
                  disabled={postsPage === 1}
                  aria-label="Previous page"
                >
                  Previous
                </button>
                {paginationItems.map((page) => (
                  typeof page === 'string' ? (
                    <span className="posts-page-ellipsis" key={page} aria-hidden="true">...</span>
                  ) : (
                    <button
                      type="button"
                      key={page}
                      className={`posts-page-button${postsPage === page ? ' posts-page-button--active' : ''}`}
                      onClick={() => setPostsPage(page)}
                      aria-label={`Page ${page}`}
                      aria-current={postsPage === page ? 'page' : undefined}
                    >
                      {page}
                    </button>
                  )
                ))}
                <button
                  type="button"
                  className="posts-page-button posts-page-arrow"
                  onClick={() => setPostsPage((page) => Math.min(totalPostPages, page + 1))}
                  disabled={postsPage === totalPostPages}
                  aria-label="Next page"
                >
                  Next
                </button>
              </div>
            )}
          </nav>
        )}
      </main>

      {/* Footer */}
      <footer className="home-footer">
        <div className="footer-grid">
          <div className="footer-col">
            <h3>Campus Support</h3>
            <a href="#" onClick={(e) => e.preventDefault()}>Help Center &amp; FAQs</a>
            <a href="#" onClick={(e) => e.preventDefault()}>MicroTeach AirCover for Tutors</a>
            <a href="#" onClick={(e) => e.preventDefault()}>Anti-Plagiarism Standards</a>
            <a href="#" onClick={(e) => e.preventDefault()}>Disability &amp; Scribe Support</a>
          </div>
          <div className="footer-col">
            <h3>Community</h3>
            <a href="#" onClick={(e) => e.preventDefault()}>Campus Peer Forum</a>
            <a href="#" onClick={(e) => e.preventDefault()}>Department Leaderboards</a>
            <a href="#" onClick={(e) => e.preventDefault()}>Midterm Study Lounges</a>
            <a href="#" onClick={(e) => e.preventDefault()}>Campus Ambassador Program</a>
          </div>
          <div className="footer-col">
            <h3>Hosting &amp; Tutoring</h3>
            <a href="#" onClick={(e) => { e.preventDefault(); if (user && user.role === 'student') setApplyTeacherOpen(true); }}>Become a Verified Tutor</a>
            <a href="#" onClick={(e) => e.preventDefault()}>Hourly &amp; Milestone Rates</a>
            <a href="#" onClick={(e) => e.preventDefault()}>Escrow Payout Guidelines</a>
            <a href="#" onClick={(e) => e.preventDefault()}>Tutor Code of Conduct</a>
          </div>
          <div className="footer-col">
            <h3>MicroTeach</h3>
            <a href="#" onClick={(e) => e.preventDefault()}>Newsroom &amp; Release Notes</a>
            <a href="#" onClick={(e) => e.preventDefault()}>Campus Integrity Policy</a>
            <a href="#" onClick={(e) => e.preventDefault()}>Careers at MicroTeach</a>
            <a href="#" onClick={(e) => e.preventDefault()}>Student Privacy Notice</a>
          </div>
        </div>
        <div className="footer-bottom">
          <div>
            &copy; 2025 MicroTeach, Inc. &nbsp;&middot;&nbsp;
            <a href="#" onClick={(e) => e.preventDefault()}>Privacy</a> &middot;
            <a href="#" onClick={(e) => e.preventDefault()}>Terms</a> &middot;
            <a href="#" onClick={(e) => e.preventDefault()}>Sitemap</a> &middot;
            <a href="#" onClick={(e) => e.preventDefault()}>Campus Safety &amp; Escrow</a>
          </div>
          <div className="right">
            <span className="lang">&#127760; English (US)</span>
            <span>&#x09F3; BDT</span>
            <span className="icons">&lt; &gt; &#128187;</span>
          </div>
        </div>
      </footer>
      {/* Report Modal */}
      {reportModal.open && (
        <div className="report-overlay" onClick={closeReportModal}>
          <div className="report-modal" onClick={(e) => e.stopPropagation()}>
            <div className="report-modal-header">
              <h3>Report Post</h3>
              <button className="report-close" onClick={closeReportModal}>&times;</button>
            </div>
            {!reportSuccess ? (
              <>
                <p className="report-modal-subtitle">"{reportModal.postTitle}"</p>
                <label className="report-label">Reason for reporting</label>
                <select
                  className="report-select"
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                >
                  <option value="">Select a reason...</option>
                  <option value="spam">Spam or misleading</option>
                  <option value="inappropriate">Inappropriate content</option>
                  <option value="fraud">Fraud or scam</option>
                  <option value="harassment">Harassment</option>
                  <option value="academic_dishonesty">Academic dishonesty</option>
                  <option value="other">Other</option>
                </select>
                <div className="report-modal-actions">
                  <button className="report-cancel-btn" onClick={closeReportModal}>Cancel</button>
                  <button
                    className="report-submit-btn"
                    disabled={!reportReason.trim() || reportSubmitting}
                    onClick={submitReport}
                  >
                    {reportSubmitting ? 'Submitting...' : 'Submit Report'}
                  </button>
                </div>
              </>
            ) : (
              <div className="report-success">
                <div className="report-success-icon">&#10003;</div>
                <p>Report submitted. Our integrity team will review it shortly.</p>
                <button className="report-done-btn" onClick={closeReportModal}>Done</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Post Detail Modal (for post owners) */}
      {detailModalPost && (
        <PostDetailModal
          post={detailModalPost}
          user={user}
          canApply={dbUserRole === 'both' || dbUserRole === 'tutor' || teacherAppStatus === 'approved'}
          teacherApplicationPending={teacherAppStatus === 'pending'}
          onApplyTeacher={() => setApplyTeacherOpen(true)}
          onClose={() => setDetailModalPost(null)}
          onStatusChange={loadPosts}
          onLoginRequired={() => navigate('/login')}
          onApplySuccess={(postId) => setAppliedPostIds((previous) => new Set([...previous, postId]))}
          onWithdrawSuccess={(postId) => setAppliedPostIds((previous) => {
            const next = new Set(previous);
            next.delete(postId);
            return next;
          })}
          onChat={(otherUserId, postId) => {
            setDetailModalPost(null);
            openPostConversation(otherUserId, postId);
          }}
        />
      )}

      {/* Chat Modal */}
      {chatOpen && user && (
        <ChatModal
          user={user}
          onClose={() => { setChatOpen(false); setChatStartUser(null); setChatStartPost(null); }}
          onViewPost={async (postId) => {
            try {
              const response = await fetchPostById(postId);
              setChatOpen(false);
              setChatStartUser(null);
              setChatStartPost(null);
              setDetailModalPost(response.data);
            } catch (error) {
              console.error('Failed to open conversation post:', error);
            }
          }}
          startWithUserId={chatStartUser}
          startWithPostId={chatStartPost}
        />
      )}

      {/* Transaction Dispute / Report Modal */}
      {txDisputeModalPost && (
        <TransactionReportModal
          post={txDisputeModalPost}
          user={user}
          isOpen={!!txDisputeModalPost}
          onClose={() => setTxDisputeModalPost(null)}
          onSuccess={() => setTxDisputeModalPost(null)}
        />
      )}

      {/* Apply Teacher Modal */}
      {user && (
        <ApplyTeacherModal
          user={user}
          isOpen={applyTeacherOpen}
          onClose={() => setApplyTeacherOpen(false)}
          onSuccess={() => {
            setApplyTeacherOpen(false);
            setTeacherAppStatus('pending');
          }}
        />
      )}

      {/* Wallet Modal */}
      <WalletModal isOpen={walletOpen} onClose={() => setWalletOpen(false)} user={user} onBalanceUpdate={(bal) => setWalletBalance(bal)} />
    </div>
  );
};

export default Home;
