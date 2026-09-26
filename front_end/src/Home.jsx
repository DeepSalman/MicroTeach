import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchPosts, reportPost, fetchUserPostApplications, fetchPostApplicationCount, fetchWalletBalance, fetchUserProfile, fetchUserApplications } from './api';
import ApplyModal from './ApplyModal';
import PostDetailModal from './PostDetailModal';
import ChatModal from './ChatModal';
import WalletModal from './WalletModal';
import ApplyTeacherModal from './ApplyTeacherModal';
import TransactionReportModal from './TransactionReportModal';
import './Home.css';

const Home = ({ user, onLogout }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reportModal, setReportModal] = useState({ open: false, postId: null, postTitle: '' });
  const [reportReason, setReportReason] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [applyModalPost, setApplyModalPost] = useState(null);
  const [txDisputeModalPost, setTxDisputeModalPost] = useState(null);
  const [appliedPostIds, setAppliedPostIds] = useState(new Set());
  const [postApplicantCounts, setPostApplicantCounts] = useState({});
  const [detailModalPost, setDetailModalPost] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatStartUser, setChatStartUser] = useState(null);
  const [walletOpen, setWalletOpen] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [applyTeacherOpen, setApplyTeacherOpen] = useState(false);
  const [dbUserRole, setDbUserRole] = useState(user?.role || 'student');
  const [teacherAppStatus, setTeacherAppStatus] = useState(null);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

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
  }, []);

  useEffect(() => {
    if (user?.user_id) {
      loadAppliedPosts();
      fetchWalletBalance(user.user_id).then(res => setWalletBalance(res.data.balance || 0)).catch(() => {});

      // Fetch live role from DB to verify teacher privileges
      fetchUserProfile(user.user_id)
        .then(res => {
          if (res.data && res.data.role) {
            setDbUserRole(res.data.role);
          }
        })
        .catch(() => {});

      // Check if user has submitted teacher application
      fetchUserApplications(user.user_id)
        .then(res => {
          if (res.data && res.data.length > 0) {
            setTeacherAppStatus(res.data[0].status);
          } else {
            setTeacherAppStatus(null);
          }
        })
        .catch(() => {});
    } else {
      setAppliedPostIds(new Set());
      setDbUserRole('student');
      setTeacherAppStatus(null);
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
          {user && user.role === 'student' && (
            <button className="btn-become-tutor-nav" onClick={() => setApplyTeacherOpen(true)}>
              Apply to Teach
            </button>
          )}
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
                    {user.is_admin === 1 && (
                      <button className="dropdown-item" onClick={() => { setDropdownOpen(false); navigate('/admin'); }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 15a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        Admin Panel
                      </button>
                    )}
                    {user.role === 'student' && (
                      <button className="dropdown-item" onClick={() => { setDropdownOpen(false); setApplyTeacherOpen(true); }}>
                        🎓 Apply to Teach
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

      {/* Categories */}
      <nav className="categories">
        <div className="cat-tab active">
          <span className="cat-icon">&#9783;</span>
          Algorithms &amp; DS
        </div>
        <div className="cat-tab">
          <span className="cat-icon">&#8721;</span>
          Calculus &amp; Math
        </div>
        <div className="cat-tab">
          <span className="cat-icon">&#9881;</span>
          Physics &amp; Lab
        </div>
        <div className="cat-tab">
          <span className="cat-icon">&#9783;</span>
          Object-Oriented
        </div>
        <div className="cat-tab">
          <span className="cat-icon">&#9881;</span>
          System Architecture
        </div>
        <div className="cat-tab">
          <span className="cat-icon">&#9889;</span>
          Circuits &amp; EEE
        </div>
        <div className="cat-tab">
          <span className="cat-icon">&#128161;</span>
          Machine Learning
        </div>
        <div className="cat-tab">
          <span className="cat-icon">&#9201;</span>
          Cram Sessions
        </div>
        <div className="cat-tab">
          <span className="cat-icon">&#128190;</span>
          Database...
        </div>
        <button className="filters-btn">
          &#9881; Filters
          <span className="filters-badge">3</span>
        </button>
      </nav>

      {/* Main Content */}
      <main className="home-main">
        <div className="main-header">
          <div>
            <h1>My Applications &amp; Campus Engagements</h1>
            <p className="subtitle">Manage live peer-tutoring calls, pending solution pitches, and milestone payouts.</p>
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
          ) : posts.length === 0 ? (
            <div className="empty-message">No posts yet. Create the first one!</div>
          ) : (
            posts.map((post) => {
              const statusBadge = getStatusBadge(post.status);
              const isOwnPost = user && String(post.user_id) === String(user.user_id);
              return (
                <div key={post.post_id} className="card">
                  <div className="card-header">
                    <span className={`badge ${statusBadge.class}`}>{statusBadge.text}</span>
                    <span className="course-code">{post.course_code.split(' ')[0]}</span>
                    <span className="report-btn" title="Report Content" onClick={() => openReportModal(post)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
                        <line x1="4" y1="22" x2="4" y2="15"/>
                      </svg>
                    </span>
                    <span className="report-btn tx-dispute-btn" title="Report Transaction / Escrow Issue" onClick={(e) => { e.stopPropagation(); if (!user) { navigate('/login'); return; } setTxDisputeModalPost(post); }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
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
                          <button className="view-details-btn" onClick={() => setDetailModalPost(post)}>View Details</button>
                        </div>
                      ) : user ? (
                        (dbUserRole === 'both' || dbUserRole === 'tutor') ? (
                          appliedPostIds.has(post.post_id) ? (
                            <button className="apply-btn applied-btn" onClick={() => setApplyModalPost(post)}>Applied</button>
                          ) : (
                            <button className="apply-btn" onClick={() => setApplyModalPost(post)}>Apply Now</button>
                          )
                        ) : teacherAppStatus === 'pending' ? (
                          <button
                            className="apply-btn pending-teacher-btn"
                            title="Your teacher application is under review by admin"
                            onClick={() => setApplyTeacherOpen(true)}
                          >
                            ⏳ Application Pending
                          </button>
                        ) : (
                          <button
                            className="apply-btn apply-teacher-btn"
                            title="Only verified teachers can apply. Click to apply for teacher"
                            onClick={() => setApplyTeacherOpen(true)}
                          >
                            🎓 Apply for Teacher
                          </button>
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

      {/* Apply Modal */}
      {applyModalPost && (
        <ApplyModal
          post={applyModalPost}
          user={{ ...user, role: dbUserRole }}
          onClose={() => setApplyModalPost(null)}
          onOpenTeacherModal={() => {
            setApplyModalPost(null);
            setApplyTeacherOpen(true);
          }}
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
