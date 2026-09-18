import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { acceptPostApplication, addPostComment, applyToPost, deletePost, fetchPostDetails, fetchPosts, fetchTeachers } from './api';
import './Home.css';

const formatDeadline = (deadline) => {
  if (!deadline || !deadline.includes('T')) return deadline;

  const date = new Date(deadline);
  return Number.isNaN(date.getTime())
    ? deadline
    : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
};

const hasApplied = (post) => Number(post?.has_applied) === 1;

const Home = ({ user, activeMode, onModeChange, onLogout }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [teachers, setTeachers] = useState([]);
  const [teacherLoading, setTeacherLoading] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [commentText, setCommentText] = useState('');
  const [replyText, setReplyText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [commentLoading, setCommentLoading] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [acceptLoading, setAcceptLoading] = useState(null);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  async function loadPosts() {
    try {
      const response = await fetchPosts(user?.user_id);
      setPosts(response.data);
    } catch (err) {
      console.error('Failed to load posts:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadTeachers() {
    setTeacherLoading(true);
    try {
      const response = await fetchTeachers(user.department);
      setTeachers(response.data);
    } catch (err) {
      console.error('Failed to load teachers:', err);
    } finally {
      setTeacherLoading(false);
    }
  }

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
    if (user?.user_id) {
      loadPosts();
    }
  }, [user?.user_id]);

  useEffect(() => {
    if (activeMode === 'student') {
      loadTeachers();
    }
  }, [activeMode, user.department]);

  const handleDeletePost = async (postId) => {
    if (!window.confirm('Delete this post?')) return;

    try {
      await deletePost(postId, user.user_id);
      setPosts((currentPosts) => currentPosts.filter((post) => post.post_id !== postId));
    } catch (err) {
      console.error('Failed to delete post:', err);
    }
  };

  const handleLogout = () => {
    setDropdownOpen(false);
    if (onLogout) onLogout();
  };

  const openPostDetails = async (post) => {
    setSelectedPost(post);
    setCommentText('');
    setReplyText('');
    setReplyTo(null);
    setDetailError('');
    setDetailLoading(true);
    try {
      const response = await fetchPostDetails(post.post_id, user?.user_id);
      setSelectedPost({
        ...response.data,
        application_count: Math.max(
          Number(response.data.application_count) || 0,
          Number(post.application_count) || 0
        ),
        has_applied: Number(response.data.has_applied) === 1 || hasApplied(post) ? 1 : 0
      });
    } catch (err) {
      setDetailError('Could not load the full post details.');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleApply = async (post = selectedPost) => {
    if (!post || hasApplied(post)) return;
    setApplyLoading(true);
    try {
      const response = await applyToPost(post.post_id, user.user_id);
      const updatedPost = { ...post, application_count: response.data.application_count, has_applied: 1 };
      setSelectedPost((current) => current?.post_id === post.post_id ? { ...current, ...updatedPost } : current);
      setPosts((currentPosts) => currentPosts.map((post) => (
        post.post_id === updatedPost.post_id
          ? updatedPost
          : post
      )));
    } catch (err) {
      if (err.response?.status === 409) {
        setPosts((currentPosts) => currentPosts.map((currentPost) => (
          currentPost.post_id === post.post_id ? { ...currentPost, has_applied: 1 } : currentPost
        )));
        setSelectedPost((current) => current?.post_id === post.post_id ? { ...current, has_applied: 1 } : current);
      } else {
        if (selectedPost?.post_id === post.post_id) {
          setDetailError(err.response?.data?.message || 'Could not submit your application.');
        }
      }
    } finally {
      setApplyLoading(false);
    }
  };

  const handleAcceptApplication = async (applicationId) => {
    setAcceptLoading(applicationId);
    try {
      const response = await acceptPostApplication(selectedPost.post_id, applicationId, user.user_id);
      setSelectedPost((current) => ({
        ...current,
        status: 'pending',
        applicants: (current.applicants || []).map((applicant) => (
          applicant.application_id === applicationId
            ? response.data.application
            : { ...applicant, status: applicant.status === 'pending' ? 'rejected' : applicant.status }
        ))
      }));
      setPosts((currentPosts) => currentPosts.map((post) => (
        post.post_id === selectedPost.post_id ? { ...post, status: 'pending' } : post
      )));
    } catch (err) {
      setDetailError(err.response?.data?.message || 'Could not accept this applicant.');
    } finally {
      setAcceptLoading(null);
    }
  };

  const handleCommentSubmit = async (event) => {
    event.preventDefault();
    if (!commentText.trim()) return;

    setCommentLoading(true);
    try {
      const response = await addPostComment(selectedPost.post_id, user.user_id, commentText);
      setSelectedPost((current) => ({
        ...current,
        comments: [...(current.comments || []), response.data]
      }));
      setCommentText('');
    } catch (err) {
      setDetailError(err.response?.data?.message || 'Could not add your comment.');
    } finally {
      setCommentLoading(false);
    }
  };

  const handleReplySubmit = async (event, commentId) => {
    event.preventDefault();
    if (!replyText.trim()) return;

    setCommentLoading(true);
    try {
      const response = await addPostComment(selectedPost.post_id, user.user_id, replyText, commentId);
      setSelectedPost((current) => ({
        ...current,
        comments: [...(current.comments || []), response.data]
      }));
      setReplyText('');
      setReplyTo(null);
    } catch (err) {
      setDetailError(err.response?.data?.message || 'Could not add your reply.');
    } finally {
      setCommentLoading(false);
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

  const renderComment = (comment) => {
    const replies = (selectedPost.comments || []).filter(
      (reply) => Number(reply.parent_comment_id) === Number(comment.comment_id)
    );

    return (
      <div className="comment-thread" key={comment.comment_id}>
        <div className="comment">
          <div className="comment-avatar">{comment.author_name.charAt(0).toUpperCase()}</div>
          <div className="comment-content">
            <strong>{comment.author_name}</strong>
            <p>{comment.comment_text}</p>
            <small>{new Date(comment.created_at).toLocaleString()}</small>
            <button className="reply-button" type="button" onClick={() => { setReplyTo(comment.comment_id); setReplyText(''); }}>
              Reply
            </button>
            {replyTo === comment.comment_id && (
              <form className="reply-form" onSubmit={(event) => handleReplySubmit(event, comment.comment_id)}>
                <input autoFocus value={replyText} onChange={(event) => setReplyText(event.target.value)} placeholder={`Reply to ${comment.author_name}...`} maxLength="500" />
                <button type="submit" disabled={commentLoading || !replyText.trim()}>Send</button>
              </form>
            )}
          </div>
        </div>
        {replies.length > 0 && (
          <div className="comment-replies">
            {replies.map((reply) => renderComment(reply))}
          </div>
        )}
      </div>
    );
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
          {user.role === 'student' && (
            <button className="become-teacher-header-btn" onClick={() => navigate('/become-teacher')}>
              Become a Teacher
            </button>
          )}
          <button
            className={`mode-indicator ${activeMode}`}
            onClick={user.role === 'both' ? () => onModeChange(activeMode === 'student' ? 'teacher' : 'student') : undefined}
            title={user.role === 'both' ? 'Switch profile' : 'Current profile'}
            disabled={user.role !== 'both'}
          >
            {activeMode === 'teacher' ? 'Teacher Profile' : 'Student Profile'}
          </button>
          
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
                      <span className={`mode-indicator dropdown-mode ${activeMode}`}>
                        {activeMode === 'teacher' ? 'Teacher Profile' : 'Student Profile'}
                      </span>
                    </div>
                    <div className="dropdown-divider"></div>
                    <button className="dropdown-item" onClick={() => { setDropdownOpen(false); navigate('/profile'); }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round"/>
                        <circle cx="12" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Your Profile
                    </button>
                    {user.role === 'student' && (
                      <button className="dropdown-item" onClick={() => { setDropdownOpen(false); navigate('/become-teacher'); }}>
                        Become a Teacher
                      </button>
                    )}
                    {user.role === 'both' && (
                      <button className="dropdown-item" onClick={() => { setDropdownOpen(false); onModeChange(activeMode === 'student' ? 'teacher' : 'student'); }}>
                        Switch to {activeMode === 'student' ? 'Teacher' : 'Student'} Profile
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
            <h1>{activeMode === 'student' ? 'Student Profile Home' : 'Tutoring Opportunities'}</h1>
            <p className="subtitle">{activeMode === 'student' ? 'Manage your academic requests and find highly rated teachers in your department.' : 'Review student requests and apply to teach the topics you know best.'}</p>
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
          ) : (activeMode === 'student' ? posts.filter((post) => String(post.user_id) === String(user.user_id)).length === 0 : posts.length === 0) ? (
            <div className="empty-message">{activeMode === 'student' ? 'You have not created any posts yet.' : 'No posts yet. Create the first one!'}</div>
          ) : (
            (activeMode === 'student' ? posts.filter((post) => String(post.user_id) === String(user.user_id)) : posts).map((post) => {
              const statusBadge = getStatusBadge(post.status);
              const isOwnPost = user && String(post.user_id) === String(user.user_id);
              return (
                <div
                  key={post.post_id}
                  className="card"
                  role="button"
                  tabIndex="0"
                  onClick={() => openPostDetails(post)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') openPostDetails(post);
                  }}
                >
                  <div className="card-header">
                    <span className={`badge ${statusBadge.class}`}>{statusBadge.text}</span>
                    <span className="course-code">{post.course_code.split(' ')[0]}</span>
                    <span className="heart" onClick={(event) => event.stopPropagation()}>&#9825;</span>
                  </div>
                  <div className="card-kicker">{post.category} <span>/</span> {post.course_code}</div>
                  <div className="card-title">{post.title}</div>
                  <div className="card-meta card-highlights">
                    <span>{getDeliveryLabel(post.delivery_format)}</span>
                    <span className="applications">{post.application_count || 0} applied</span>
                  </div>
                  <div className="card-footer-meta">
                    <div className="card-author">Posted by <strong>{post.author_name}</strong> <span>· {post.author_department || 'Dept'}</span></div>
                    {post.deadline && <div className="time"><span>Due</span> {formatDeadline(post.deadline)}</div>}
                    {post.is_urgent && <div className="due">High urgency</div>}
                  </div>
                  <div className="card-bottom">
                    <div className="price"><strong>৳{post.bounty}</strong> / session</div>
                    {isOwnPost ? (
                      <div className="own-post-actions">
                        <span className="your-post-badge">Your Post</span>
                        {activeMode === 'student' && (
                          <button className="delete-post-btn" onClick={(event) => { event.stopPropagation(); handleDeletePost(post.post_id); }}>Delete</button>
                        )}
                      </div>
                    ) : (
                      <button
                        className={`apply-btn ${hasApplied(post) ? 'applied' : ''}`}
                        disabled={hasApplied(post)}
                        onClick={(event) => { event.stopPropagation(); handleApply(post); }}
                      >
                        {hasApplied(post) ? 'Applied' : 'Apply Now'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {activeMode === 'student' && (
          <section className="teacher-directory">
            <div className="directory-header">
              <div>
                <h2>Teachers in {user.department || 'your department'}</h2>
                <p>Browse verified teachers available to help with your coursework.</p>
              </div>
            </div>
            {teacherLoading ? (
              <div className="loading-message">Loading teachers...</div>
            ) : teachers.length === 0 ? (
              <div className="empty-message">No teachers are listed in this department yet.</div>
            ) : (
              <div className="teacher-grid">
                {teachers.map((teacher) => (
                <div
                  className="teacher-card"
                  key={teacher.user_id}
                  role="button"
                  tabIndex="0"
                  onClick={() => navigate(`/profile/${teacher.user_id}`)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') navigate(`/profile/${teacher.user_id}`);
                  }}
                >
                    <div className="teacher-avatar">{teacher.full_name.charAt(0).toUpperCase()}</div>
                    <div>
                      <h3>{teacher.full_name}</h3>
                      <p>{teacher.department || 'Campus teacher'}</p>
                      <span className="teacher-rating">★ Highly rated teacher</span>
                    </div>
                    <span className="teacher-view-link">View profile</span>
                  </div>
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

      {selectedPost && (
        <div className="post-modal-backdrop" onClick={() => setSelectedPost(null)}>
          <section className="post-modal" role="dialog" aria-modal="true" aria-labelledby="post-detail-title" onClick={(event) => event.stopPropagation()}>
            <button className="post-modal-close" aria-label="Close post details" onClick={() => setSelectedPost(null)}>×</button>
            {detailLoading ? (
              <div className="post-modal-loading">Loading post details...</div>
            ) : (
              <>
                <div className="post-modal-heading">
                  <div>
                    <span className={`badge ${getStatusBadge(selectedPost.status).class}`}>{getStatusBadge(selectedPost.status).text}</span>
                    <p className="post-modal-category">{selectedPost.category} · {selectedPost.course_code}</p>
                    <h2 id="post-detail-title">{selectedPost.title}</h2>
                  </div>
                  <div className="post-modal-bounty"><strong>৳{selectedPost.bounty}</strong><span>per session</span></div>
                </div>

                <div className="post-detail-stats">
                  <span>👤 Posted by <strong>{selectedPost.author_name}</strong></span>
                  <span>📨 <strong>{selectedPost.application_count || 0}</strong> applied</span>
                  <span>💬 <strong>{selectedPost.comments?.length || 0}</strong> comments</span>
                </div>

                <div className="post-detail-grid">
                  <div><span>Delivery format</span><strong>{getDeliveryLabel(selectedPost.delivery_format)}</strong></div>
                  <div><span>Department</span><strong>{selectedPost.author_department || 'Not specified'}</strong></div>
                  <div><span>Deadline</span><strong>{selectedPost.deadline ? formatDeadline(selectedPost.deadline) : 'Open deadline'}</strong></div>
                  <div><span>Priority</span><strong>{selectedPost.is_urgent ? 'High urgency' : 'Standard'}</strong></div>
                </div>

                <div className="post-detail-description">
                  <h3>What help is needed</h3>
                  <p>{selectedPost.description || 'No additional description was provided.'}</p>
                </div>

                {String(selectedPost.user_id) === String(user.user_id) && (
                  <div className="applicants-section">
                    <div className="applicants-heading">
                      <div><h3>Applicants</h3><p>Review who wants to teach this request.</p></div>
                      <span>{selectedPost.applicants?.length || 0}</span>
                    </div>
                    {selectedPost.applicants?.length ? (
                      <div className="applicants-list">
                        {selectedPost.applicants.map((applicant) => (
                          <div className="applicant-row" key={applicant.application_id}>
                            <div className="applicant-avatar">{applicant.full_name.charAt(0).toUpperCase()}</div>
                            <div className="applicant-info">
                              <strong>{applicant.full_name}</strong>
                              <span>{applicant.expertise || applicant.department || 'Peer tutor'}</span>
                              {applicant.bio && <p>{applicant.bio}</p>}
                            </div>
                            <div className="applicant-action">
                              {applicant.status === 'accepted' ? <span className="accepted-label">Accepted</span> : applicant.status === 'rejected' ? <span className="rejected-label">Not selected</span> : <button className="accept-btn" onClick={() => handleAcceptApplication(applicant.application_id)} disabled={acceptLoading !== null}>{acceptLoading === applicant.application_id ? 'Accepting...' : 'Accept'}</button>}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : <p className="no-applicants">No one has applied yet.</p>}
                  </div>
                )}

                {detailError && <div className="post-detail-error">{detailError}</div>}

                <div className="comments-section">
                  <div className="comments-heading"><h3>Comments</h3><span>{selectedPost.comments?.length || 0}</span></div>
                  <div className="comments-list">
                    {selectedPost.comments?.length ? selectedPost.comments.filter((comment) => !comment.parent_comment_id).map(renderComment) : <p className="no-comments">No comments yet. Start the conversation.</p>}
                  </div>
                  <form className="comment-form" onSubmit={handleCommentSubmit}>
                    <input value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder="Ask a question or share a helpful detail..." maxLength="500" />
                    <button type="submit" disabled={commentLoading || !commentText.trim()}>{commentLoading ? 'Sending...' : 'Comment'}</button>
                  </form>
                </div>

                {!user || String(selectedPost.user_id) !== String(user.user_id) ? (
                  <div className="post-modal-actions">
                    <button className={`apply-btn ${hasApplied(selectedPost) ? 'applied' : ''}`} onClick={() => handleApply()} disabled={applyLoading || hasApplied(selectedPost)}>
                      {hasApplied(selectedPost) ? 'Applied' : applyLoading ? 'Applying...' : 'Apply to teach this post'}
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </section>
        </div>
      )}

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
