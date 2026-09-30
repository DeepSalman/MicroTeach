import React, { useState, useEffect, useMemo } from 'react';
import { fetchTeacherApplications, reviewTeacherApplication } from './api';
import './TeacherApplications.css';

const BASE_URL =
  import.meta.env.VITE_SERVER_URL ||
  (import.meta.env.PROD ? '' : 'http://localhost:3001');

const TeacherApplications = ({ user }) => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [statusTab, setStatusTab] = useState('all'); // 'all' | 'pending' | 'approved' | 'rejected'
  const [deptFilter, setDeptFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'oldest' | 'name'
  const [searchQuery, setSearchQuery] = useState('');

  // Expandable row state (single active ID)
  const [expandedId, setExpandedId] = useState(null);

  // Action states
  const [actionLoading, setActionLoading] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null); // { url, label }
  const [feedback, setFeedback] = useState(null); // { type, message }

  useEffect(() => {
    loadApplications();
  }, []);

  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  const loadApplications = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const response = await fetchTeacherApplications();
      setApplications(response.data || []);
    } catch (err) {
      console.error('Failed to load applications:', err);
      setFeedback({ type: 'error', message: 'Failed to load teacher applications.' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleReview = async (applicationId, status) => {
    setActionLoading(applicationId);
    setFeedback(null);
    try {
      await reviewTeacherApplication(applicationId, {
        status,
        reviewed_by: user.user_id
      });
      setApplications(prev =>
        prev.map(app =>
          app.application_id === applicationId
            ? { ...app, status, reviewed_at: new Date().toISOString() }
            : app
        )
      );
      setFeedback({
        type: 'success',
        message: `Application #APP-${String(applicationId).padStart(4, '0')} has been ${status.toUpperCase()}.`
      });
    } catch (err) {
      console.error('Failed to review application:', err);
      const raw = err.response?.data?.message || err.response?.data?.error || err.message;
      const msg = typeof raw === 'string'
        ? raw
        : (raw?.message || (raw && typeof raw === 'object' ? JSON.stringify(raw) : null) || 'Failed to update application.');
      setFeedback({
        type: 'error',
        message: msg
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Metrics
  const pendingCount = useMemo(() => applications.filter(a => a.status === 'pending').length, [applications]);
  const approvedCount = useMemo(() => applications.filter(a => a.status === 'approved').length, [applications]);
  const rejectedCount = useMemo(() => applications.filter(a => a.status === 'rejected').length, [applications]);

  const departments = useMemo(() => {
    const set = new Set();
    applications.forEach(a => {
      if (a.department) set.add(a.department);
    });
    return Array.from(set);
  }, [applications]);

  const tabs = [
    { key: 'all', label: 'All', count: applications.length },
    { key: 'pending', label: 'Pending', count: pendingCount },
    { key: 'approved', label: 'Approved', count: approvedCount },
    { key: 'rejected', label: 'Rejected', count: rejectedCount }
  ];

  // Filter & Search Logic
  const filteredApps = useMemo(() => {
    return applications.filter(app => {
      if (statusTab !== 'all' && app.status !== statusTab) return false;
      if (deptFilter !== 'all' && app.department !== deptFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const rawId = String(app.application_id);
        const name = (app.full_name || '').toLowerCase();
        const email = (app.email || '').toLowerCase();
        const stuId = String(app.user_student_id || app.student_id || '').toLowerCase();
        const dept = (app.department || '').toLowerCase();
        const expertise = (app.expertise || '').toLowerCase();
        const reason = (app.reason || '').toLowerCase();

        if (
          rawId !== q &&
          !name.includes(q) &&
          !email.includes(q) &&
          !stuId.includes(q) &&
          !dept.includes(q) &&
          !expertise.includes(q) &&
          !reason.includes(q)
        ) {
          return false;
        }
      }
      return true;
    }).sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.created_at) - new Date(a.created_at);
      if (sortBy === 'oldest') return new Date(a.created_at) - new Date(b.created_at);
      if (sortBy === 'name') return (a.full_name || '').localeCompare(b.full_name || '');
      return 0;
    });
  }, [applications, statusTab, deptFilter, sortBy, searchQuery]);

  const hasActiveFilters = statusTab !== 'all' || deptFilter !== 'all' || searchQuery.trim() !== '';

  const resetFilters = () => {
    setStatusTab('all');
    setDeptFilter('all');
    setSortBy('newest');
    setSearchQuery('');
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const formatFullDate = (dateStr) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
      ' at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const parseExpertise = (expertise) => {
    if (!expertise) return [];
    return expertise.split(',').map(s => s.trim()).filter(Boolean);
  };

  const docLabel = (type) => {
    if (type === 'student_id_card') return 'Student ID Card';
    if (type === 'nid_card') return 'National ID (NID)';
    return type;
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'approved': return 'Approved';
      case 'rejected': return 'Rejected';
      default: return status;
    }
  };

  return (
    <div className="admin-content ta-minimal">
      {/* ── Header & Inline Stats ── */}
      <div className="ta-min-header">
        <div className="ta-min-title-group">
          <h1 className="ta-min-title">Teacher Applications</h1>
          <div className="ta-min-stats-strip">
            <span className="ta-stat-pill">
              Total: <strong>{applications.length}</strong>
            </span>
            <span className="ta-stat-sep">&bull;</span>
            <span className="ta-stat-pill">
              Pending: <strong>{pendingCount}</strong>
            </span>
            <span className="ta-stat-sep">&bull;</span>
            <span className="ta-stat-pill">
              Approved: <strong>{approvedCount}</strong>
            </span>
            <span className="ta-stat-sep">&bull;</span>
            <span className="ta-stat-pill">
              Rejected: <strong>{rejectedCount}</strong>
            </span>
          </div>
        </div>

        <button
          className={`ta-min-btn ${refreshing ? 'loading' : ''}`}
          onClick={() => loadApplications(true)}
          disabled={refreshing}
          title="Refresh Applications"
        >
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* ── Toast Feedback ── */}
      {feedback && (
        <div className={`ta-min-toast ${feedback.type}`}>
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)}>&times;</button>
        </div>
      )}

      {/* ── Filter Controls Bar ── */}
      <div className="ta-min-filters">
        {/* Status Tabs */}
        <div className="ta-min-tabs">
          {tabs.map(tab => (
            <button
              key={tab.key}
              className={`ta-min-tab ${statusTab === tab.key ? 'active' : ''}`}
              onClick={() => setStatusTab(tab.key)}
            >
              {tab.label}
              <span className="ta-tab-num">{tab.count}</span>
            </button>
          ))}
        </div>

        {/* Inputs */}
        <div className="ta-min-filter-inputs">
          <div className="ta-min-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search applicant, ID, course..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="ta-min-clear" onClick={() => setSearchQuery('')}>&times;</button>
            )}
          </div>

          <select
            className="ta-min-select"
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
          >
            <option value="all">All Departments</option>
            {departments.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          <select
            className="ta-min-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="name">Name (A-Z)</option>
          </select>

          {hasActiveFilters && (
            <button className="ta-min-reset" onClick={resetFilters}>Reset</button>
          )}
        </div>
      </div>

      {/* ── Compact Table ── */}
      <div className="ta-table-wrap">
        <table className="ta-table">
          <thead>
            <tr>
              <th style={{ width: '85px' }}>ID</th>
              <th>Applicant</th>
              <th>Department</th>
              <th>Role</th>
              <th>Expertise</th>
              <th style={{ width: '90px' }}>Documents</th>
              <th style={{ width: '95px' }}>Status</th>
              <th style={{ width: '75px' }}>Date</th>
              <th style={{ width: '80px', textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="9" className="ta-empty-td">Loading teacher applications...</td>
              </tr>
            ) : filteredApps.length === 0 ? (
              <tr>
                <td colSpan="9" className="ta-empty-td">No applications matching filter criteria.</td>
              </tr>
            ) : (
              filteredApps.map(app => {
                const isExpanded = expandedId === app.application_id;
                const isPending = app.status === 'pending';
                const skills = parseExpertise(app.expertise);
                const docsCount = app.documents ? app.documents.length : 0;
                const stuId = app.user_student_id || app.student_id;

                return (
                  <React.Fragment key={app.application_id}>
                    <tr
                      className={`ta-row ${isExpanded ? 'expanded' : ''} status-${app.status}`}
                      onClick={() => setExpandedId(isExpanded ? null : app.application_id)}
                    >
                      <td className="ta-td-id">#APP-{String(app.application_id).padStart(4, '0')}</td>
                      <td className="ta-td-applicant">
                        <span className="ta-applicant-name">{app.full_name}</span>
                        {stuId && <span className="ta-id-pill">#{stuId}</span>}
                      </td>
                      <td className="ta-td-dept">
                        <span className="ta-dept-text" title={app.department}>{app.department || '—'}</span>
                      </td>
                      <td className="ta-td-role">
                        <span className="ta-role-tag">{app.role || 'student'}</span>
                      </td>
                      <td className="ta-td-expertise">
                        {skills.length > 0 ? (
                          <div className="ta-skill-chips">
                            {skills.slice(0, 2).map((s, idx) => (
                              <span key={idx} className="ta-skill-chip">{s}</span>
                            ))}
                            {skills.length > 2 && (
                              <span className="ta-skill-more">+{skills.length - 2}</span>
                            )}
                          </div>
                        ) : (
                          <span className="ta-muted-dash">—</span>
                        )}
                      </td>
                      <td className="ta-td-docs">
                        {docsCount > 0 ? (
                          <span className="ta-docs-badge">📄 {docsCount} File{docsCount !== 1 ? 's' : ''}</span>
                        ) : (
                          <span className="ta-muted-dash">None</span>
                        )}
                      </td>
                      <td className="ta-td-status">
                        <span className={`ta-pill ${app.status}`}>
                          {getStatusLabel(app.status)}
                        </span>
                      </td>
                      <td className="ta-td-date">{formatDate(app.created_at)}</td>
                      <td className="ta-td-action" style={{ textAlign: 'right' }}>
                        <button
                          className={`ta-expand-btn ${isExpanded ? 'active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedId(isExpanded ? null : app.application_id);
                          }}
                        >
                          {isExpanded ? 'Close' : isPending ? 'Review' : 'Details'}
                        </button>
                      </td>
                    </tr>

                    {/* Inline Expandable Drawer (Noticeable Key Details) */}
                    {isExpanded && (
                      <tr className="ta-detail-row">
                        <td colSpan="9">
                          <div className="ta-detail-panel">
                            {/* Top Summary Ribbon */}
                            <div className="ta-detail-banner">
                              <div className="ta-banner-left">
                                <span className="ta-banner-id">#APP-{String(app.application_id).padStart(4, '0')}</span>
                                <span className="ta-banner-name">{app.full_name}</span>
                                {stuId && <span className="ta-banner-stuid">ID #{stuId}</span>}
                                <span className="ta-banner-role-req">Applying: {app.role} &rarr; Tutor</span>
                              </div>
                              <div className="ta-banner-right">
                                <span className={`ta-pill ${app.status}`}>
                                  {getStatusLabel(app.status)}
                                </span>
                              </div>
                            </div>

                            <div className="ta-detail-grid">
                              {/* Left Column: Facts, Statements & Documents */}
                              <div className="ta-detail-facts">
                                {/* Application Motivation Quote */}
                                <div className="ta-quote-box">
                                  <span className="ta-quote-label">APPLICATION MOTIVATION &amp; REASON</span>
                                  <blockquote className="ta-quote-body">
                                    "{app.reason || 'No statement provided.'}"
                                  </blockquote>
                                </div>

                                {/* Skills & Expertise */}
                                {skills.length > 0 && (
                                  <div className="ta-skills-block">
                                    <span className="ta-block-label">DECLARED EXPERTISE &amp; COURSES</span>
                                    <div className="ta-full-skills-wrap">
                                      {skills.map((skill, idx) => (
                                        <span key={idx} className="ta-badge-skill">{skill}</span>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Uploaded Verification Documents */}
                                <div className="ta-docs-block">
                                  <span className="ta-block-label">IDENTITY &amp; VERIFICATION DOCUMENTS</span>
                                  {docsCount > 0 ? (
                                    <div className="ta-docs-grid">
                                      {app.documents.map((doc) => (
                                        <button
                                          key={doc.document_id}
                                          type="button"
                                          className="ta-doc-item-btn"
                                          onClick={() => setPreviewDoc({
                                            url: `${BASE_URL}/${doc.file_path}`,
                                            label: docLabel(doc.document_type)
                                          })}
                                          title={`Click to view ${docLabel(doc.document_type)}`}
                                        >
                                          <div className="ta-doc-preview-thumb">
                                            <img
                                              src={`${BASE_URL}/${doc.file_path}`}
                                              alt={docLabel(doc.document_type)}
                                              onError={(e) => { e.target.style.display = 'none'; }}
                                            />
                                          </div>
                                          <div className="ta-doc-meta">
                                            <span className="ta-doc-name">{docLabel(doc.document_type)}</span>
                                            <span className="ta-doc-zoom">🔍 View Full Size</span>
                                          </div>
                                        </button>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="ta-no-docs-card">
                                      <span>⚠️ No verification documents were uploaded with this application.</span>
                                    </div>
                                  )}
                                </div>

                                {/* Applicant Identity Card */}
                                <div className="ta-identity-box">
                                  <div className="ta-identity-row">
                                    <span>Department: <strong>{app.department || '—'}</strong></span>
                                    <span>Campus Email: <strong>{app.email}</strong></span>
                                  </div>
                                  <div className="ta-identity-row">
                                    <span>Current Role: <strong>{app.role}</strong></span>
                                    <span>Submitted: <strong>{formatFullDate(app.created_at)}</strong></span>
                                  </div>
                                </div>
                              </div>

                              {/* Right Column: Review Action Console */}
                              <div className="ta-detail-action-side">
                                {isPending ? (
                                  <div className="ta-action-console">
                                    <div className="ta-console-header">
                                      <span className="ta-console-title">REVIEW &amp; ADJUDICATION</span>
                                      <span className="ta-console-sub">Admit this student as an accredited peer tutor</span>
                                    </div>

                                    <div className="ta-guidance-card">
                                      <p>
                                        Approving will immediately upgrade <strong>{app.full_name}</strong> to tutor status, verify their account, and enable them to accept and tutor peer micro-tutoring gigs.
                                      </p>
                                    </div>

                                    <div className="ta-decision-actions">
                                      <button
                                        type="button"
                                        className="ta-btn-approve"
                                        disabled={actionLoading === app.application_id}
                                        onClick={() => handleReview(app.application_id, 'approved')}
                                      >
                                        {actionLoading === app.application_id ? 'Approving...' : '✓ Approve as Teacher'}
                                      </button>
                                      <button
                                        type="button"
                                        className="ta-btn-reject"
                                        disabled={actionLoading === app.application_id}
                                        onClick={() => handleReview(app.application_id, 'rejected')}
                                      >
                                        {actionLoading === app.application_id ? 'Rejecting...' : '✕ Reject Application'}
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className={`ta-decision-receipt ${app.status}`}>
                                    <div className="ta-receipt-top">
                                      <div>
                                        <span className="ta-receipt-status-label">
                                          {app.status === 'approved' ? '✅ Application Approved' : '✕ Application Rejected'}
                                        </span>
                                        <h4 className="ta-receipt-heading">Status: {getStatusLabel(app.status)}</h4>
                                      </div>
                                    </div>
                                    <div className="ta-receipt-meta">
                                      <span>Reviewed on {formatFullDate(app.reviewed_at)}</span>
                                    </div>
                                    <div className="ta-receipt-notice">
                                      {app.status === 'approved'
                                        ? 'User role was updated to tutor and can accept tutoring sessions.'
                                        : 'Applicant was notified of this decision.'}
                                    </div>
                                  </div>
                                )}
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
      </div>

      {/* ── Document Lightbox Modal ── */}
      {previewDoc && (
        <div className="ta-modal-overlay" onClick={() => setPreviewDoc(null)}>
          <div className="ta-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="ta-modal-header">
              <span className="ta-modal-title">{previewDoc.label}</span>
              <button className="ta-modal-close" onClick={() => setPreviewDoc(null)}>&times;</button>
            </div>
            <div className="ta-modal-body">
              <img src={previewDoc.url} alt={previewDoc.label} className="ta-modal-img" />
            </div>
            <div className="ta-modal-footer">
              <a href={previewDoc.url} target="_blank" rel="noreferrer" className="ta-modal-download-btn">
                ⬇ Open Full Size &nearr;
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherApplications;
