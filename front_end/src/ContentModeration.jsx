import React, { useState, useEffect, useMemo } from 'react';
import { fetchPosts, deletePost } from './api';
import { formatDeadline, avatarStyle } from './utils';
import './ContentModeration.css';

const ContentModeration = ({ user }) => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    loadPosts();
  }, []);

  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  const loadPosts = async () => {
    setLoading(true);
    try {
      const response = await fetchPosts();
      setPosts(response.data || []);
    } catch (err) {
      console.error('Failed to load posts:', err);
      setFeedback({ type: 'error', message: 'Failed to fetch posts from database.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePost = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deletePost(deleteTarget.post_id);
      setPosts(prev => prev.filter(p => p.post_id !== deleteTarget.post_id));
      setFeedback({
        type: 'success',
        message: `Post #${deleteTarget.post_id} removed successfully.`
      });
      setDeleteTarget(null);
    } catch (err) {
      console.error('Failed to remove post:', err);
      const errMsg = err.response?.data?.message || err.response?.data?.error || 'Failed to remove post.';
      setFeedback({ type: 'error', message: errMsg });
    } finally {
      setDeleting(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      active: { class: 'status-active', label: 'Active' },
      pending: { class: 'status-pending', label: 'Pending' },
      resolved: { class: 'status-resolved', label: 'Resolved' },
      closed: { class: 'status-closed', label: 'Closed' },
    };
    return badges[status] || badges.active;
  };

  const getDeliveryLabel = (format) => {
    const labels = {
      live_call: 'Live Call',
      annotated_pdf: 'Annotated PDF',
      video_walkthrough: 'Video Walkthrough',
    };
    return labels[format] || format;
  };

  const filteredPosts = useMemo(() => {
    return posts.filter(p => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = (p.title || '').toLowerCase().includes(q);
        const matchAuthor = (p.author_name || '').toLowerCase().includes(q);
        const matchCourse = (p.course_code || '').toLowerCase().includes(q);
        const matchCat = (p.category || '').toLowerCase().includes(q);
        const matchId = String(p.post_id || '').includes(q);
        if (!matchTitle && !matchAuthor && !matchCourse && !matchCat && !matchId) return false;
      }
      return true;
    });
  }, [posts, statusFilter, searchQuery]);

  if (loading && posts.length === 0) {
    return (
      <div className="admin-content cm-content">
        <div className="loading-text">Loading posts for moderation...</div>
      </div>
    );
  }

  return (
    <div className="admin-content cm-content">
      {/* Header */}
      <div className="page-header">
        <div className="page-header-left">
          <div className="breadcrumb">
            <span>Institutional Governance</span>
            <span className="breadcrumb-sep">›</span>
            <span className="breadcrumb-active">Content Moderation</span>
          </div>
          <h1 className="page-title">Content Moderation</h1>
          <p className="page-subtitle">Manage and curate all student tutoring requests across the campus network</p>
        </div>
      </div>

      {/* Toast Feedback */}
      {feedback && (
        <div className={`cm-toast ${feedback.type}`}>
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)}>&times;</button>
        </div>
      )}

      {/* Filter / Search Bar */}
      <div className="cm-filter-bar">
        <div className="cm-search-box">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Search by title, author, course code, or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="cm-clear-btn"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              &times;
            </button>
          )}
        </div>

        <div className="cm-select-wrap">
          <label>Status:</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        <button className="cm-btn-refresh" onClick={loadPosts} title="Refresh posts list" disabled={loading}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className={loading ? 'cm-spin' : ''}>
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>

        <span className="cm-count-pill">
          Showing {filteredPosts.length} of {posts.length} posts
        </span>
      </div>

      {/* Streamlined Posts Table — Fits in One Screen, No Slider */}
      <div className="posts-table-container">
        <table className="posts-table">
          <thead>
            <tr>
              <th className="th-id">ID</th>
              <th className="th-post">POST &amp; COURSE</th>
              <th className="th-author">AUTHOR</th>
              <th className="th-bounty">BOUNTY &amp; FORMAT</th>
              <th className="th-deadline">DEADLINE</th>
              <th className="th-status">STATUS</th>
              <th className="th-action">ACTION</th>
            </tr>
          </thead>
          <tbody>
            {filteredPosts.length === 0 ? (
              <tr>
                <td colSpan="7" className="empty-state">
                  No posts matching your search or filters.
                </td>
              </tr>
            ) : (
              filteredPosts.map((post) => {
                const statusBadge = getStatusBadge(post.status);
                return (
                  <tr key={post.post_id}>
                    <td className="td-id">
                      <span className="post-id-tag">#{post.post_id}</span>
                    </td>
                    <td className="td-post">
                      <div className="post-primary-info">
                        <div className="post-title-row">
                          <span className="post-title" title={post.title}>{post.title}</span>
                          {post.is_urgent === 1 && (
                            <span className="urgent-badge" title="Urgent request">⚡ Urgent</span>
                          )}
                        </div>
                        <div className="post-meta-sub">
                          {post.course_code && <span className="course-code">{post.course_code}</span>}
                          {post.category && <span className="category-tag">{post.category}</span>}
                        </div>
                      </div>
                    </td>
                    <td className="td-author">
                      <div className="author-cell">
                        <div className="author-avatar" style={avatarStyle(post.author_avatar_color)}>
                          {post.author_name ? post.author_name.charAt(0).toUpperCase() : '?'}
                        </div>
                        <div className="author-info">
                          <span className="author-name" title={post.author_name}>{post.author_name}</span>
                          <span className="author-dept" title={post.author_department}>{post.author_department || 'N/A'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="td-bounty-col">
                      <div className="bounty-stack">
                        <span className="bounty-val">৳{Number(post.bounty || 0).toLocaleString('en-IN')}</span>
                        <span className="delivery-val">{getDeliveryLabel(post.delivery_format)}</span>
                      </div>
                    </td>
                    <td className="td-deadline">
                      <span className="deadline-text">{formatDeadline(post.deadline) || '—'}</span>
                    </td>
                    <td className="td-status">
                      <span className={`status-badge ${statusBadge.class}`}>
                        {statusBadge.label}
                      </span>
                    </td>
                    <td className="td-action">
                      <button
                        type="button"
                        className="btn-remove-post"
                        onClick={() => setDeleteTarget(post)}
                        title={`Remove post #${post.post_id}`}
                        aria-label={`Remove post ${post.title}`}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          <line x1="10" y1="11" x2="10" y2="17"></line>
                          <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                        <span>Remove</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Confirmation Modal */}
      {deleteTarget && (
        <div className="cm-modal-overlay" onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="cm-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="cm-modal-icon danger">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <div className="cm-modal-body">
              <h3 className="cm-modal-title">Remove Post #{deleteTarget.post_id}?</h3>
              <p className="cm-modal-post-name">
                &ldquo;{deleteTarget.title}&rdquo;
              </p>
              <p className="cm-modal-desc">
                Are you sure you want to permanently delete this post? If this post has an escrow bounty (<strong>৳{Number(deleteTarget.bounty || 0).toLocaleString('en-IN')}</strong>), it will be automatically refunded to <strong>{deleteTarget.author_name}</strong>.
              </p>
              <div className="cm-modal-actions">
                <button
                  type="button"
                  className="btn-cm-cancel"
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-cm-danger"
                  onClick={handleDeletePost}
                  disabled={deleting}
                >
                  {deleting ? 'Removing...' : 'Confirm Remove'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContentModeration;
