import React, { useState, useEffect, useMemo } from 'react';
import {
  fetchReports,
  updateReportStatus,
  takedownReportedPost,
  batchUpdateReportStatus
} from './api';
import ChatModal from './ChatModal';
import './ReportQueue.css';

const REASON_META = {
  fraud: { label: 'Fraud / Scam', className: 'rq-badge-fraud' },
  harassment: { label: 'Harassment', className: 'rq-badge-harass' },
  academic_dishonesty: { label: 'Academic Dishonesty', className: 'rq-badge-academic' },
  inappropriate: { label: 'Inappropriate', className: 'rq-badge-inappropriate' },
  spam: { label: 'Spam', className: 'rq-badge-spam' },
  other: { label: 'Other', className: 'rq-badge-other' }
};

const ReportQueue = ({ user }) => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters & Search
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'pending' | 'reviewed' | 'dismissed'
  const [reasonFilter, setReasonFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'oldest'
  const [searchQuery, setSearchQuery] = useState('');

  // Expandable inspection drawer (single row active)
  const [expandedId, setExpandedId] = useState(null);

  // Multi-select & Batch
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Interactive notes & loading
  const [adminNotes, setAdminNotes] = useState({});
  const [actionLoading, setActionLoading] = useState(null);
  const [takedownTarget, setTakedownTarget] = useState(null); // report to takedown
  const [takedownNote, setTakedownNote] = useState('');
  const [feedback, setFeedback] = useState(null);

  // Chat integration
  const [chatUser, setChatUser] = useState(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    loadReports();
  }, []);

  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  const loadReports = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetchReports();
      const data = res.data || [];
      setReports(data);

      const initNotes = {};
      data.forEach(r => {
        if (r.admin_notes) initNotes[r.report_id] = r.admin_notes;
      });
      setAdminNotes(prev => ({ ...initNotes, ...prev }));
    } catch (err) {
      console.error('Failed to load reports:', err);
      setFeedback({ type: 'error', message: 'Failed to fetch moderation reports.' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getReasonInfo = (reason) => {
    return REASON_META[reason] || { label: reason || 'General', className: 'rq-badge-other' };
  };

  // Status changes
  const handleStatusChange = async (reportId, newStatus, customNotes = null) => {
    setActionLoading(reportId);
    setFeedback(null);
    try {
      const notes = customNotes !== null ? customNotes : (adminNotes[reportId] || '');
      await updateReportStatus(reportId, newStatus, {
        admin_notes: notes,
        reviewed_by: user?.user_id
      });

      setReports(prev =>
        prev.map(r =>
          r.report_id === reportId
            ? {
                ...r,
                status: newStatus,
                admin_notes: notes,
                action_taken: newStatus === 'dismissed' ? 'dismissed' : 'reviewed',
                reviewed_at: newStatus === 'pending' ? null : new Date().toISOString()
              }
            : r
        )
      );

      setFeedback({
        type: 'success',
        message: `Report #${reportId} marked as ${newStatus}.`
      });
    } catch (err) {
      console.error('Failed to update status:', err);
      const raw = err.response?.data?.message || err.response?.data?.error || err.message;
      setFeedback({
        type: 'error',
        message: typeof raw === 'string' ? raw : 'Failed to update report status.'
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Administrative post takedown
  const handleConfirmTakedown = async () => {
    if (!takedownTarget) return;
    const reportId = takedownTarget.report_id;
    const notes = takedownNote || adminNotes[reportId] || 'Post taken down for policy infraction.';

    setActionLoading(reportId);
    setFeedback(null);
    try {
      const res = await takedownReportedPost(reportId, {
        admin_notes: notes,
        reviewed_by: user?.user_id
      });

      setReports(prev =>
        prev.map(r =>
          r.report_id === reportId
            ? {
                ...r,
                status: 'reviewed',
                action_taken: 'post_takedown',
                admin_notes: notes,
                post_status: 'closed',
                reviewed_at: new Date().toISOString()
              }
            : r
        )
      );

      setFeedback({
        type: 'success',
        message: res.data?.message || `Post #${takedownTarget.post_id} removed & report resolved.`
      });
      setTakedownTarget(null);
      setTakedownNote('');
    } catch (err) {
      console.error('Failed to take down post:', err);
      const raw = err.response?.data?.message || err.response?.data?.error || err.message;
      setFeedback({
        type: 'error',
        message: typeof raw === 'string' ? raw : 'Failed to process post takedown.'
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Bulk status update
  const handleBulkStatus = async (status) => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    setActionLoading('bulk');
    setFeedback(null);

    try {
      await batchUpdateReportStatus({
        report_ids: ids,
        status,
        reviewed_by: user?.user_id,
        admin_notes: `Bulk action: ${status}`
      });

      setReports(prev =>
        prev.map(r =>
          selectedIds.has(r.report_id)
            ? {
                ...r,
                status,
                action_taken: status === 'dismissed' ? 'dismiss' : 'review',
                reviewed_at: new Date().toISOString()
              }
            : r
        )
      );

      setFeedback({
        type: 'success',
        message: `Marked ${ids.length} reports as ${status}.`
      });
      setSelectedIds(new Set());
    } catch (err) {
      console.error('Bulk update error:', err);
      setFeedback({ type: 'error', message: 'Failed to execute bulk update.' });
    } finally {
      setActionLoading(null);
    }
  };

  // Multi-select handlers
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const allVisible = new Set(paginatedReports.map(r => r.report_id));
      setSelectedIds(allVisible);
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleToggleSelect = (reportId) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(reportId)) next.delete(reportId);
      else next.add(reportId);
      return next;
    });
  };

  // Export CSV
  const exportReportsCSV = () => {
    if (filteredReports.length === 0) {
      setFeedback({ type: 'error', message: 'No reports to export.' });
      return;
    }

    const headers = [
      'Report ID',
      'Status',
      'Reason',
      'Post ID',
      'Post Title',
      'Course',
      'Bounty',
      'Author',
      'Reporter',
      'Reporter Note',
      'Admin Notes',
      'Action Taken',
      'Created At'
    ];

    const rows = filteredReports.map(r => [
      r.report_id,
      r.status,
      `"${(r.reason || '').replace(/"/g, '""')}"`,
      r.post_id,
      `"${(r.post_title || '').replace(/"/g, '""')}"`,
      r.course_code || '',
      r.bounty || 0,
      `"${(r.post_author_name || '').replace(/"/g, '""')}"`,
      `"${(r.reporter_name || '').replace(/"/g, '""')}"`,
      `"${(r.description || '').replace(/"/g, '""')}"`,
      `"${(r.admin_notes || '').replace(/"/g, '""')}"`,
      r.action_taken || '',
      r.created_at || ''
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `microteach_reports_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Filtered & Sorted Reports
  const filteredReports = useMemo(() => {
    return reports
      .filter(r => {
        if (filterTab !== 'all' && r.status !== filterTab) return false;
        if (reasonFilter !== 'all' && r.reason !== reasonFilter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchTitle = (r.post_title || '').toLowerCase().includes(q);
          const matchCourse = (r.course_code || '').toLowerCase().includes(q);
          const matchAuthor = (r.post_author_name || '').toLowerCase().includes(q);
          const matchReporter = (r.reporter_name || '').toLowerCase().includes(q);
          const matchReason = (r.reason || '').toLowerCase().includes(q);
          const matchId = String(r.report_id).includes(q) || String(r.post_id).includes(q);
          if (!matchTitle && !matchCourse && !matchAuthor && !matchReporter && !matchReason && !matchId) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'oldest') {
          return new Date(a.created_at) - new Date(b.created_at);
        }
        return new Date(b.created_at) - new Date(a.created_at);
      });
  }, [reports, filterTab, reasonFilter, searchQuery, sortBy]);

  // Statistics
  const counts = useMemo(() => {
    return {
      all: reports.length,
      pending: reports.filter(r => r.status === 'pending').length,
      reviewed: reports.filter(r => r.status === 'reviewed').length,
      dismissed: reports.filter(r => r.status === 'dismissed').length
    };
  }, [reports]);

  // Pagination slice
  const totalPages = Math.ceil(filteredReports.length / pageSize) || 1;
  const paginatedReports = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredReports.slice(start, start + pageSize);
  }, [filteredReports, currentPage, pageSize]);

  const hasActiveFilters = filterTab !== 'all' || reasonFilter !== 'all' || sortBy !== 'newest' || searchQuery.trim() !== '';

  const resetFilters = () => {
    setFilterTab('all');
    setReasonFilter('all');
    setSortBy('newest');
    setSearchQuery('');
    setCurrentPage(1);
  };

  const allVisibleSelected =
    paginatedReports.length > 0 && paginatedReports.every(r => selectedIds.has(r.report_id));

  return (
    <div className="rq-page">
      {/* ── Page Header ── */}
      <div className="rq-header">
        <div className="rq-header-title-block">
          <h1 className="rq-title">Report Queue</h1>
          <p className="rq-subtitle">Review, investigate, and resolve user-flagged posts.</p>
        </div>

        <div className="rq-header-actions">
          <button
            type="button"
            className="rq-btn-outline"
            onClick={exportReportsCSV}
            title="Export CSV"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Export</span>
          </button>
          <button
            type="button"
            className={`rq-btn-outline ${refreshing ? 'loading' : ''}`}
            onClick={() => loadReports(true)}
            disabled={refreshing}
            title="Refresh list"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 4v6h-6" />
              <path d="M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* ── Toast Feedback ── */}
      {feedback && (
        <div className={`rq-toast ${feedback.type}`}>
          <span>{feedback.message}</span>
          <button type="button" className="rq-toast-close" onClick={() => setFeedback(null)}>&times;</button>
        </div>
      )}

      {/* ── Filter Bar ── */}
      <div className="rq-filters-card">
        {/* Tabs */}
        <div className="rq-tabs">
          <button
            type="button"
            className={`rq-tab ${filterTab === 'all' ? 'active' : ''}`}
            onClick={() => { setFilterTab('all'); setCurrentPage(1); }}
          >
            All Reports <span className="rq-tab-badge">{counts.all}</span>
          </button>
          <button
            type="button"
            className={`rq-tab ${filterTab === 'pending' ? 'active' : ''}`}
            onClick={() => { setFilterTab('pending'); setCurrentPage(1); }}
          >
            Pending <span className={`rq-tab-badge ${counts.pending > 0 ? 'accent' : ''}`}>{counts.pending}</span>
          </button>
          <button
            type="button"
            className={`rq-tab ${filterTab === 'reviewed' ? 'active' : ''}`}
            onClick={() => { setFilterTab('reviewed'); setCurrentPage(1); }}
          >
            Reviewed <span className="rq-tab-badge">{counts.reviewed}</span>
          </button>
          <button
            type="button"
            className={`rq-tab ${filterTab === 'dismissed' ? 'active' : ''}`}
            onClick={() => { setFilterTab('dismissed'); setCurrentPage(1); }}
          >
            Dismissed <span className="rq-tab-badge">{counts.dismissed}</span>
          </button>
        </div>

        {/* Search & Controls */}
        <div className="rq-controls">
          <div className="rq-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search by post, author, reporter, or ID..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            />
            {searchQuery && (
              <button type="button" className="rq-clear-search" onClick={() => setSearchQuery('')}>&times;</button>
            )}
          </div>

          <div className="rq-selects">
            <select
              value={reasonFilter}
              onChange={(e) => { setReasonFilter(e.target.value); setCurrentPage(1); }}
            >
              <option value="all">All Reasons</option>
              <option value="academic_dishonesty">Academic Dishonesty</option>
              <option value="fraud">Fraud / Scam</option>
              <option value="harassment">Harassment</option>
              <option value="spam">Spam</option>
              <option value="inappropriate">Inappropriate</option>
              <option value="other">Other</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value); setCurrentPage(1); }}
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>

            {hasActiveFilters && (
              <button type="button" className="rq-reset-btn" onClick={resetFilters}>
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Bulk Actions Bar ── */}
      {selectedIds.size > 0 && (
        <div className="rq-bulk-bar">
          <div className="rq-bulk-info">
            <strong>{selectedIds.size}</strong> report{selectedIds.size > 1 ? 's' : ''} selected
          </div>
          <div className="rq-bulk-actions">
            <button
              type="button"
              className="rq-btn-bulk-review"
              onClick={() => handleBulkStatus('reviewed')}
              disabled={actionLoading === 'bulk'}
            >
              Mark Reviewed
            </button>
            <button
              type="button"
              className="rq-btn-bulk-dismiss"
              onClick={() => handleBulkStatus('dismissed')}
              disabled={actionLoading === 'bulk'}
            >
              Dismiss
            </button>
            <button
              type="button"
              className="rq-btn-bulk-clear"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* ── Reports Table ── */}
      <div className="rq-table-card">
        <table className="rq-table">
          <thead>
            <tr>
              <th className="th-cb">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={handleSelectAll}
                  aria-label="Select all"
                />
              </th>
              <th className="th-id">ID</th>
              <th className="th-reason">REASON</th>
              <th className="th-post">REPORTED POST</th>
              <th className="th-author">AUTHOR</th>
              <th className="th-reporter">REPORTER</th>
              <th className="th-date">DATE</th>
              <th className="th-status">STATUS</th>
              <th className="th-action">ACTION</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="9" className="rq-table-loading">
                  Loading reports...
                </td>
              </tr>
            ) : paginatedReports.length === 0 ? (
              <tr>
                <td colSpan="9" className="rq-table-empty">
                  No reports found.
                </td>
              </tr>
            ) : (
              paginatedReports.map((item) => {
                const isExpanded = expandedId === item.report_id;
                const isSelected = selectedIds.has(item.report_id);
                const reasonInfo = getReasonInfo(item.reason);
                const isPostClosed = item.post_status === 'closed';

                return (
                  <React.Fragment key={item.report_id}>
                    <tr
                      className={`rq-row ${isExpanded ? 'expanded' : ''} ${isSelected ? 'selected' : ''}`}
                      onClick={() => setExpandedId(isExpanded ? null : item.report_id)}
                    >
                      <td className="td-cb" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(item.report_id)}
                          aria-label={`Select report #${item.report_id}`}
                        />
                      </td>

                      <td className="td-id">
                        <span className="rq-id-pill">#{item.report_id}</span>
                      </td>

                      <td className="td-reason">
                        <span className={`rq-reason-pill ${reasonInfo.className}`}>
                          {reasonInfo.label}
                        </span>
                      </td>

                      <td className="td-post">
                        <div className="rq-post-cell">
                          <span className="rq-post-title" title={item.post_title}>
                            {item.post_title || 'Untitled Post'}
                          </span>
                          <div className="rq-post-sub">
                            {item.course_code && (
                              <span className="rq-course-tag">{item.course_code}</span>
                            )}
                            {item.bounty > 0 && (
                              <span className="rq-bounty-tag">৳{Number(item.bounty).toLocaleString('en-IN')}</span>
                            )}
                            {isPostClosed && (
                              <span className="rq-closed-tag">Closed</span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="td-author">
                        <div className="rq-user-cell">
                          <span className="rq-user-name" title={item.post_author_name}>
                            {item.post_author_name || 'Unknown'}
                          </span>
                          {item.post_author_department && (
                            <span className="rq-user-dept">{item.post_author_department}</span>
                          )}
                        </div>
                      </td>

                      <td className="td-reporter">
                        <div className="rq-user-cell">
                          <span className="rq-user-name" title={item.reporter_name}>
                            {item.reporter_name || 'Anonymous'}
                          </span>
                          {item.reporter_department && (
                            <span className="rq-user-dept">{item.reporter_department}</span>
                          )}
                        </div>
                      </td>

                      <td className="td-date">
                        <span className="rq-date-text">{formatDate(item.created_at)}</span>
                      </td>

                      <td className="td-status">
                        <span className={`rq-status-pill status-${item.status}`}>
                          {item.action_taken === 'post_takedown' ? 'Taken Down' : item.status}
                        </span>
                      </td>

                      <td className="td-action" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className={`rq-inspect-btn ${isExpanded ? 'active' : ''}`}
                          onClick={() => setExpandedId(isExpanded ? null : item.report_id)}
                          aria-label="Inspect details"
                        >
                          <span>{isExpanded ? 'Close' : 'Inspect'}</span>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`rq-chevron ${isExpanded ? 'rotate' : ''}`}>
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </button>
                      </td>
                    </tr>

                    {/* ── Expanded Inspection Row ── */}
                    {isExpanded && (
                      <tr className="rq-drawer-row">
                        <td colSpan="9" className="rq-drawer-td">
                          <div className="rq-drawer">
                            {/* Left Column: Post & Report Details */}
                            <div className="rq-drawer-col details">
                              {/* Post info */}
                              <div className="rq-detail-group">
                                <div className="rq-detail-group-title">
                                  <span>Reported Listing</span>
                                  <span className="rq-post-id-tag">Post #{item.post_id}</span>
                                </div>

                                <div className="rq-post-overview">
                                  <h4 className="rq-post-heading">{item.post_title}</h4>
                                  <div className="rq-post-meta-strip">
                                    {item.course_code && (
                                      <span className="rq-meta-chip">Course: {item.course_code}</span>
                                    )}
                                    {item.category && (
                                      <span className="rq-meta-chip">Category: {item.category}</span>
                                    )}
                                    <span className="rq-meta-chip">
                                      Bounty: <strong>৳{Number(item.bounty || 0).toLocaleString('en-IN')}</strong>
                                    </span>
                                  </div>

                                  {item.post_description && (
                                    <div className="rq-post-desc">
                                      <p>{item.post_description}</p>
                                    </div>
                                  )}
                                </div>

                                <div className="rq-party-row">
                                  <div className="rq-party-info">
                                    <span className="rq-party-label">Author</span>
                                    <span className="rq-party-name">{item.post_author_name}</span>
                                    <span className="rq-party-sub">
                                      {item.post_author_department || 'Department N/A'}
                                      {item.post_author_student_id && ` • ID: ${item.post_author_student_id}`}
                                    </span>
                                  </div>
                                  {item.post_author_id && (
                                    <button
                                      type="button"
                                      className="rq-btn-chat"
                                      onClick={() => setChatUser({
                                        user_id: item.post_author_id,
                                        full_name: item.post_author_name
                                      })}
                                    >
                                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                      </svg>
                                      <span>Message</span>
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Reporter info */}
                              <div className="rq-detail-group">
                                <div className="rq-detail-group-title">
                                  <span>Reporter's Statement</span>
                                  <span className={`rq-reason-pill ${reasonInfo.className}`}>
                                    {reasonInfo.label}
                                  </span>
                                </div>

                                <div className="rq-testimony-box">
                                  {item.description ? (
                                    <p>{item.description}</p>
                                  ) : (
                                    <span className="rq-empty-text">No additional written note provided by reporter.</span>
                                  )}
                                </div>

                                <div className="rq-party-row">
                                  <div className="rq-party-info">
                                    <span className="rq-party-label">Reported by</span>
                                    <span className="rq-party-name">{item.reporter_name}</span>
                                    <span className="rq-party-sub">
                                      {item.reporter_department || 'Department N/A'}
                                      {item.reporter_student_id && ` • ID: ${item.reporter_student_id}`}
                                      {` • Filed ${formatDateTime(item.created_at)}`}
                                    </span>
                                  </div>
                                  {item.reporter_id && (
                                    <button
                                      type="button"
                                      className="rq-btn-chat"
                                      onClick={() => setChatUser({
                                        user_id: item.reporter_id,
                                        full_name: item.reporter_name
                                      })}
                                    >
                                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                      </svg>
                                      <span>Message</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Right Column: Moderation Decision */}
                            <div className="rq-drawer-col action">
                              <div className="rq-decision-card">
                                <h4 className="rq-decision-title">Moderation Resolution</h4>

                                {item.status !== 'pending' && (
                                  <div className="rq-history-banner">
                                    <div className="rq-history-status">
                                      Status: <strong>{item.action_taken === 'post_takedown' ? 'Post Taken Down' : item.status}</strong>
                                    </div>
                                    {item.reviewed_at && (
                                      <div className="rq-history-time">
                                        Resolved on {formatDateTime(item.reviewed_at)}
                                      </div>
                                    )}
                                  </div>
                                )}

                                <div className="rq-notes-wrap">
                                  <label className="rq-notes-label">
                                    Admin Notes (Optional)
                                  </label>
                                  <textarea
                                    className="rq-notes-textarea"
                                    rows="3"
                                    placeholder="Enter internal reason or moderation notes..."
                                    value={adminNotes[item.report_id] ?? ''}
                                    onChange={(e) =>
                                      setAdminNotes(prev => ({
                                        ...prev,
                                        [item.report_id]: e.target.value
                                      }))
                                    }
                                  />
                                </div>

                                <div className="rq-action-buttons">
                                  <button
                                    type="button"
                                    className="rq-btn-dismiss"
                                    onClick={() => handleStatusChange(item.report_id, 'dismissed')}
                                    disabled={actionLoading === item.report_id}
                                    title="Dismiss report as false alarm"
                                  >
                                    Dismiss Report
                                  </button>

                                  <button
                                    type="button"
                                    className="rq-btn-review"
                                    onClick={() => handleStatusChange(item.report_id, 'reviewed')}
                                    disabled={actionLoading === item.report_id}
                                    title="Acknowledge violation and keep post"
                                  >
                                    Mark Reviewed
                                  </button>

                                  {item.post_status !== 'closed' && (
                                    <button
                                      type="button"
                                      className="rq-btn-takedown"
                                      onClick={() => {
                                        setTakedownTarget(item);
                                        setTakedownNote(adminNotes[item.report_id] || '');
                                      }}
                                      disabled={actionLoading === item.report_id}
                                      title="Permanently remove post and refund bounty"
                                    >
                                      Take Down Post
                                    </button>
                                  )}

                                  {item.status !== 'pending' && (
                                    <button
                                      type="button"
                                      className="rq-btn-reopen"
                                      onClick={() => handleStatusChange(item.report_id, 'pending', '')}
                                      disabled={actionLoading === item.report_id}
                                    >
                                      Reopen
                                    </button>
                                  )}
                                </div>
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

      {/* ── Pagination ── */}
      {filteredReports.length > 0 && (
        <div className="rq-pagination">
          <div className="rq-pagination-info">
            Showing <strong>{(currentPage - 1) * pageSize + 1}</strong> to{' '}
            <strong>{Math.min(currentPage * pageSize, filteredReports.length)}</strong> of{' '}
            <strong>{filteredReports.length}</strong> reports
          </div>

          <div className="rq-pagination-controls">
            <select
              className="rq-page-size"
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
            >
              <option value="10">10 / page</option>
              <option value="25">25 / page</option>
              <option value="50">50 / page</option>
            </select>

            <button
              type="button"
              className="rq-page-nav"
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage <= 1}
            >
              Previous
            </button>
            <span className="rq-page-indicator">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              className="rq-page-nav"
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage >= totalPages}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* ── Post Takedown Modal ── */}
      {takedownTarget && (
        <div className="rq-modal-overlay" onClick={() => !actionLoading && setTakedownTarget(null)}>
          <div className="rq-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="rq-modal-icon danger">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>

            <div className="rq-modal-body">
              <h3 className="rq-modal-title">Take Down Post #{takedownTarget.post_id}?</h3>
              <p className="rq-modal-post-name">&ldquo;{takedownTarget.post_title}&rdquo;</p>
              <p className="rq-modal-desc">
                Taking down this post will immediately unpublish it from the platform.
                {takedownTarget.bounty > 0 && (
                  <span> The held escrow bounty of <strong>৳{Number(takedownTarget.bounty).toLocaleString('en-IN')}</strong> will be automatically refunded to <strong>{takedownTarget.post_author_name}</strong>.</span>
                )}
              </p>

              <div className="rq-modal-field">
                <label>Reason / Notes for Author</label>
                <textarea
                  rows="3"
                  placeholder="Explain why this content violates platform guidelines..."
                  value={takedownNote}
                  onChange={(e) => setTakedownNote(e.target.value)}
                />
              </div>

              <div className="rq-modal-actions">
                <button
                  type="button"
                  className="rq-modal-cancel"
                  onClick={() => setTakedownTarget(null)}
                  disabled={actionLoading === takedownTarget.report_id}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="rq-modal-confirm"
                  onClick={handleConfirmTakedown}
                  disabled={actionLoading === takedownTarget.report_id}
                >
                  {actionLoading === takedownTarget.report_id ? 'Taking down...' : 'Confirm Take Down'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Direct Chat Modal ── */}
      {chatUser && (
        <ChatModal
          user={user}
          initialTargetUserId={chatUser.user_id}
          initialTargetName={chatUser.full_name}
          onClose={() => setChatUser(null)}
        />
      )}
    </div>
  );
};

export default ReportQueue;
