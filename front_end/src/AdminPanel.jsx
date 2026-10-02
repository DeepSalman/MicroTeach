import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchUsers, fetchPosts, fetchSessions, fetchTeacherApplications, fetchTransactionDisputes, fetchReports } from './api';
import { avatarStyle, formatDeadline } from './utils';
import './AdminPanel.css';

const AdminPanel = ({ user }) => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [teacherApps, setTeacherApps] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const [usersRes, postsRes, sessionsRes, teacherAppsRes, disputesRes, reportsRes] = await Promise.all([
        fetchUsers().catch(() => ({ data: [] })),
        fetchPosts().catch(() => ({ data: [] })),
        fetchSessions().catch(() => ({ data: [] })),
        fetchTeacherApplications().catch(() => ({ data: [] })),
        fetchTransactionDisputes().catch(() => ({ data: [] })),
        fetchReports().catch(() => ({ data: [] }))
      ]);

      setUsers(usersRes.data || []);
      setPosts(postsRes.data || []);
      setSessions(sessionsRes.data || []);
      setTeacherApps(teacherAppsRes.data || []);
      setDisputes(disputesRes.data || []);
      setReports(reportsRes.data || []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to load admin dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Metrics
  const tutorCount = useMemo(() => users.filter(u => u.role === 'tutor' || u.role === 'both').length, [users]);
  const studentCount = useMemo(() => users.filter(u => u.role === 'student' || u.role === 'both').length, [users]);
  const adminCount = useMemo(() => users.filter(u => u.is_admin).length, [users]);
  const totalWallet = useMemo(() => users.reduce((sum, u) => sum + (parseFloat(u.wallet_balance) || 0), 0), [users]);

  const activePostsCount = useMemo(() => posts.filter(p => p.status === 'active' || (!p.status && !p.is_completed)).length, [posts]);
  const completedPostsCount = useMemo(() => posts.filter(p => p.status === 'completed' || p.is_completed).length, [posts]);
  const totalBountyEscrow = useMemo(() => posts.reduce((sum, p) => sum + (parseFloat(p.bounty) || 0), 0), [posts]);

  // Action Items Queues
  const pendingTeacherApps = useMemo(() => teacherApps.filter(a => a.status === 'pending'), [teacherApps]);
  const pendingDisputes = useMemo(() => disputes.filter(d => d.status === 'pending' || d.status === 'under_review'), [disputes]);
  const pendingReports = useMemo(() => reports.filter(r => r.status === 'pending' || !r.status), [reports]);
  const totalActionItems = pendingTeacherApps.length + pendingDisputes.length + pendingReports.length;

  // ─── 3 Platform Academic Categories ───
  const ACADEMIC_CATEGORIES = [
    {
      id: 'undergrad',
      name: 'Undergrad Level',
      shortCode: 'UG',
      level: 'University',
      color: '#6366f1',
      bgSoft: 'rgba(99, 102, 241, 0.12)',
      borderSoft: 'rgba(99, 102, 241, 0.25)',
      gradient: 'linear-gradient(90deg, #6366f1 0%, #8b5cf6 100%)',
      shadow: '0 2px 8px rgba(99, 102, 241, 0.35)',
      matcher: (cat) => {
        const l = String(cat || '').toLowerCase().trim();
        return !l.includes('hsc') && !l.includes('ssc');
      }
    },
    {
      id: 'hsc',
      name: 'HSC Level',
      shortCode: 'HSC',
      level: 'College (11-12)',
      color: '#0284c7',
      bgSoft: 'rgba(2, 132, 199, 0.12)',
      borderSoft: 'rgba(2, 132, 199, 0.25)',
      gradient: 'linear-gradient(90deg, #0284c7 0%, #06b6d4 100%)',
      shadow: '0 2px 8px rgba(2, 132, 199, 0.35)',
      matcher: (cat) => {
        const l = String(cat || '').toLowerCase().trim();
        return l.includes('hsc') || l.includes('higher secondary');
      }
    },
    {
      id: 'ssc',
      name: 'SSC Level',
      shortCode: 'SSC',
      level: 'School (9-10)',
      color: '#f59e0b',
      bgSoft: 'rgba(245, 158, 11, 0.12)',
      borderSoft: 'rgba(245, 158, 11, 0.25)',
      gradient: 'linear-gradient(90deg, #f59e0b 0%, #ea580c 100%)',
      shadow: '0 2px 8px rgba(245, 158, 11, 0.35)',
      matcher: (cat) => {
        const l = String(cat || '').toLowerCase().trim();
        return l.includes('ssc') || l.includes('secondary school');
      }
    }
  ];

  // Dynamic Category Breakdown across 3 Categories
  const categoryStats = useMemo(() => {
    const totalPosts = posts.length || 0;
    return ACADEMIC_CATEGORIES.map(category => {
      const catPosts = posts.filter(p => category.matcher(p.category));
      const count = catPosts.length;
      const bounty = catPosts.reduce((sum, p) => sum + (parseFloat(p.bounty) || 0), 0);
      const activeCount = catPosts.filter(p => p.status === 'active' || (!p.status && !p.is_completed)).length;
      const completedCount = catPosts.filter(p => p.status === 'completed' || p.is_completed).length;
      const percent = totalPosts > 0 ? Math.round((count / totalPosts) * 100) : 0;
      return {
        ...category,
        count,
        bounty,
        activeCount,
        completedCount,
        percent
      };
    });
  }, [posts]);

  // Leading Demand Category
  const leadingCategory = useMemo(() => {
    return [...categoryStats].sort((a, b) => b.count - a.count)[0];
  }, [categoryStats]);

  // Format Helper
  const getDeliveryLabel = (format) => {
    switch (format) {
      case 'live_call': return 'Live Call';
      case 'annotated_pdf': return 'Annotated PDF';
      case 'video_walkthrough': return 'Video Walkthrough';
      default: return 'Online Session';
    }
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (loading) {
    return (
      <div className="admin-content">
        <div className="dash-loading-wrap">
          <div className="dash-spinner"></div>
          <span>Loading administrative metrics...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-content dash-wrapper">
      {/* ─── Top Dashboard Header ─── */}
      <header className="dash-header">
        <div className="dash-header-left">
          <div className="dash-title-row">
            <h1 className="dash-title">Platform Dashboard</h1>
            <div className="dash-live-badge">
              <span className="dash-live-dot"></span>
              Live Sync
            </div>
          </div>
          <p className="dash-subtitle">
            MicroTeach campus peer tutoring operations, escrow health, and moderation overview.
          </p>
        </div>

        <div className="dash-header-right">
          <div className="dash-sync-pill">
            <span className="dash-sync-time">Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            <button
              className="dash-refresh-btn"
              onClick={() => loadDashboardData(true)}
              disabled={refreshing}
              title="Refresh data"
            >
              <svg className={refreshing ? 'spin' : ''} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
      </header>

      {/* ─── Core KPI Cards Bar (4 clean metrics) ─── */}
      <section className="dash-kpi-grid">
        {/* KPI 1: User Base */}
        <div className="dash-kpi-card" onClick={() => navigate('/admin/users')} role="button" tabIndex={0}>
          <div className="dash-kpi-top">
            <span className="dash-kpi-label">CAMPUS USERS</span>
            <span className="dash-kpi-icon-wrap user-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="9" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </div>
          <div className="dash-kpi-number">{users.length}</div>
          <div className="dash-kpi-footer">
            <span className="dash-kpi-sub">
              <strong>{studentCount}</strong> Students &bull; <strong>{tutorCount}</strong> Peer Tutors
            </span>
            <span className="dash-kpi-arrow">&rarr;</span>
          </div>
        </div>

        {/* KPI 2: Tutoring Requests */}
        <div className="dash-kpi-card" onClick={() => navigate('/admin/moderation')} role="button" tabIndex={0}>
          <div className="dash-kpi-top">
            <span className="dash-kpi-label">ACTIVE BOUNTIES</span>
            <span className="dash-kpi-icon-wrap gig-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 20h9" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </div>
          <div className="dash-kpi-number">{activePostsCount}</div>
          <div className="dash-kpi-footer">
            <span className="dash-kpi-sub">
              <strong>{completedPostsCount}</strong> Sessions Completed
            </span>
            <span className="dash-kpi-arrow">&rarr;</span>
          </div>
        </div>

        {/* KPI 3: Escrow Liquidity */}
        <div className="dash-kpi-card" onClick={() => navigate('/admin/disputes')} role="button" tabIndex={0}>
          <div className="dash-kpi-top">
            <span className="dash-kpi-label">ESCROW CIRCULATION</span>
            <span className="dash-kpi-icon-wrap escrow-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="4" width="20" height="16" rx="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2 10h20" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </div>
          <div className="dash-kpi-number">৳ {Math.round(totalWallet).toLocaleString()}</div>
          <div className="dash-kpi-footer">
            <span className="dash-kpi-sub">
              <strong>৳ {Math.round(totalBountyEscrow).toLocaleString()}</strong> in active gigs
            </span>
            <span className="dash-kpi-arrow">&rarr;</span>
          </div>
        </div>

        {/* KPI 4: Governance & Attention */}
        <div className={`dash-kpi-card ${totalActionItems > 0 ? 'kpi-attention' : 'kpi-clean'}`} onClick={() => navigate(pendingTeacherApps.length > 0 ? '/admin/teacher-applications' : pendingDisputes.length > 0 ? '/admin/disputes' : '/admin/reports')} role="button" tabIndex={0}>
          <div className="dash-kpi-top">
            <span className="dash-kpi-label">ACTION QUEUE</span>
            <span className={`dash-kpi-icon-wrap ${totalActionItems > 0 ? 'alert-icon' : 'safe-icon'}`}>
              {totalActionItems > 0 ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round" />
                  <line x1="12" y1="8" x2="12" y2="12" strokeLinecap="round" strokeLinejoin="round" />
                  <line x1="12" y1="16" x2="12.01" y2="16" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" strokeLinecap="round" strokeLinejoin="round" />
                  <polyline points="22 4 12 14.01 9 11.01" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
          </div>
          <div className="dash-kpi-number">{totalActionItems}</div>
          <div className="dash-kpi-footer">
            <span className="dash-kpi-sub">
              {totalActionItems > 0 ? `${totalActionItems} Pending Admin Reviews` : 'All Queues Clear & Healthy'}
            </span>
            <span className="dash-kpi-arrow">&rarr;</span>
          </div>
        </div>
      </section>

      {/* ─── Operational Queues (Action Center) ─── */}
      <section className="dash-section">
        <div className="dash-section-header">
          <div className="dash-section-title-wrap">
            <h2 className="dash-section-title">Operational Attention Center</h2>
            <span className="dash-section-hint">High priority tasks requiring admin review and resolution</span>
          </div>
          <span className="dash-status-pill">
            {totalActionItems > 0 ? (
              <span className="badge-warning">{totalActionItems} Items Pending</span>
            ) : (
              <span className="badge-success">0 Issues Pending</span>
            )}
          </span>
        </div>

        <div className="dash-action-cards">
          {/* Action Card 1: Teacher Applications */}
          <div className="dash-action-card">
            <div className="dash-action-card-header">
              <div className="dash-action-title-group">
                <span className="dash-action-icon tutor-app">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M6 12v5c3 3 9 3 12 0v-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <div>
                  <h3 className="dash-action-heading">Teacher Applications</h3>
                  <p className="dash-action-desc">Peer tutor ID & verification reviews</p>
                </div>
              </div>
              <span className={`dash-count-badge ${pendingTeacherApps.length > 0 ? 'pending' : 'clear'}`}>
                {pendingTeacherApps.length} pending
              </span>
            </div>

            <div className="dash-action-card-body">
              <div className="dash-stat-row">
                <span>Total Applications Submitted:</span>
                <strong>{teacherApps.length}</strong>
              </div>
              <div className="dash-stat-row">
                <span>Approved Peer Tutors:</span>
                <strong className="text-success">{teacherApps.filter(a => a.status === 'approved').length}</strong>
              </div>
              <div className="dash-stat-row">
                <span>Pending Review:</span>
                <strong className={pendingTeacherApps.length > 0 ? 'text-warning' : ''}>
                  {pendingTeacherApps.length}
                </strong>
              </div>
            </div>

            <div className="dash-action-card-footer">
              <button
                className="dash-action-btn"
                onClick={() => navigate('/admin/teacher-applications')}
              >
                {pendingTeacherApps.length > 0 ? 'Review Applications' : 'View Teacher Logs'} &rarr;
              </button>
            </div>
          </div>

          {/* Action Card 2: Escrow Disputes */}
          <div className="dash-action-card">
            <div className="dash-action-card-header">
              <div className="dash-action-title-group">
                <span className="dash-action-icon dispute">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round" />
                    <line x1="12" y1="8" x2="12" y2="12" strokeLinecap="round" strokeLinejoin="round" />
                    <line x1="12" y1="16" x2="12.01" y2="16" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <div>
                  <h3 className="dash-action-heading">Disputes &amp; Escrow</h3>
                  <p className="dash-action-desc">Bounty arbitration & session disputes</p>
                </div>
              </div>
              <span className={`dash-count-badge ${pendingDisputes.length > 0 ? 'danger' : 'clear'}`}>
                {pendingDisputes.length} active
              </span>
            </div>

            <div className="dash-action-card-body">
              <div className="dash-stat-row">
                <span>Total Disputes Recorded:</span>
                <strong>{disputes.length}</strong>
              </div>
              <div className="dash-stat-row">
                <span>Resolved &amp; Settled:</span>
                <strong className="text-success">{disputes.filter(d => d.status === 'resolved' || d.status === 'refunded').length}</strong>
              </div>
              <div className="dash-stat-row">
                <span>Awaiting Arbitration:</span>
                <strong className={pendingDisputes.length > 0 ? 'text-danger' : ''}>
                  {pendingDisputes.length}
                </strong>
              </div>
            </div>

            <div className="dash-action-card-footer">
              <button
                className="dash-action-btn"
                onClick={() => navigate('/admin/disputes')}
              >
                {pendingDisputes.length > 0 ? 'Resolve Disputes' : 'View Escrow Audit'} &rarr;
              </button>
            </div>
          </div>

          {/* Action Card 3: Content Moderation */}
          <div className="dash-action-card">
            <div className="dash-action-card-header">
              <div className="dash-action-title-group">
                <span className="dash-action-icon report">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" strokeLinecap="round" strokeLinejoin="round" />
                    <line x1="4" y1="22" x2="4" y2="15" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <div>
                  <h3 className="dash-action-heading">Report Queue</h3>
                  <p className="dash-action-desc">Flagged user content & posts</p>
                </div>
              </div>
              <span className={`dash-count-badge ${pendingReports.length > 0 ? 'warning' : 'clear'}`}>
                {pendingReports.length} flagged
              </span>
            </div>

            <div className="dash-action-card-body">
              <div className="dash-stat-row">
                <span>Total User Flags:</span>
                <strong>{reports.length}</strong>
              </div>
              <div className="dash-stat-row">
                <span>Addressed / Dismissed:</span>
                <strong className="text-success">{reports.filter(r => r.status === 'resolved' || r.status === 'dismissed').length}</strong>
              </div>
              <div className="dash-stat-row">
                <span>Needs Review:</span>
                <strong className={pendingReports.length > 0 ? 'text-warning' : ''}>
                  {pendingReports.length}
                </strong>
              </div>
            </div>

            <div className="dash-action-card-footer">
              <button
                className="dash-action-btn"
                onClick={() => navigate('/admin/reports')}
              >
                {pendingReports.length > 0 ? 'Moderate Reports' : 'View Report Log'} &rarr;
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Two-Column Operations Layout ─── */}
      <div className="dash-two-col">
        {/* Left Col: Recent Tutoring Requests */}
        <div className="dash-col-main">
          <div className="dash-card">
            <div className="dash-card-header">
              <div>
                <h3 className="dash-card-title">Recent Tutoring Bounties</h3>
                <span className="dash-card-subtitle">Latest peer learning requests posted by students</span>
              </div>
              <button className="dash-text-link" onClick={() => navigate('/admin/moderation')}>
                View all in Moderation &rarr;
              </button>
            </div>

            {posts.length === 0 ? (
              <div className="dash-empty">No tutoring posts recorded.</div>
            ) : (
              <div className="dash-recent-list">
                {posts.slice(0, 5).map(p => {
                  const isCompleted = p.status === 'completed' || p.is_completed;
                  return (
                    <div key={p.post_id} className="dash-recent-item">
                      <div className="dash-recent-left">
                        <div className="dash-recent-meta">
                          {p.course_code && <span className="dash-code-badge">{p.course_code}</span>}
                          <span className="dash-cat-tag">{p.category}</span>
                          {p.is_urgent ? <span className="dash-urgent-badge">High Urgency</span> : null}
                        </div>
                        <h4 className="dash-recent-title">{p.title}</h4>
                        <div className="dash-recent-author">
                          <span>Posted by <strong>{p.author_name || 'Student'}</strong></span>
                          {p.created_at && (
                            <span className="dash-recent-time">
                              &bull; {new Date(p.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                          <span className="dash-recent-format">&bull; {getDeliveryLabel(p.delivery_format)}</span>
                        </div>
                      </div>

                      <div className="dash-recent-right">
                        <span className="dash-bounty-badge">৳ {p.bounty}</span>
                        <span className={`dash-status-pill-sm ${isCompleted ? 'status-completed' : p.status === 'closed' ? 'status-closed' : 'status-active'}`}>
                          {isCompleted ? 'Completed' : p.status === 'closed' ? 'Closed' : 'Active'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Category Distribution & Quick Links */}
        <div className="dash-col-side">
          {/* Category Distribution */}
          <div className="dash-card">
            <div className="dash-card-header">
              <div>
                <h3 className="dash-card-title">Subject Demand</h3>
                <span className="dash-card-subtitle">Real-time demand across 3 academic categories</span>
              </div>
              <span className="dash-demand-pill">{posts.length} Total Posts</span>
            </div>

            <div className="dash-cat-breakdown">
              {categoryStats.map(cat => (
                <div key={cat.id} className="dash-cat-card">
                  <div className="dash-cat-header-row">
                    <div className="dash-cat-identity">
                      <span
                        className="dash-cat-badge"
                        style={{
                          backgroundColor: cat.bgSoft,
                          color: cat.color,
                          borderColor: cat.borderSoft
                        }}
                      >
                        {cat.shortCode}
                      </span>
                      <div className="dash-cat-names">
                        <span className="dash-cat-name">{cat.name}</span>
                        <span className="dash-cat-sublevel">{cat.level}</span>
                      </div>
                    </div>
                    <div className="dash-cat-metrics-right">
                      <span className="dash-cat-count-bold">
                        {cat.count} <span className="dash-cat-count-unit">posts</span>
                      </span>
                      <span
                        className="dash-cat-pct-chip"
                        style={{
                          backgroundColor: cat.bgSoft,
                          color: cat.color
                        }}
                      >
                        {cat.percent}%
                      </span>
                    </div>
                  </div>

                  {/* Dynamic Progress Bar */}
                  <div
                    className="dash-cat-bar-bg"
                    role="progressbar"
                    aria-label={`${cat.name} demand`}
                    aria-valuenow={cat.percent}
                    aria-valuemin="0"
                    aria-valuemax="100"
                  >
                    <div
                      className="dash-cat-bar-fill"
                      style={{
                        width: cat.count > 0 ? `${Math.max(cat.percent, 4)}%` : '0%',
                        background: cat.gradient,
                        boxShadow: cat.count > 0 ? cat.shadow : 'none'
                      }}
                    ></div>
                  </div>

                  <div className="dash-cat-footer-row">
                    <span className="dash-cat-stat">
                      <span className="dash-cat-dot" style={{ backgroundColor: cat.color }}></span>
                      {cat.activeCount} Active · {cat.completedCount} Completed
                    </span>
                    <span className="dash-cat-bounty">
                      ৳{cat.bounty.toLocaleString()} Escrow
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Demand Summary Footer */}
            {leadingCategory && posts.length > 0 && (
              <div className="dash-cat-summary-strip">
                <div className="dash-cat-summary-item">
                  <span className="dash-cat-summary-label">Highest Demand</span>
                  <span className="dash-cat-summary-val" style={{ color: leadingCategory.color }}>
                    {leadingCategory.name} ({leadingCategory.percent}%)
                  </span>
                </div>
                <div className="dash-cat-summary-item" style={{ textAlign: 'right' }}>
                  <span className="dash-cat-summary-label">Category Escrow</span>
                  <span className="dash-cat-summary-val">
                    ৳{categoryStats.reduce((sum, c) => sum + c.bounty, 0).toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Quick Management Shortcuts */}
          <div className="dash-card">
            <div className="dash-card-header">
              <h3 className="dash-card-title">Quick Administration</h3>
              <span className="dash-card-subtitle">Direct shortcuts to management sub-panels</span>
            </div>

            <div className="dash-shortcuts-grid">
              <button className="dash-shortcut-btn" onClick={() => navigate('/admin/users')}>
                <span className="dash-shortcut-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="9" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span>User Accounts</span>
              </button>

              <button className="dash-shortcut-btn" onClick={() => navigate('/admin/teacher-applications')}>
                <span className="dash-shortcut-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span>Teacher Apps</span>
              </button>

              <button className="dash-shortcut-btn" onClick={() => navigate('/admin/disputes')}>
                <span className="dash-shortcut-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round" />
                    <line x1="12" y1="8" x2="12" y2="12" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span>Escrow Disputes</span>
              </button>

              <button className="dash-shortcut-btn" onClick={() => navigate('/admin/moderation')}>
                <span className="dash-shortcut-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span>Content Moderation</span>
              </button>
            </div>
          </div>

          {/* System Health Info */}
          <div className="dash-system-card">
            <div className="dash-sys-row">
              <span className="dash-sys-label">API Server</span>
              <span className="dash-sys-val text-success">&bull; Online (Port 3001)</span>
            </div>
            <div className="dash-sys-row">
              <span className="dash-sys-label">Database</span>
              <span className="dash-sys-val">&bull; MySQL Connected</span>
            </div>
            <div className="dash-sys-row">
              <span className="dash-sys-label">Platform Version</span>
              <span className="dash-sys-val">MicroTeach v2.4</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
