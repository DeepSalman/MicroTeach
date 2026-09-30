import React, { useState, useEffect, useMemo } from 'react';
import { fetchUsers, fetchPosts, fetchSessions, updateUserVerification, updateUserRole } from './api';
import { avatarStyle } from './utils';
import ChatModal from './ChatModal';
import './UserManagement.css';

const UserManagement = ({ user }) => {
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'students' | 'tutors' | 'pending' | 'admins'
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name'); // 'name' | 'newest' | 'wallet' | 'active'

  // Expandable inspection drawer
  const [expandedUserId, setExpandedUserId] = useState(null);

  // Multi-select for bulk actions
  const [selectedUsers, setSelectedUsers] = useState([]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Async feedback & actions
  const [actionLoading, setActionLoading] = useState(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type, message }

  // Chat modal integration
  const [chatOpen, setChatOpen] = useState(false);
  const [chatTargetUserId, setChatTargetUserId] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 4500);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  const loadData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const [usersRes, postsRes, sessionsRes] = await Promise.all([
        fetchUsers().catch(() => ({ data: [] })),
        fetchPosts().catch(() => ({ data: [] })),
        fetchSessions().catch(() => ({ data: [] }))
      ]);
      setUsers(usersRes.data || []);
      setPosts(postsRes.data || []);
      setSessions(sessionsRes.data || []);
    } catch (err) {
      console.error('Failed to load user management data:', err);
      setFeedback({ type: 'error', message: 'Failed to load user data.' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Helper metrics
  const tutorCount = useMemo(() => users.filter(u => u.role === 'tutor' || u.role === 'both').length, [users]);
  const studentCount = useMemo(() => users.filter(u => u.role === 'student').length, [users]);
  const adminCount = useMemo(() => users.filter(u => u.is_admin).length, [users]);
  const pendingCount = useMemo(() => users.filter(u => !u.is_verified).length, [users]);
  const totalWallet = useMemo(() => users.reduce((sum, u) => sum + (parseFloat(u.wallet_balance) || 0), 0), [users]);

  const departments = useMemo(() => {
    const set = new Set();
    users.forEach(u => {
      if (u.department) set.add(u.department);
    });
    return Array.from(set).sort();
  }, [users]);

  // Activity lookups
  const userPostCounts = useMemo(() => {
    const map = {};
    posts.forEach(p => {
      map[p.user_id] = (map[p.user_id] || 0) + 1;
    });
    return map;
  }, [posts]);

  const userSessionCounts = useMemo(() => {
    const map = {};
    sessions.forEach(s => {
      if (s.tutor_id) map[s.tutor_id] = (map[s.tutor_id] || 0) + 1;
      if (s.student_id) map[s.student_id] = (map[s.student_id] || 0) + 1;
    });
    return map;
  }, [sessions]);

  // Filtering & Sorting
  const filteredUsers = useMemo(() => {
    let result = [...users];

    // Tab filter
    if (activeTab === 'students') {
      result = result.filter(u => u.role === 'student');
    } else if (activeTab === 'tutors') {
      result = result.filter(u => u.role === 'tutor' || u.role === 'both');
    } else if (activeTab === 'pending') {
      result = result.filter(u => !u.is_verified);
    } else if (activeTab === 'admins') {
      result = result.filter(u => u.is_admin);
    }

    // Department filter
    if (deptFilter !== 'all') {
      result = result.filter(u => u.department === deptFilter);
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(u =>
        (u.full_name && u.full_name.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.student_id && String(u.student_id).toLowerCase().includes(q)) ||
        (u.department && u.department.toLowerCase().includes(q))
      );
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'name') {
        return (a.full_name || '').localeCompare(b.full_name || '');
      } else if (sortBy === 'newest') {
        return (b.user_id || 0) - (a.user_id || 0);
      } else if (sortBy === 'wallet') {
        return (parseFloat(b.wallet_balance) || 0) - (parseFloat(a.wallet_balance) || 0);
      } else if (sortBy === 'active') {
        const aCount = (userPostCounts[a.user_id] || 0) + (userSessionCounts[a.user_id] || 0);
        const bCount = (userPostCounts[b.user_id] || 0) + (userSessionCounts[b.user_id] || 0);
        return bCount - aCount;
      }
      return 0;
    });

    return result;
  }, [users, activeTab, deptFilter, searchQuery, sortBy, userPostCounts, userSessionCounts]);

  // Pagination
  const totalPages = Math.ceil(filteredUsers.length / rowsPerPage) || 1;
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredUsers.slice(start, start + rowsPerPage);
  }, [filteredUsers, currentPage, rowsPerPage]);

  // Selection
  const handleSelectUser = (id) => {
    setSelectedUsers(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedUsers.length === paginatedUsers.length && paginatedUsers.length > 0) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(paginatedUsers.map(u => u.user_id));
    }
  };

  // Admin Actions
  const handleToggleVerification = async (userId, currentVerified) => {
    setActionLoading(userId);
    const newStatus = currentVerified ? 0 : 1;
    try {
      await updateUserVerification(userId, newStatus);
      setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, is_verified: newStatus } : u));
      setFeedback({
        type: 'success',
        message: `User #${userId} verification updated to ${newStatus ? 'VERIFIED' : 'UNVERIFIED'}.`
      });
    } catch (err) {
      console.error('Failed to update verification:', err);
      setFeedback({ type: 'error', message: 'Failed to update verification status.' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateRole = async (userId, newRole) => {
    setActionLoading(userId);
    try {
      await updateUserRole(userId, newRole);
      setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, role: newRole } : u));
      setFeedback({
        type: 'success',
        message: `User #${userId} role updated to ${newRole.toUpperCase()}.`
      });
    } catch (err) {
      console.error('Failed to update role:', err);
      setFeedback({ type: 'error', message: 'Failed to update user role.' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleBatchVerify = async () => {
    if (selectedUsers.length === 0) return;
    setBatchLoading(true);
    try {
      await Promise.all(selectedUsers.map(id => updateUserVerification(id, 1)));
      setUsers(prev => prev.map(u => selectedUsers.includes(u.user_id) ? { ...u, is_verified: 1 } : u));
      setFeedback({
        type: 'success',
        message: `Successfully verified ${selectedUsers.length} selected accounts.`
      });
      setSelectedUsers([]);
    } catch (err) {
      console.error('Batch verification error:', err);
      setFeedback({ type: 'error', message: 'Failed to batch-verify selected accounts.' });
    } finally {
      setBatchLoading(false);
    }
  };

  // CSV Export
  const exportUsersCSV = (usersToExport) => {
    const headers = ['User ID', 'Full Name', 'Email', 'Role', 'Department', 'Student ID', 'Verified', 'Wallet Balance (BDT)', 'Created At'];
    const rows = usersToExport.map(u => [
      u.user_id,
      `"${(u.full_name || '').replace(/"/g, '""')}"`,
      `"${(u.email || '').replace(/"/g, '""')}"`,
      u.role || 'student',
      `"${(u.department || 'N/A').replace(/"/g, '""')}"`,
      `"${(u.student_id || '').replace(/"/g, '""')}"`,
      u.is_verified ? 'Verified' : 'Pending',
      parseFloat(u.wallet_balance || 0).toFixed(2),
      u.created_at ? new Date(u.created_at).toISOString().split('T')[0] : ''
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `microteach_users_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getRoleBadge = (u) => {
    if (u.is_admin) return { label: 'Admin', class: 'badge-admin' };
    if (u.role === 'both') return { label: 'Student & Tutor', class: 'badge-both' };
    if (u.role === 'tutor') return { label: 'Peer Tutor', class: 'badge-tutor' };
    return { label: 'Student', class: 'badge-student' };
  };

  if (loading) {
    return (
      <div className="admin-content">
        <div className="um-loading-wrap">
          <div className="um-spinner"></div>
          <span>Loading user registry &amp; campus accounts...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-content um-wrapper">
      {/* ─── Header ─── */}
      <header className="um-header">
        <div className="um-header-left">
          <div className="um-title-group">
            <h1 className="um-title">User Directory</h1>
            <div className="um-stats-strip">
              <span className="um-stat-pill"><strong>{users.length}</strong> Users</span>
              <span className="um-stat-sep">&bull;</span>
              <span className="um-stat-pill"><strong>{studentCount}</strong> Students</span>
              <span className="um-stat-sep">&bull;</span>
              <span className="um-stat-pill"><strong>{tutorCount}</strong> Tutors</span>
              <span className="um-stat-sep">&bull;</span>
              <span className="um-stat-pill"><strong>৳ {Math.round(totalWallet).toLocaleString()}</strong> Escrow</span>
            </div>
          </div>
          <p className="um-subtitle">
            Manage authenticated campus student identities, verified peer tutors, and institutional standing.
          </p>
        </div>

        <div className="um-header-actions">
          <button
            className="um-btn um-btn-secondary"
            onClick={() => exportUsersCSV(filteredUsers)}
            title="Export filtered directory to CSV"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
              <polyline points="7 10 12 15 17 10" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="12" y1="15" x2="12" y2="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Export CSV
          </button>
          <button
            className="um-btn um-btn-refresh"
            onClick={() => loadData(true)}
            disabled={refreshing}
            title="Refresh database records"
          >
            <svg className={refreshing ? 'spin' : ''} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </header>

      {/* ─── Feedback Toast ─── */}
      {feedback && (
        <div className={`um-toast ${feedback.type}`}>
          <span>{feedback.message}</span>
          <button className="um-toast-close" onClick={() => setFeedback(null)}>&times;</button>
        </div>
      )}

      {/* ─── Filter Tabs & Controls ─── */}
      <section className="um-controls-panel">
        <div className="um-tabs-row">
          <div className="um-tabs">
            <button
              className={`um-tab ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => { setActiveTab('all'); setCurrentPage(1); }}
            >
              All Users <span className="um-tab-badge">{users.length}</span>
            </button>
            <button
              className={`um-tab ${activeTab === 'students' ? 'active' : ''}`}
              onClick={() => { setActiveTab('students'); setCurrentPage(1); }}
            >
              Students <span className="um-tab-badge">{studentCount}</span>
            </button>
            <button
              className={`um-tab ${activeTab === 'tutors' ? 'active' : ''}`}
              onClick={() => { setActiveTab('tutors'); setCurrentPage(1); }}
            >
              Peer Tutors <span className="um-tab-badge">{tutorCount}</span>
            </button>
            <button
              className={`um-tab ${activeTab === 'pending' ? 'active' : ''}`}
              onClick={() => { setActiveTab('pending'); setCurrentPage(1); }}
            >
              In Review <span className={`um-tab-badge ${pendingCount > 0 ? 'badge-warn' : ''}`}>{pendingCount}</span>
            </button>
            <button
              className={`um-tab ${activeTab === 'admins' ? 'active' : ''}`}
              onClick={() => { setActiveTab('admins'); setCurrentPage(1); }}
            >
              Admins <span className="um-tab-badge">{adminCount}</span>
            </button>
          </div>
        </div>

        <div className="um-search-row">
          <div className="um-search-box">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <input
              type="text"
              placeholder="Search by name, student ID, email, or department..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            />
            {searchQuery && (
              <button className="um-search-clear" onClick={() => setSearchQuery('')}>&times;</button>
            )}
          </div>

          <div className="um-filter-dropdowns">
            <select
              className="um-select"
              value={deptFilter}
              onChange={(e) => { setDeptFilter(e.target.value); setCurrentPage(1); }}
            >
              <option value="all">All Departments ({departments.length})</option>
              {departments.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>

            <select
              className="um-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="name">Sort: Name (A-Z)</option>
              <option value="newest">Sort: Newest User</option>
              <option value="wallet">Sort: Highest Wallet</option>
              <option value="active">Sort: Most Active</option>
            </select>
          </div>
        </div>
      </section>

      {/* ─── Bulk Action Strip ─── */}
      {selectedUsers.length > 0 && (
        <div className="um-bulk-bar">
          <div className="um-bulk-info">
            <span className="um-bulk-count">{selectedUsers.length}</span>
            <span>account(s) selected</span>
          </div>
          <div className="um-bulk-actions">
            <button
              className="um-bulk-btn verify"
              onClick={handleBatchVerify}
              disabled={batchLoading}
            >
              {batchLoading ? 'Verifying...' : `Verify Selected (${selectedUsers.length})`}
            </button>
            <button
              className="um-bulk-btn export"
              onClick={() => exportUsersCSV(users.filter(u => selectedUsers.includes(u.user_id)))}
            >
              Export Selected CSV
            </button>
            <button
              className="um-bulk-btn cancel"
              onClick={() => setSelectedUsers([])}
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* ─── User Table ─── */}
      <section className="um-table-container">
        <table className="um-table">
          <thead>
            <tr>
              <th className="th-check">
                <input
                  type="checkbox"
                  checked={selectedUsers.length === paginatedUsers.length && paginatedUsers.length > 0}
                  onChange={handleSelectAll}
                  aria-label="Select all rows"
                />
              </th>
              <th>USER IDENTITY</th>
              <th>ROLE &amp; CAMPUS BADGE</th>
              <th>DEPARTMENT</th>
              <th>ENGAGEMENT</th>
              <th>ESCROW WALLET</th>
              <th>STATUS</th>
              <th className="th-action">ACTION</th>
            </tr>
          </thead>
          <tbody>
            {paginatedUsers.length === 0 ? (
              <tr>
                <td colSpan="8" className="um-empty-td">
                  No accounts matched your search or filters.
                </td>
              </tr>
            ) : (
              paginatedUsers.map(u => {
                const isExpanded = expandedUserId === u.user_id;
                const isSelected = selectedUsers.includes(u.user_id);
                const roleBadge = getRoleBadge(u);
                const userPosts = userPostCounts[u.user_id] || 0;
                const userSessions = userSessionCounts[u.user_id] || 0;

                return (
                  <React.Fragment key={u.user_id}>
                    <tr
                      className={`um-row ${isExpanded ? 'expanded' : ''} ${isSelected ? 'selected' : ''}`}
                      onClick={() => setExpandedUserId(isExpanded ? null : u.user_id)}
                    >
                      <td className="td-check" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectUser(u.user_id)}
                          aria-label={`Select ${u.full_name}`}
                        />
                      </td>

                      {/* Identity */}
                      <td className="td-user">
                        <div className="um-user-cell">
                          <div
                            className="um-avatar"
                            style={avatarStyle(u.avatar_color) || { background: u.is_admin ? '#4f46e5' : '#1e293b' }}
                          >
                            {getInitials(u.full_name)}
                          </div>
                          <div className="um-user-meta">
                            <div className="um-name-row">
                              <span className="um-name">{u.full_name}</span>
                              {u.is_verified === 1 && (
                                <span className="um-verified-tick" title="Verified Campus Identity">✓</span>
                              )}
                              {u.is_admin === 1 && (
                                <span className="um-admin-pill">ADMIN</span>
                              )}
                            </div>
                            <span className="um-id-dept">
                              {u.student_id ? `ID #${u.student_id}` : `UID #${u.user_id}`} &bull; {u.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="td-role">
                        <span className={`um-role-badge ${roleBadge.class}`}>
                          {roleBadge.label}
                        </span>
                      </td>

                      {/* Department */}
                      <td className="td-dept">
                        <span className="um-dept-name">{u.department || 'General / Unspecified'}</span>
                      </td>

                      {/* Engagement */}
                      <td className="td-engagement">
                        <div className="um-engagement-cell">
                          <span className="um-eng-posts">{userPosts} Bounties</span>
                          <span className="um-eng-sessions">{userSessions} Sessions</span>
                        </div>
                      </td>

                      {/* Escrow Wallet */}
                      <td className="td-wallet">
                        <span className="um-wallet-amount">৳ {parseFloat(u.wallet_balance || 0).toLocaleString()}</span>
                      </td>

                      {/* Verification Status */}
                      <td className="td-status">
                        <span className={`um-status-badge ${u.is_verified ? 'active' : 'pending'}`}>
                          <span className="um-status-dot"></span>
                          {u.is_verified ? 'Verified' : 'Pending Review'}
                        </span>
                      </td>

                      {/* Expand / Inspect Action */}
                      <td className="td-action" onClick={(e) => e.stopPropagation()}>
                        <button
                          className={`um-inspect-btn ${isExpanded ? 'open' : ''}`}
                          onClick={() => setExpandedUserId(isExpanded ? null : u.user_id)}
                          title="Inspect user details and controls"
                        >
                          {isExpanded ? 'Close' : 'Inspect'}
                          <span className="um-chevron">{isExpanded ? '▲' : '▼'}</span>
                        </button>
                      </td>
                    </tr>

                    {/* ─── Expandable Inspection Drawer ─── */}
                    {isExpanded && (
                      <tr className="um-drawer-row">
                        <td colSpan="8" className="um-drawer-cell">
                          <div className="um-drawer">
                            {/* Panel 1: Credentials */}
                            <div className="um-drawer-panel">
                              <h4 className="um-drawer-heading">Identity &amp; Credentials</h4>
                              <div className="um-drawer-info-grid">
                                <div className="um-info-item">
                                  <span className="um-info-label">Full Name</span>
                                  <span className="um-info-val">{u.full_name}</span>
                                </div>
                                <div className="um-info-item">
                                  <span className="um-info-label">Student ID</span>
                                  <span className="um-info-val">{u.student_id || 'Not provided'}</span>
                                </div>
                                <div className="um-info-item">
                                  <span className="um-info-label">Email Address</span>
                                  <span className="um-info-val">{u.email}</span>
                                </div>
                                <div className="um-info-item">
                                  <span className="um-info-label">Academic Department</span>
                                  <span className="um-info-val">{u.department || 'Not specified'}</span>
                                </div>
                                <div className="um-info-item">
                                  <span className="um-info-label">User ID &bull; Created</span>
                                  <span className="um-info-val">#{u.user_id} &bull; {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'N/A'}</span>
                                </div>
                              </div>
                            </div>

                            {/* Panel 2: Marketplace Activity */}
                            <div className="um-drawer-panel">
                              <h4 className="um-drawer-heading">Marketplace Footprint</h4>
                              <div className="um-drawer-info-grid">
                                <div className="um-info-item">
                                  <span className="um-info-label">Escrow Wallet Balance</span>
                                  <span className="um-info-val font-mono">৳ {parseFloat(u.wallet_balance || 0).toLocaleString()}</span>
                                </div>
                                <div className="um-info-item">
                                  <span className="um-info-label">Tutoring Bounties Posted</span>
                                  <span className="um-info-val">{userPosts} total requests</span>
                                </div>
                                <div className="um-info-item">
                                  <span className="um-info-label">Tutoring Sessions Logged</span>
                                  <span className="um-info-val">{userSessions} sessions</span>
                                </div>
                                <div className="um-info-item">
                                  <span className="um-info-label">Identity Verification</span>
                                  <span className={`um-info-val ${u.is_verified ? 'text-success' : 'text-warning'}`}>
                                    {u.is_verified ? 'Verified Active Member' : 'Pending Verification Review'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Panel 3: Administrative Controls */}
                            <div className="um-drawer-panel controls-panel">
                              <h4 className="um-drawer-heading">Admin Operational Controls</h4>

                              <div className="um-control-block">
                                <span className="um-control-label">Identity Verification</span>
                                <button
                                  className={`um-ctrl-btn ${u.is_verified ? 'danger' : 'success'}`}
                                  onClick={() => handleToggleVerification(u.user_id, u.is_verified)}
                                  disabled={actionLoading === u.user_id}
                                >
                                  {actionLoading === u.user_id
                                    ? 'Updating...'
                                    : u.is_verified
                                    ? 'Revoke Verification'
                                    : 'Verify Student Identity ✓'}
                                </button>
                              </div>

                              <div className="um-control-block">
                                <span className="um-control-label">Role Assignment</span>
                                <div className="um-role-button-group">
                                  <button
                                    className={`um-role-btn ${u.role === 'student' ? 'active' : ''}`}
                                    onClick={() => handleUpdateRole(u.user_id, 'student')}
                                    disabled={actionLoading === u.user_id}
                                  >
                                    Student
                                  </button>
                                  <button
                                    className={`um-role-btn ${u.role === 'tutor' ? 'active' : ''}`}
                                    onClick={() => handleUpdateRole(u.user_id, 'tutor')}
                                    disabled={actionLoading === u.user_id}
                                  >
                                    Peer Tutor
                                  </button>
                                  <button
                                    className={`um-role-btn ${u.role === 'both' ? 'active' : ''}`}
                                    onClick={() => handleUpdateRole(u.user_id, 'both')}
                                    disabled={actionLoading === u.user_id}
                                  >
                                    Both
                                  </button>
                                </div>
                              </div>

                              <div className="um-control-block">
                                <span className="um-control-label">Direct Communication</span>
                                <button
                                  className="um-ctrl-btn message"
                                  onClick={() => {
                                    setChatTargetUserId(u.user_id);
                                    setChatOpen(true);
                                  }}
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                  Message User in Chat
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </section>

      {/* ─── Pagination Bar ─── */}
      <footer className="um-pagination-bar">
        <div className="um-pagination-info">
          Showing <strong>{filteredUsers.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1}</strong> to{' '}
          <strong>{Math.min(currentPage * rowsPerPage, filteredUsers.length)}</strong> of{' '}
          <strong>{filteredUsers.length}</strong> accounts
        </div>

        <div className="um-pagination-controls">
          <div className="um-rows-group">
            <span className="um-rows-label">Rows per page:</span>
            <select
              className="um-rows-select"
              value={rowsPerPage}
              onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>

          <div className="um-page-buttons">
            <button
              className="um-page-btn"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              title="Previous page"
            >
              &larr;
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                className={`um-page-btn ${currentPage === page ? 'active' : ''}`}
                onClick={() => setCurrentPage(page)}
              >
                {page}
              </button>
            ))}
            <button
              className="um-page-btn"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              title="Next page"
            >
              &rarr;
            </button>
          </div>
        </div>
      </footer>

      {/* ─── Integrated Chat Modal ─── */}
      {chatOpen && (
        <ChatModal
          user={user}
          onClose={() => { setChatOpen(false); setChatTargetUserId(null); }}
          startWithUserId={chatTargetUserId}
        />
      )}
    </div>
  );
};

export default UserManagement;
