import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchPosts, fetchTeachers, fetchUsers, reportPost, fetchUserPostApplications, fetchPostApplicationCount, fetchWalletBalance } from './api';
import ApplyModal from './ApplyModal';
import PostDetailModal from './PostDetailModal';
import ChatModal from './ChatModal';
import WalletModal from './WalletModal';
import PostComments from './PostComments';
import './Home.css';

const Home = ({ user, activeMode = 'student', onModeChange, onLogout }) => {
  const [teachers, setTeachers] = useState([]);
  const [teachersLoading, setTeachersLoading] = useState(true);
  const [teachersError, setTeachersError] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reportModal, setReportModal] = useState({ open: false, postId: null, postTitle: '' });
  const [reportReason, setReportReason] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [applyModalPost, setApplyModalPost] = useState(null);
  const [appliedPostIds, setAppliedPostIds] = useState(new Set());
  const [postApplicantCounts, setPostApplicantCounts] = useState({});
  const [detailModalPost, setDetailModalPost] = useState(null);
  const [previewPost, setPreviewPost] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatStartUser, setChatStartUser] = useState(null);
  const [walletOpen, setWalletOpen] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const visiblePosts = user && activeMode === 'student'
    ? posts.filter((post) => String(post.user_id) === String(user.user_id))
    : posts;
  const visibleTeachers = teachers.filter((teacher) => String(teacher.user_id) !== String(user?.user_id));

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
    if (!previewPost) return undefined;
    const handleEscape = (event) => {
      if (event.key === 'Escape') setPreviewPost(null);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [previewPost]);

  useEffect(() => {
    loadPosts();
  }, []);

  useEffect(() => {
    if (user?.user_id) {
      loadAppliedPosts();
      fetchWalletBalance(user.user_id).then(res => setWalletBalance(res.data.balance || 0)).catch(() => {});
    } else {
      setAppliedPostIds(new Set());
    }
  }, [user]);

  const loadAppliedPosts = async () => {
    try {
      const response = await fetchUserPostApplications(user.user_id);
      const ids = new Set(response.data.map(app => app.post_id));
      setAppliedPostIds(ids);
    } catch (err) {
      console.error('Failed to load applied posts:', err);
    }
  };

  const loadPosts = async () => {
    try {
      const response = await fetchPosts();
      setPosts(response.data);
      loadApplicantCounts(response.data);
    } catch (err) {
      console.error('Failed to load posts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeMode !== 'student' || !user?.user_id) return undefined;
    let cancelled = false;

    const loadDirectory = async () => {
      try {
        const response = await fetchTeachers(user.department || '');
        if (!cancelled) setTeachers(response.data);
      } catch (err) {
        try {
          const response = await fetchUsers();
          const department = (user.department || '').trim().toLowerCase();
          const tutors = response.data.filter((candidate) => {
            const isTutor = candidate.role === 'tutor' || candidate.role === 'both';
            const sameDepartment = !department || (candidate.department || '').trim().toLowerCase() === department;
            return isTutor && sameDepartment;
          });
          if (!cancelled) setTeachers(tutors);
        } catch (fallbackError) {
          console.error('Failed to load tutors:', err, fallbackError);
          if (!cancelled) setTeachersError('Tutors could not be loaded right now.');
        }
      } finally {
        if (!cancelled) setTeachersLoading(false);
      }
    };

    loadDirectory();

    return () => { cancelled = true; };
  }, [user?.user_id, user?.department, activeMode]);

  const loadApplicantCounts = async (postsData) => {
    const counts = {};
    await Promise.all(
      postsData.map(async (post) => {
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

  const handleLogout = () => {
    setDropdownOpen(false);
    if (onLogout) onLogout();
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
      'live_call': '📹 Google Meet (30m)',
      'annotated_pdf': '📝 Annotated Notes',
      'video_walkthrough': '🎬 Video Walkthrough'
    };
    return labels[format] || '📹 Google Meet (30m)';
  };

  const getStatusBadge = (status) => {
    const badges = {
      'active': { class: 'active', text: '● Active Session' },
      'pending': { class: 'pending', text: '● Pending Review' },
      'resolved': { class: 'not-selected', text: 'Resolved' },
      'closed': { class: 'not-selected', text: 'Closed' }
    };
    return badges[status] || badges['active'];
  };

  return (
    <div className="home-page">

      {/* Header */}
      <header className="home-header">
        <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="logo">
            <div className="logo-icon"><img src="/logo.png" alt="MicroTeach" /></div>
          </div>
        </Link>
        <div className="search-bar">
          <svg className="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input type="text" placeholder="Search courses, topics, or tutors..." />
        </div>
        <div className="header-actions">
          {user && (
            <button className="wallet-balance-btn" onClick={() => setWalletOpen(true)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/>
                <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/>
                <path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>
              </svg>
              <span>৳{walletBalance ? Number(walletBalance).toLocaleString('en-IN', { minimumFractionDigits: 0 }) : '0'}</span>
            </button>
          )}
          <button className="icon-btn" title="Messages" onClick={() => user ? setChatOpen(true) : navigate('/login')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </button>
          {user && (
            <button
              className={`mode-indicator ${activeMode}`}
              onClick={() => user.role === 'both' && onModeChange(activeMode === 'student' ? 'teacher' : 'student')}
              title={user.role === 'both' ? 'Switch profile' : 'Current profile'}
              disabled={user.role !== 'both'}
            >
              {activeMode === 'teacher' ? 'Tutor Profile' : 'Student Profile'}
            </button>
          )}
          <button className="icon-btn">&#9776;</button>
          
          {/* Avatar with Dropdown */}
          <div className="avatar-wrapper" ref={dropdownRef}>
            <div 
              className="avatar" 
              onClick={() => setDropdownOpen(!dropdownOpen)}
              title={user ? (user.full_name || user.email) : 'Guest'}
            >
              {user ? (user.full_name ? user.full_name.charAt(0).toUpperCase() : 'U') : 'G'}
            </div>
            
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
                    {user.role === 'both' && (
                      <button className="dropdown-item" onClick={() => { setDropdownOpen(false); onModeChange(activeMode === 'student' ? 'teacher' : 'student'); }}>
                        Switch to {activeMode === 'student' ? 'Tutor' : 'Student'} Profile
                      </button>
                    )}
                    {user.is_admin === 1 && (
                      <button className="dropdown-item" onClick={() => { setDropdownOpen(false); navigate('/admin'); }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 15a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        Admin Panel
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
        <div className="main-header">
          <div>
            <h1>{activeMode === 'teacher' ? 'Tutor Opportunities' : 'Campus Tutoring Marketplace'}</h1>
            <p className="subtitle">
              {activeMode === 'teacher'
                ? 'Review student requests and apply to tutor the topics you know best.'
                : 'Browse campus tutoring requests and manage your academic engagements.'}
            </p>
          </div>
          {user && (
            <button className="create-post-btn" onClick={() => navigate('/create-post')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="5" y1="12" x2="19" y2="12" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Create Post
            </button>
          )}
        </div>

        <div className="cards">
          {loading ? (
            <div className="loading-message">Loading posts...</div>
          ) : visiblePosts.length === 0 ? (
            <div className="empty-message">{activeMode === 'student' ? 'You have not created any posts yet.' : 'No posts yet. Create the first one!'}</div>
          ) : (
            visiblePosts.map((post) => {
              const statusBadge = getStatusBadge(post.status);
              const isOwnPost = user && String(post.user_id) === String(user.user_id);
              return (
                <div
                  key={post.post_id}
                  className="card card-interactive"
                  role="button"
                  tabIndex={0}
                  aria-label={`View details for ${post.title}`}
                  onClick={() => isOwnPost ? setDetailModalPost(post) : setPreviewPost(post)}
                  onKeyDown={(event) => {
                    if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
                      event.preventDefault();
                      isOwnPost ? setDetailModalPost(post) : setPreviewPost(post);
                    }
                  }}
                >
                  <div className="card-header">
                    <span className={`badge ${statusBadge.class}`}>{statusBadge.text}</span>
                    <span className="course-code">{post.course_code.split(' ')[0]}</span>
                    <span className="report-btn" title="Report" onClick={(event) => { event.stopPropagation(); openReportModal(post); }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
                        <line x1="4" y1="22" x2="4" y2="15"/>
                      </svg>
                    </span>
                  </div>
                  <div className="card-subject">{post.category}</div>
                  <div className="card-title">{post.title}</div>
                  <div className="card-meta">
                    <span>{getDeliveryLabel(post.delivery_format)}</span>
                    <span className="funded">100% Funded</span>
                  </div>
                  <div className="card-footer-meta">
                    <div>{post.course_code} &#9733; {post.author_name}</div>
                    <div>Posted by {post.author_name} &middot; {post.author_department || 'Dept'}</div>
                    {post.deadline && <div className="time">⏰ Due: {post.deadline}</div>}
                    {post.is_urgent && <div className="due">🔥 High Urgency</div>}
                  </div>
                    <div className="card-bottom">
                    <div className="card-bottom-row">
                      <div className="price"><strong>৳{post.bounty}</strong></div>
                      {isOwnPost ? (
                        <div className="own-post-actions">
                          {postApplicantCounts[post.post_id] > 0 && (
                            <span className="applicant-count-badge">{postApplicantCounts[post.post_id]} applicant{postApplicantCounts[post.post_id] !== 1 ? 's' : ''}</span>
                          )}
                          <button className="view-details-btn" onClick={(event) => { event.stopPropagation(); setDetailModalPost(post); }}>View Details</button>
                        </div>
                      ) : user ? (
                        appliedPostIds.has(post.post_id) ? (
                          <button className="apply-btn applied-btn" onClick={(event) => { event.stopPropagation(); setApplyModalPost(post); }}>Applied</button>
                        ) : (
                          <button className="apply-btn" onClick={(event) => { event.stopPropagation(); setApplyModalPost(post); }}>Apply Now</button>
                        )
                      ) : null}
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
        
        {activeMode === 'student' && user && (
          <section className="home-tutor-directory" aria-labelledby="home-tutor-directory-title">
            <div className="home-tutor-directory-heading">
              <div>
                <h2 id="home-tutor-directory-title">
                  Tutors{user.department ? ` in ${user.department}` : ' on campus'}
                </h2>
                <p>Browse approved peer tutors and contact them directly.</p>
              </div>
            </div>

            {teachersLoading ? (
              <p className="home-tutor-directory-state">Loading tutors...</p>
            ) : teachersError ? (
              <p className="home-tutor-directory-state" role="alert">{teachersError}</p>
            ) : visibleTeachers.length === 0 ? (
              <p className="home-tutor-directory-state">No approved tutors are listed{user.department ? ` in ${user.department}` : ''} yet.</p>
            ) : (
              <div className="home-tutor-grid">
                {visibleTeachers.map((teacher) => (
                  <article className="home-tutor-card" key={teacher.user_id}>
                    <div className="home-tutor-card-main">
                      <div className="home-tutor-avatar" aria-hidden="true">
                        {(teacher.full_name || 'T').charAt(0).toUpperCase()}
                      </div>
                      <div className="home-tutor-info">
                        <h3>{teacher.full_name}</h3>
                        <p>{teacher.department || 'Campus tutor'}</p>
                        <span className={`home-tutor-verification ${Number(teacher.is_verified) === 1 ? 'verified' : ''}`}>
                          {Number(teacher.is_verified) === 1 ? 'Verified tutor' : 'Approved tutor'}
                        </span>
                      </div>
                    </div>
                    {teacher.bio && <p className="home-tutor-bio">{teacher.bio}</p>}
                    <div className="home-tutor-actions">
                      <button type="button" className="home-tutor-view" onClick={() => navigate(`/profile/${teacher.user_id}`)}>
                        View Profile
                      </button>
                      <button type="button" className="home-tutor-message" onClick={() => {
                        setChatStartUser(teacher.user_id);
                        setChatOpen(true);
                      }}>
                        Message
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Show More */}
        <div className="show-more">
          <p>Continue exploring tutoring opportunities</p>
          <button className="show-more-btn">Show More Applications &amp; Bounties</button>
          <div className="count">Showing 4 of 7 active pitches &amp; tutoring sessions</div>
        </div>
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
            <a href="#" onClick={(e) => e.preventDefault()}>Become a Verified Tutor</a>
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

      {/* Post Preview Modal */}
      {previewPost && (
        <div className="post-preview-overlay" onClick={() => setPreviewPost(null)}>
          <section
            className="post-preview-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="post-preview-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="post-preview-header">
              <div>
                <span className="post-preview-category">{previewPost.category}</span>
                <h2 id="post-preview-title">{previewPost.title}</h2>
              </div>
              <button type="button" className="post-preview-close" aria-label="Close post details" onClick={() => setPreviewPost(null)}>×</button>
            </div>
            <div className="post-preview-meta">
              <span>{previewPost.course_code}</span>
              <span>{getDeliveryLabel(previewPost.delivery_format)}</span>
              {previewPost.deadline && <span>Due {previewPost.deadline}</span>}
              {previewPost.is_urgent && <span className="post-preview-urgent">High urgency</span>}
            </div>
            <p className="post-preview-description">{previewPost.description || 'No additional details provided.'}</p>
            <PostComments postId={previewPost.post_id} user={user} />
            <div className="post-preview-footer">
              <div>
                <strong>৳{Number(previewPost.bounty || 0).toLocaleString()}</strong>
                <span>Posted by {previewPost.author_name || 'Campus member'} · {previewPost.author_department || 'Campus community'}</span>
              </div>
              <button type="button" className="post-preview-apply" onClick={() => {
                setApplyModalPost(previewPost);
                setPreviewPost(null);
              }}>
                {appliedPostIds.has(previewPost.post_id) ? 'View Application' : 'Apply to Post'}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Apply Modal */}
      {applyModalPost && (
        <ApplyModal
          post={applyModalPost}
          user={user}
          onClose={() => setApplyModalPost(null)}
          onApplySuccess={() => {
            setAppliedPostIds(prev => new Set([...prev, applyModalPost.post_id]));
          }}
          onWithdrawSuccess={() => {
            setAppliedPostIds(prev => {
              const next = new Set(prev);
              next.delete(applyModalPost.post_id);
              return next;
            });
          }}
        />
      )}

      {/* Post Detail Modal (for post owners) */}
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
    </div>
  );
};

export default Home;
