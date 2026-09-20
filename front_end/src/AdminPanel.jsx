import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchUsers, fetchPosts, fetchSessions } from './api';
import './AdminPanel.css';

const AdminPanel = ({ user }) => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

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

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getRoleBadges = (user) => {
    const badges = [];
    if (user.role === 'tutor' || user.role === 'both') {
      badges.push({ label: 'Peer Tutor', class: 'tutor' });
    }
    if (user.role === 'student' || user.role === 'both') {
      badges.push({ label: 'Student', class: 'student' });
    }
    if (user.is_admin) {
      badges.push({ label: 'Admin', class: 'admin' });
    }
    return badges;
  };

  const getStatusInfo = (user) => {
    if (user.is_verified) {
      return { label: 'Active', sublabel: 'Verified', class: 'active' };
    }
    return { label: 'Pending', sublabel: 'Review', class: 'pending' };
  };

  const getFilteredUsers = () => {
    let filtered = [...users];

    if (activeFilter === 'students') {
      filtered = filtered.filter(u => u.role === 'student');
    } else if (activeFilter === 'tutors') {
      filtered = filtered.filter(u => u.role === 'tutor' || u.role === 'both');
    } else if (activeFilter === 'admins') {
      filtered = filtered.filter(u => u.is_admin);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(u =>
        u.full_name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.department?.toLowerCase().includes(q)
      );
    }

    return filtered;
  };

  const filteredUsers = getFilteredUsers();
  const totalPages = Math.ceil(filteredUsers.length / rowsPerPage);
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const handleSelectUser = (userId) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    if (selectedUsers.length === paginatedUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(paginatedUsers.map(u => u.user_id));
    }
  };

  const tutorCount = users.filter(u => u.role === 'tutor' || u.role === 'both').length;
  const studentCount = users.filter(u => u.role === 'student' || u.role === 'both').length;
  const totalWallet = users.reduce((sum, u) => sum + (parseFloat(u.wallet_balance) || 0), 0);

  if (loading) {
    return <div className="admin-loading">Loading admin data...</div>;
  }

  return (
    <div className="admin-content">
      {/* Top Header */}
      <header className="admin-top-header">
        <div className="header-breadcrumb">
          <span className="breadcrumb-label">INSTITUTIONAL GOVERNANCE</span>
          <span className="breadcrumb-sep">/</span>
          <span className="breadcrumb-value">Registry Node ID: BRACU-DH-09</span>
        </div>
        <div className="header-actions">
          <button className="header-btn freeze-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Freeze Platform
          </button>
          <button className="icon-btn-header">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button className="icon-btn-header">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="12" y1="17" x2="12.01" y2="17" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </header>

      {/* Dashboard Content */}
      <div className="admin-dashboard">
        <div className="dashboard-header">
          <div className="dashboard-title-row">
            <h1 className="dashboard-title">Dashboard</h1>
            <div className="dashboard-actions">
              <button className="action-btn secondary">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" strokeLinecap="round" strokeLinejoin="round"/>
                  <polyline points="22 4 12 14.01 9 11.01" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Batch Verify Tutors
              </button>
              <button className="action-btn primary">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="8.5" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round"/>
                  <line x1="20" y1="8" x2="20" y2="14" strokeLinecap="round" strokeLinejoin="round"/>
                  <line x1="23" y1="11" x2="17" y2="11" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                + Manual Student Onboard
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-label">ENROLLED STUDENTS</span>
              <svg className="stat-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M6 12v5c3 3 9 3 12 0v-5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="stat-value">{users.length.toLocaleString()}</div>
            <div className="stat-footer">
              <span className="stat-trend positive">+3.2% term</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-label">CERTIFIED PEER TUTORS</span>
              <svg className="stat-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="22 4 12 14.01 9 11.01" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="stat-value">{tutorCount.toLocaleString()}</div>
            <div className="stat-footer">
              <span className="stat-ratio">{users.length > 0 ? Math.round((tutorCount / users.length) * 100) : 0}% ratio</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-label">DISCIPLINARY STRIKES</span>
              <svg className="stat-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="12" y1="9" x2="12" y2="13" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="12" y1="17" x2="12.01" y2="17" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="stat-value">0</div>
            <div className="stat-footer">
              <span className="stat-pending">0 pending review</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-label">ESCROW ACTIVE WALLETS</span>
              <svg className="stat-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="4" width="20" height="16" rx="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 10h20" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="stat-value">{users.length.toLocaleString()}</div>
            <div className="stat-footer">
              <span className="stat-locked">৳ {totalWallet.toLocaleString()} total</span>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="filter-tabs">
          <button
            className={`filter-tab ${activeFilter === 'all' ? 'active' : ''}`}
            onClick={() => { setActiveFilter('all'); setCurrentPage(1); }}
          >
            All Users <span className="filter-count">{users.length.toLocaleString()}</span>
          </button>
          <button
            className={`filter-tab ${activeFilter === 'students' ? 'active' : ''}`}
            onClick={() => { setActiveFilter('students'); setCurrentPage(1); }}
          >
            Students Only <span className="filter-count">{studentCount.toLocaleString()}</span>
          </button>
          <button
            className={`filter-tab ${activeFilter === 'tutors' ? 'active' : ''}`}
            onClick={() => { setActiveFilter('tutors'); setCurrentPage(1); }}
          >
            Certified Tutors <span className="filter-count">{tutorCount.toLocaleString()}</span>
          </button>
          <button
            className={`filter-tab ${activeFilter === 'admins' ? 'active' : ''}`}
            onClick={() => { setActiveFilter('admins'); setCurrentPage(1); }}
          >
            Admins <span className="filter-count">{users.filter(u => u.is_admin).length}</span>
          </button>
          <div className="filter-sync">
            <span className="sync-dot"></span>
            Database synced 2 mins ago
          </div>
        </div>

        {/* Search & Filters */}
        <div className="search-filters">
          <div className="search-box">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            />
          </div>
          <select className="filter-select">
            <option>All Departments</option>
            <option>Computer Science</option>
            <option>Mathematics</option>
            <option>Engineering</option>
            <option>Data Science</option>
          </select>
          <select className="filter-select">
            <option>All Verification Statuses</option>
            <option>Verified</option>
            <option>Pending</option>
          </select>
          <select className="filter-select">
            <option>Sort: Last Active</option>
            <option>Sort: Name A-Z</option>
            <option>Sort: Newest</option>
          </select>
        </div>

        {/* Bulk Actions */}
        {selectedUsers.length > 0 && (
          <div className="bulk-actions">
            <span className="bulk-count">{selectedUsers.length} selected</span>
            <button className="bulk-btn verify">Verify Selected ({selectedUsers.length})</button>
            <button className="bulk-btn notice">Issue Formal Notice</button>
          </div>
        )}

        {/* Users Table */}
        <div className="users-table-container">
          <table className="users-table">
            <thead>
              <tr>
                <th className="th-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedUsers.length === paginatedUsers.length && paginatedUsers.length > 0}
                    onChange={handleSelectAll}
                  />
                </th>
                <th>STUDENT / USER IDENTITY</th>
                <th>CAMPUS ROLE & BADGES</th>
                <th>ACADEMIC STANDING</th>
                <th>SESSION VOLUME</th>
                <th>ESCROW WALLET</th>
                <th>STATUS</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {paginatedUsers.map(u => {
                const roleBadges = getRoleBadges(u);
                const statusInfo = getStatusInfo(u);
                const userSessions = sessions.filter(s =>
                  s.tutor_id === u.user_id || s.student_id === u.user_id
                ).length;
                const userPosts = posts.filter(p => p.user_id === u.user_id).length;

                return (
                  <tr key={u.user_id} className={selectedUsers.includes(u.user_id) ? 'selected' : ''}>
                    <td className="td-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(u.user_id)}
                        onChange={() => handleSelectUser(u.user_id)}
                      />
                    </td>
                    <td className="td-identity">
                      <div className="user-identity">
                        <div className="user-avatar" style={{ background: u.is_admin ? '#6366f1' : '#1e293b' }}>
                          {getInitials(u.full_name)}
                        </div>
                        <div className="user-info">
                          <div className="user-name">
                            {u.full_name}
                            {u.is_verified === 1 && (
                              <svg className="verified-icon" width="14" height="14" viewBox="0 0 24 24" fill="#22c55e" stroke="none">
                                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                              </svg>
                            )}
                            {u.is_admin === 1 && <span className="admin-tag">ADMIN</span>}
                          </div>
                          <div className="user-detail">
                            ID #{u.student_id || u.user_id} &bull; {u.department || 'N/A'}
                          </div>
                          <div className="user-email">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="td-role">
                      <div className="role-badges">
                        {roleBadges.map((badge, i) => (
                          <span key={i} className={`role-badge ${badge.class}`}>{badge.label}</span>
                        ))}
                      </div>
                    </td>
                    <td className="td-standing">
                      <div className="standing-info">
                        <span className="standing-label">{u.department || 'General'}</span>
                        <span className="standing-detail">{u.role === 'both' ? 'Student & Tutor' : u.role === 'tutor' ? 'Peer Tutor' : 'Student'}</span>
                      </div>
                    </td>
                    <td className="td-sessions">
                      <div className="session-info">
                        <span className="session-count">{userSessions} Sessions</span>
                        <span className="session-posts">{userPosts} Posts</span>
                      </div>
                    </td>
                    <td className="td-wallet">
                      <div className="wallet-info">
                        <span className="wallet-amount">৳ {parseFloat(u.wallet_balance || 0).toLocaleString()}</span>
                      </div>
                    </td>
                    <td className="td-status">
                      <span className={`status-badge ${statusInfo.class}`}>
                        <span className="status-dot"></span>
                        {statusInfo.label}
                        <span className="status-sub">{statusInfo.sublabel}</span>
                      </span>
                    </td>
                    <td className="td-action">
                      <button className="action-btn-sm">Profile</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="pagination-bar">
          <div className="pagination-info">
            Showing <strong>{(currentPage - 1) * rowsPerPage + 1}</strong> to{' '}
            <strong>{Math.min(currentPage * rowsPerPage, filteredUsers.length)}</strong> of{' '}
            <strong>{filteredUsers.length}</strong> accounts
          </div>
          <div className="pagination-controls">
            <span className="rows-label">Rows per page:</span>
            <select
              className="rows-select"
              value={rowsPerPage}
              onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <div className="page-buttons">
              <button
                className="page-btn"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
              >
                &lt;
              </button>
              {Array.from({ length: Math.min(3, totalPages) }, (_, i) => {
                const page = currentPage <= 2 ? i + 1 : currentPage + i - 1;
                if (page > totalPages) return null;
                return (
                  <button
                    key={page}
                    className={`page-btn ${currentPage === page ? 'active' : ''}`}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                );
              })}
              {totalPages > 3 && <span className="page-ellipsis">...</span>}
              <button
                className="page-btn"
                disabled={currentPage === totalPages || totalPages === 0}
                onClick={() => setCurrentPage(currentPage + 1)}
              >
                &gt;
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
