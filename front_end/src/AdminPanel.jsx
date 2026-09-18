import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchUsers, fetchPosts, fetchSessions } from './api';
import './AdminPanel.css';

const AdminPanel = ({ user }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [usersRes, postsRes, sessionsRes] = await Promise.all([
        fetchUsers(),
        fetchPosts(),
        fetchSessions()
      ]);
      setUsers(usersRes.data);
      setPosts(postsRes.data);
      setSessions(sessionsRes.data);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getRoleLabel = (role) => {
    const labels = { student: 'Student', tutor: 'Tutor', both: 'Student & Tutor' };
    return labels[role] || role;
  };

  const getStatusBadge = (status) => {
    const badges = {
      'active': { class: 'active', text: 'Active' },
      'pending': { class: 'pending', text: 'Pending' },
      'resolved': { class: 'resolved', text: 'Resolved' },
      'closed': { class: 'closed', text: 'Closed' },
      'accepted': { class: 'accepted', text: 'Accepted' },
      'completed': { class: 'completed', text: 'Completed' },
      'cancelled': { class: 'cancelled', text: 'Cancelled' }
    };
    return badges[status] || { class: '', text: status };
  };

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-loading">Loading admin data...</div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      {/* Header */}
      <header className="admin-header">
        <div className="admin-header-left">
          <div className="logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
            <div className="logo-icon">MT</div>
            <div className="logo-text">MicroTeach<span>Admin Panel</span></div>
          </div>
        </div>
        <div className="admin-header-right">
          <span className="admin-badge">Administrator</span>
          <div className="avatar" title={user?.full_name}>
            {user?.full_name?.charAt(0).toUpperCase() || 'A'}
          </div>
        </div>
      </header>

      {/* Stats */}
      <div className="admin-stats">
        <div className="stat-card">
          <div className="stat-number">{users.length}</div>
          <div className="stat-label">Total Users</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{posts.length}</div>
          <div className="stat-label">Total Posts</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{sessions.length}</div>
          <div className="stat-label">Total Sessions</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{users.filter(u => u.role === 'tutor' || u.role === 'both').length}</div>
          <div className="stat-label">Active Tutors</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="admin-tabs">
        <button 
          className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          Users
        </button>
        <button 
          className={`tab-btn ${activeTab === 'posts' ? 'active' : ''}`}
          onClick={() => setActiveTab('posts')}
        >
          Posts
        </button>
        <button 
          className={`tab-btn ${activeTab === 'sessions' ? 'active' : ''}`}
          onClick={() => setActiveTab('sessions')}
        >
          Sessions
        </button>
      </div>

      {/* Content */}
      <div className="admin-content">
        {activeTab === 'users' && (
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Department</th>
                  <th>Verified</th>
                  <th>Admin</th>
                  <th>Wallet</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.user_id}>
                    <td>{u.user_id}</td>
                    <td>{u.full_name}</td>
                    <td>{u.email}</td>
                    <td><span className="role-badge">{getRoleLabel(u.role)}</span></td>
                    <td>{u.department || '-'}</td>
                    <td>{u.is_verified ? '✓' : '✗'}</td>
                    <td>{u.is_admin ? '✓' : '✗'}</td>
                    <td>৳{u.wallet_balance || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'posts' && (
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Title</th>
                  <th>Course</th>
                  <th>Category</th>
                  <th>Bounty</th>
                  <th>Status</th>
                  <th>Author</th>
                </tr>
              </thead>
              <tbody>
                {posts.map(p => {
                  const badge = getStatusBadge(p.status);
                  return (
                    <tr key={p.post_id}>
                      <td>{p.post_id}</td>
                      <td className="title-cell">{p.title}</td>
                      <td>{p.course_code}</td>
                      <td>{p.category}</td>
                      <td>৳{p.bounty}</td>
                      <td><span className={`status-badge ${badge.class}`}>{badge.text}</span></td>
                      <td>{p.author_name}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'sessions' && (
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Tutor</th>
                  <th>Student</th>
                  <th>Skill</th>
                  <th>Scheduled</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(s => {
                  const badge = getStatusBadge(s.status);
                  return (
                    <tr key={s.session_id}>
                      <td>{s.session_id}</td>
                      <td>{s.tutor_name}</td>
                      <td>{s.student_name}</td>
                      <td>{s.skill_name}</td>
                      <td>{s.scheduled_at ? new Date(s.scheduled_at).toLocaleString() : '-'}</td>
                      <td><span className={`status-badge ${badge.class}`}>{badge.text}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
