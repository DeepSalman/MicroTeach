import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchPosts } from './api';
import './Home.css';

const Home = ({ user, onLogout }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
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

  const loadPosts = async () => {
    try {
      const response = await fetchPosts();
      setPosts(response.data);
    } catch (err) {
      console.error('Failed to load posts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setDropdownOpen(false);
    if (onLogout) onLogout();
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
      {/* Top Banner */}
      <div className="top-banner">
        <span className="dot"></span>
        <strong>Spring Midterm Sprint:</strong> Verified peer STEM tutors are live on campus. Escrow secured payouts &amp; instant matches.
        <a href="#" onClick={(e) => e.preventDefault()}>Learn how it works</a>
      </div>

      {/* Header */}
      <header className="home-header">
        <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="logo">
            <div className="logo-icon">MT</div>
            <div className="logo-text">MicroTeach<span>Campus Hub</span></div>
          </div>
        </Link>
        <div className="search-bar">
          <input type="text" defaultValue="Any Subject" style={{ width: '110px' }} />
          <select><option>Any Department</option></select>
          <select><option>All Sessions</option></select>
          <button className="search-btn">&#128269;</button>
        </div>
        <div className="header-actions">
          <button className="icon-btn">&#9734;</button>
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
                    <span className="heart">&#9825;</span>
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
                    <div className="price"><strong>৳{post.bounty}</strong> / session</div>
                    {isOwnPost ? (
                      <span className="your-post-badge">Your Post</span>
                    ) : (
                      <button className="apply-btn">Apply Now</button>
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
    </div>
  );
};

export default Home;
