import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchUsers, fetchPosts, fetchSessions } from './api';
import './UserManagement.css';

const UserManagement = ({ user }) => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [usersRes, postsRes, sessionsRes] = await Promise.all([
        fetchUsers(), fetchPosts(), fetchSessions()
      ]);
      setUsers(usersRes.data);
      setPosts(postsRes.data);
      setSessions(sessionsRes.data);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getFilteredUsers = () => {
    let filtered = [...users];
    if (activeFilter === 'students') filtered = filtered.filter(u => u.role === 'student');
    else if (activeFilter === 'tutors') filtered = filtered.filter(u => u.role === 'tutor' || u.role === 'both');
    else if (activeFilter === 'flagged') filtered = filtered.filter(u => !u.is_verified);

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(u =>
        u.full_name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.student_id?.toLowerCase().includes(q)
      );
    }
    if (deptFilter !== 'all') filtered = filtered.filter(u => u.department === deptFilter);
    if (roleFilter !== 'all') filtered = filtered.filter(u => u.role === roleFilter);
    if (statusFilter !== 'all') {
      if (statusFilter === 'verified') filtered = filtered.filter(u => u.is_verified);
      else if (statusFilter === 'pending') filtered = filtered.filter(u => !u.is_verified);
    }
    return filtered;
  };

  const filteredUsers = getFilteredUsers();
  const totalPages = Math.ceil(filteredUsers.length / rowsPerPage);
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const handleSelectUser = (userId) => {
    setSelectedUsers(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]);
  };

  const handleSelectAll = () => {
    setSelectedUsers(selectedUsers.length === paginatedUsers.length ? [] : paginatedUsers.map(u => u.user_id));
  };

  const tutorCount = users.filter(u => u.role === 'tutor' || u.role === 'both').length;
  const studentCount = users.filter(u => u.role === 'student').length;
  const flaggedCount = users.filter(u => !u.is_verified).length;
  const totalWallet = users.reduce((sum, u) => sum + (parseFloat(u.wallet_balance) || 0), 0);
  const departments = [...new Set(users.map(u => u.department).filter(Boolean))];

  const getUserSessions = (userId) => sessions.filter(s => s.tutor_id === userId || s.student_id === userId).length;
  const getUserPosts = (userId) => posts.filter(p => p.user_id === userId).length;

  if (loading) {
    return <div className="admin-loading">Loading user management...</div>;
  }

  return (
    <div className="admin-content">
      <header className="admin-top-header">
          <div className="header-breadcrumb">
            <span className="breadcrumb-label">INSTITUTIONAL NODE</span>
            <span className="version-tag">v2.4</span>
          </div>
          <div className="header-actions">
            <button className="freeze-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" strokeLinecap="round" strokeLinejoin="round"/><line x1="21" y1="21" x2="16.65" y2="16.65" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Search students, IDs, departments...
            </button>
            <button className="icon-btn-header">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round"/><path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <div className="header-user">
              <div className="header-user-avatar">{getInitials(user?.full_name)}</div>
              <div className="header-user-info">
                <span className="header-user-name">{user?.full_name || 'Admin'}</span>
                <span className="header-user-role">Super Admin</span>
              </div>
            </div>
          </div>
        </header>

        <div className="admin-dashboard">
          <div className="breadcrumb-path">
            <span>Governance</span>
            <span className="bc-sep">/</span>
            <span>Registry &amp; Identity</span>
            <span className="bc-sep">/</span>
            <span className="bc-current">User Management</span>
          </div>

          <div className="dashboard-header">
            <div className="dashboard-title-row">
              <div>
                <h1 className="dashboard-title">User Management</h1>
                <p className="dashboard-subtitle">Manage authenticated campus identities, peer tutor credentials, and disciplinary standing.</p>
              </div>
              <div className="dashboard-actions">
                <button className="action-btn secondary">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round"/><polyline points="7 10 12 15 17 10" strokeLinecap="round" strokeLinejoin="round"/><line x1="12" y1="15" x2="12" y2="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Export CSV
                </button>
                <button className="action-btn primary">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="8.5" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round"/><line x1="20" y1="8" x2="20" y2="14" strokeLinecap="round" strokeLinejoin="round"/><line x1="23" y1="11" x2="17" y2="11" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  + Add User
                </button>
              </div>
            </div>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-card-header">
                <span className="stat-label">ENROLLED STUDENTS</span>
                <svg className="stat-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z" strokeLinecap="round" strokeLinejoin="round"/><path d="M6 12v5c3 3 9 3 12 0v-5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div className="stat-value">{users.length.toLocaleString()}</div>
              <div className="stat-footer"><span className="stat-trend positive">Verified Active</span></div>
            </div>
            <div className="stat-card">
              <div className="stat-card-header">
                <span className="stat-label">CERTIFIED PEER TUTORS</span>
                <svg className="stat-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" strokeLinecap="round" strokeLinejoin="round"/><polyline points="22 4 12 14.01 9 11.01" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div className="stat-value">{tutorCount.toLocaleString()}</div>
              <div className="stat-footer"><span className="stat-ratio">{users.length > 0 ? Math.round((tutorCount / users.length) * 100) : 0}% Ratio</span></div>
            </div>
            <div className="stat-card">
              <div className="stat-card-header">
                <span className="stat-label">DISCIPLINARY STRIKES</span>
                <svg className="stat-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" strokeLinecap="round" strokeLinejoin="round"/><line x1="12" y1="9" x2="12" y2="13" strokeLinecap="round" strokeLinejoin="round"/><line x1="12" y1="17" x2="12.01" y2="17" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div className="stat-value">{flaggedCount}</div>
              <div className="stat-footer"><span className="stat-pending">{flaggedCount} Pending Review</span></div>
            </div>
            <div className="stat-card">
              <div className="stat-card-header">
                <span className="stat-label">ESCROW ACTIVE WALLETS</span>
                <svg className="stat-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 10h20" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div className="stat-value">{totalWallet.toLocaleString()}</div>
              <div className="stat-footer"><span className="stat-locked">{users.length} Wallets</span></div>
            </div>
          </div>

          <div className="filter-tabs">
            <button className={`filter-tab ${activeFilter === 'all' ? 'active' : ''}`} onClick={() => { setActiveFilter('all'); setCurrentPage(1); }}>
              All Users <span className="filter-count">{users.length.toLocaleString()}</span>
            </button>
            <button className={`filter-tab ${activeFilter === 'students' ? 'active' : ''}`} onClick={() => { setActiveFilter('students'); setCurrentPage(1); }}>
              Students <span className="filter-count">{studentCount.toLocaleString()}</span>
            </button>
            <button className={`filter-tab ${activeFilter === 'tutors' ? 'active' : ''}`} onClick={() => { setActiveFilter('tutors'); setCurrentPage(1); }}>
              Tutors <span className="filter-count">{tutorCount.toLocaleString()}</span>
            </button>
            <button className={`filter-tab ${activeFilter === 'flagged' ? 'active' : ''}`} onClick={() => { setActiveFilter('flagged'); setCurrentPage(1); }}>
              Flagged / Disciplinary <span className="filter-count">{flaggedCount}</span>
            </button>
            <div className="filter-sync">
              <span className="sync-dot"></span>
              Database synced 2m ago
            </div>
          </div>

          <div className="search-filters">
            <div className="search-box">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" strokeLinecap="round" strokeLinejoin="round"/><line x1="21" y1="21" x2="16.65" y2="16.65" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <input type="text" placeholder="Search users..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }} />
            </div>
            <select className="filter-select" value={deptFilter} onChange={(e) => { setDeptFilter(e.target.value); setCurrentPage(1); }}>
              <option value="all">All Academic Depts</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select className="filter-select" value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setCurrentPage(1); }}>
              <option value="all">All Roles: Students, Tutors, Leads</option>
              <option value="student">Students</option>
              <option value="tutor">Tutors</option>
              <option value="both">Students & Tutors</option>
            </select>
            <select className="filter-select" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}>
              <option value="all">All Statuses</option>
              <option value="verified">Verified</option>
              <option value="pending">Pending</option>
            </select>
            <select className="filter-select">
              <option>Sort: Last Active</option>
              <option>Sort: Name A-Z</option>
              <option>Sort: Newest</option>
            </select>
          </div>

          {selectedUsers.length > 0 && (
            <div className="bulk-actions">
              <span className="bulk-count">{selectedUsers.length} selected</span>
              <button className="bulk-btn verify">Verify Selected ({selectedUsers.length})</button>
              <button className="bulk-btn notice">Issue Formal Notice</button>
            </div>
          )}

          <div className="users-table-container">
            <table className="users-table">
              <thead>
                <tr>
                  <th className="th-checkbox">
                    <input type="checkbox" checked={selectedUsers.length === paginatedUsers.length && paginatedUsers.length > 0} onChange={handleSelectAll} />
                  </th>
                  <th>STUDENT / USER IDENTITY</th>
                  <th>ROLE &amp; DEPARTMENT</th>
                  <th>ACADEMIC STANDING</th>
                  <th>ACTIVITY &amp; SESSIONS</th>
                  <th>ESCROW WALLET</th>
                  <th>DISCIPLINARY / STATUS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.map(u => {
                  const sessions = getUserSessions(u.user_id);
                  const userPosts = getUserPosts(u.user_id);
                  return (
                    <tr key={u.user_id} className={selectedUsers.includes(u.user_id) ? 'selected' : ''}>
                      <td className="td-checkbox">
                        <input type="checkbox" checked={selectedUsers.includes(u.user_id)} onChange={() => handleSelectUser(u.user_id)} />
                      </td>
                      <td className="td-identity">
                        <div className="user-identity">
                          <div className="user-avatar" style={{ background: u.is_admin ? '#6366f1' : u.is_verified ? '#1e293b' : '#64748b' }}>
                            {u.is_admin && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                            {!u.is_admin && getInitials(u.full_name)}
                          </div>
                          <div className="user-info">
                            <div className="user-name">
                              {u.full_name}
                              {u.is_verified === 1 && (
                                <svg className="verified-icon" width="14" height="14" viewBox="0 0 24 24" fill="#22c55e" stroke="none"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                              )}
                              {!u.is_verified && <span className="review-tag">REVIEW</span>}
                              {u.is_admin === 1 && <span className="admin-tag">ADMIN</span>}
                            </div>
                            <div className="user-detail">#{u.student_id || u.user_id}</div>
                            <div className="user-email">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="td-role">
                        <div className="role-info">
                          <span className={`role-badge ${u.role === 'tutor' || u.role === 'both' ? 'tutor' : 'student'}`}>
                            {u.role === 'both' ? 'Student & Tutor' : u.role === 'tutor' ? 'Peer Tutor' : 'Student Requester'}
                          </span>
                          <span className="role-dept">{u.department || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="td-standing">
                        <div className="standing-info">
                          <span className="standing-label">{u.department || 'General'}</span>
                          <span className="standing-detail">{u.is_verified ? 'Verified' : 'Unverified'}</span>
                        </div>
                      </td>
                      <td className="td-activity">
                        <div className="activity-info">
                          <span className="activity-count">{userPosts} Bounties Posted</span>
                          <span className="activity-sessions">{sessions} Sessions</span>
                        </div>
                      </td>
                      <td className="td-wallet">
                        <div className="wallet-info">
                          <span className="wallet-amount">{'\u09F3'} {parseFloat(u.wallet_balance || 0).toLocaleString()}</span>
                          <span className="wallet-detail">{parseFloat(u.wallet_balance || 0) > 0 ? 'Payout Ready' : 'No Active Hold'}</span>
                        </div>
                      </td>
                      <td className="td-status">
                        <span className={`status-pill ${u.is_verified ? 'good' : 'review'}`}>
                          <span className="status-pill-dot"></span>
                          {u.is_verified ? 'Good Standing' : 'In Review'}
                        </span>
                      </td>
                      <td className="td-action">
                        <div className="action-group">
                          <button className="action-btn-sm">{u.is_verified ? 'View Profile' : 'Verify'}</button>
                          <button className="action-more">...</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="pagination-bar">
            <div className="pagination-info">
              Showing <strong>{(currentPage - 1) * rowsPerPage + 1}</strong> to{' '}
              <strong>{Math.min(currentPage * rowsPerPage, filteredUsers.length)}</strong> of{' '}
              <strong>{filteredUsers.length.toLocaleString()}</strong> accounts
            </div>
            <div className="pagination-controls">
              <span className="rows-label">Rows per page:</span>
              <select className="rows-select" value={rowsPerPage} onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}>
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
              </select>
              <div className="page-buttons">
                <button className="page-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)}>&lt;</button>
                {Array.from({ length: Math.min(3, totalPages) }, (_, i) => {
                  const page = currentPage <= 2 ? i + 1 : currentPage + i - 1;
                  if (page > totalPages || page < 1) return null;
                  return <button key={page} className={`page-btn ${currentPage === page ? 'active' : ''}`} onClick={() => setCurrentPage(page)}>{page}</button>;
                })}
                {totalPages > 3 && <span className="page-ellipsis">...</span>}
                <button className="page-btn" disabled={currentPage === totalPages || totalPages === 0} onClick={() => setCurrentPage(currentPage + 1)}>&gt;</button>
              </div>
            </div>
          </div>

          <footer className="admin-footer">
            <span>&copy; 2025 MicroTeach Campus Micro-Learning. All rights reserved.</span>
            <div className="footer-links">
              <a href="#" onClick={e => e.preventDefault()}>Academic Integrity Charter</a>
              <a href="#" onClick={e => e.preventDefault()}>Privacy Policy</a>
              <a href="#" onClick={e => e.preventDefault()}>Campus Helpdesk</a>
            </div>
          </footer>
        </div>
    </div>
  );
};

export default UserManagement;
