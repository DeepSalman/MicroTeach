import React, { useState, useEffect } from 'react';
import { fetchPosts } from './api';
import './ContentModeration.css';

const ContentModeration = ({ user }) => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return <div className="loading-text">Loading posts...</div>;
  }

  return (
    <div className="admin-content">
      <div className="page-header">
        <div className="page-header-left">
          <div className="breadcrumb">
            <span>Institutional Governance</span>
            <span className="breadcrumb-sep">›</span>
            <span className="breadcrumb-active">Content Moderation</span>
          </div>
          <h1 className="page-title">All Posted Items</h1>
          <p className="page-subtitle">{posts.length} total posts across the platform</p>
        </div>
      </div>

      <div className="posts-table-container">
        <table className="posts-table">
          <thead>
            <tr>
              <th className="th-id">ID</th>
              <th>Author</th>
              <th>Course</th>
              <th>Title</th>
              <th>Category</th>
              <th>Delivery</th>
              <th>Bounty</th>
              <th>Deadline</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => {
              const statusBadge = getStatusBadge(post.status);
              return (
                <tr key={post.post_id}>
                  <td className="td-id">#{post.post_id}</td>
                  <td>
                    <div className="author-cell">
                      <div className="author-avatar">
                        {post.author_name ? post.author_name.charAt(0).toUpperCase() : '?'}
                      </div>
                      <div className="author-info">
                        <span className="author-name">{post.author_name}</span>
                        <span className="author-dept">{post.author_department || 'N/A'}</span>
                      </div>
                    </div>
                  </td>
                  <td><span className="course-code">{post.course_code}</span></td>
                  <td className="td-title">{post.title}</td>
                  <td><span className="category-tag">{post.category}</span></td>
                  <td>{getDeliveryLabel(post.delivery_format)}</td>
                  <td className="td-bounty">৳{post.bounty}</td>
                  <td className="td-deadline">{post.deadline || '—'}</td>
                  <td>
                    <span className={`status-badge ${statusBadge.class}`}>
                      {statusBadge.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {posts.length === 0 && (
          <div className="empty-state">No posts found.</div>
        )}
      </div>
    </div>
  );
};

export default ContentModeration;
