import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './Home.css';

const Home = ({ user, onLogout }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    setDropdownOpen(false);
    if (onLogout) onLogout();
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
        <h1>My Applications &amp; Campus Engagements</h1>
        <p className="subtitle">Manage live peer-tutoring calls, pending solution pitches, and milestone payouts.</p>

        <div className="cards">
          {/* Card 1 */}
          <div className="card">
            <div className="card-header">
              <span className="badge active">&#9679; Active Session</span>
              <span className="course-code">CSE 221</span>
              <span className="heart">&#9825;</span>
            </div>
            <div className="card-subject">&#9654; Dijkstra Edge Cases</div>
            <div className="card-title">Priority queue heap indexing bug on C++ adjacency list with cycle detection.</div>
            <div className="card-meta">
              <span>&#128187; Google Meet (30m)</span>
              <span className="funded">100% Funded</span>
            </div>
            <div className="card-footer-meta">
              <div>CSE 221 &middot; Dijkstra Priorit... &#9733; 4.98 (42)</div>
              <div>Posted by @tahmid_k &middot; CSE Dept</div>
              <div className="time">&#9200; Starts in 1h 12m (Today 7:30 PM)</div>
            </div>
            <div className="card-bottom">
              <div className="price"><strong>&#x09F3;350</strong> / session</div>
              <button className="apply-btn">Apply Now</button>
            </div>
          </div>

          {/* Card 2 */}
          <div className="card">
            <div className="card-header">
              <span className="badge pending">&#9679; Pending Review</span>
              <span className="course-code">PHY 102</span>
              <span className="heart">&#9825;</span>
            </div>
            <div className="card-subject">&#8721; Gauss Law Cylindrical Shell</div>
            <div className="card-title">Non-uniform charge distribution integration step-by-step PDF diagram needed tonight.</div>
            <div className="card-meta">
              <span>&#128196; Annotated Notes</span>
              <span className="pitches">3 pitches submitted</span>
            </div>
            <div className="card-footer-meta">
              <div>PHY 102 &middot; Gauss Law Cyli... &#9733; 5.0 (19)</div>
              <div>Posted by @zahid_phys &middot; Physics Dept</div>
              <div className="due">Due: Tonight at 11:30 PM</div>
            </div>
            <div className="card-bottom">
              <div className="price"><strong>&#x09F3;300</strong> / solution</div>
              <button className="apply-btn">Apply Now</button>
            </div>
          </div>

          {/* Card 3 */}
          <div className="card">
            <div className="card-header">
              <span className="badge due">&#9200; Due in 3h 15m</span>
              <span className="course-code">MAT 120</span>
              <span className="heart">&#9825;</span>
            </div>
            <div className="card-subject">&#128203; Trig Substitution Multivariable</div>
            <div className="card-title">Step-by-step bound transformation with 1 clarifying audio memo. Escrow auto-release.</div>
            <div className="progress-bar"><div className="progress-fill" style={{ width: '60%' }}></div></div>
            <div className="card-footer-meta">
              <div>MAT 120 &middot; Multivariable ... &#9733; 4.92 (31)</div>
              <div>Posted by @nafisa_calc &middot; Math Dept</div>
              <div>Drafting Solution (Step 2 of 3)</div>
            </div>
            <div className="card-bottom">
              <div className="price"><strong>&#x09F3;400</strong> / escrow</div>
              <button className="apply-btn">Apply Now</button>
            </div>
          </div>

          {/* Card 4 */}
          <div className="card" style={{ opacity: 0.7 }}>
            <div className="card-header">
              <span className="badge not-selected">Not Selected</span>
              <span className="course-code">CSE 111</span>
              <span className="heart">&#9825;</span>
            </div>
            <div className="card-subject">&#128101; OOP Inheritance Bugs</div>
            <div className="card-title">Polymorphic interface inheritance recursion bug. Student selected another peer tutor.</div>
            <div className="archived">
              <span>Archived 36h ago</span>
              <span>Escrow Returned</span>
            </div>
            <div className="card-footer-meta">
              <div>CSE 111 &middot; Polymorphic Inh... &#9733; Resolved</div>
              <div>Posted by @arif_dev &middot; Applied 2d ago</div>
              <div>Session Closed</div>
            </div>
            <div className="card-bottom">
              <div className="price"><strong>&#x09F3;200</strong> / bounty</div>
              <button className="apply-btn disabled">Apply Now</button>
            </div>
          </div>
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
