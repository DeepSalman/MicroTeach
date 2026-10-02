import React, { useState, useEffect, useMemo } from 'react';
import {
  fetchReports,
  updateReportStatus,
  takedownReportedPost,
  batchUpdateReportStatus
} from './api';
import ChatModal from './ChatModal';
import './ReportQueue.css';

const SEVERITY_CONFIG = {
  fraud: { label: 'Fraud / Scam', level: 4, badgeClass: 'severity-danger', icon: '🚨' },
  harassment: { label: 'Harassment', level: 4, badgeClass: 'severity-danger', icon: '⚠️' },
  academic_dishonesty: { label: 'Academic Dishonesty', level: 3, badgeClass: 'severity-warning', icon: '🎓' },
  inappropriate: { label: 'Inappropriate Content', level: 2, badgeClass: 'severity-info', icon: '⛔' },
  spam: { label: 'Spam', level: 1, badgeClass: 'severity-muted', icon: '📬' },
  other: { label: 'Other Policy Concern', level: 1, badgeClass: 'severity-default', icon: '📋' }
};

const PRESET_ADMIN_NOTES = [
  'Policy violation confirmed. Formal notice recorded.',
  'Content removed due to violation of academic integrity guidelines.',
  'Commercial advertisement / spam detected and purged.',
  'False positive: Post complies with campus marketplace community rules.',
  'Issue resolved after direct communication with student.'
];

const ReportQueue = ({ user }) => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters & Search
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'pending' | 'reviewed' | 'dismissed'
  const [reasonFilter, setReasonFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'oldest' | 'severity' | 'bounty'
  const [searchQuery, setSearchQuery] = useState('');

  // Expandable inspection drawer
  const [expandedId, setExpandedId] = useState(null);

  // Multi-select & Batch
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Interactive notes & loading
  const [adminNotes, setAdminNotes] = useState({});
  const [actionLoading, setActionLoading] = useState(null);
  const [takedownModal, setTakedownModal] = useState(null); // { report, notes }
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
      const timer = setTimeout(() => setFeedback(null), 5000);
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

      // Prepopulate notes if available
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

  const getTimeAgo = (dateStr) => {
    if (!dateStr) return '—';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const formatExactDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getSeverityInfo = (reason) => {
    return SEVERITY_CONFIG[reason] || { label: reason || 'Unknown', level: 1, badgeClass: 'severity-default', icon: '•' };
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
        message: `Report #REP-${String(reportId).padStart(4, '0')} marked as ${newStatus.toUpperCase()}.`
      });
    } catch (err) {
      console.error('Failed to update status:', err);
      const raw = err.response?.data?.message || err.response?.data?.error || err.message;
      const msg = typeof raw === 'string'
        ? raw
        : (raw?.message || (raw && typeof raw === 'object' ? JSON.stringify(raw) : null) || 'Failed to update report status.');
      setFeedback({
        type: 'error',
        message: msg
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Administrative post takedown
  const handleConfirmTakedown = async () => {
    if (!takedownModal?.report) return;
    const report = takedownModal.report;
    const reportId = report.report_id;
    const notes = takedownModal.notes || adminNotes[reportId] || 'Post taken down for policy infraction.';

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
        message: res.data?.message || `Post #${report.post_id} removed & Report #REP-${String(reportId).padStart(4, '0')} actioned.`
      });
      setTakedownModal(null);
    } catch (err) {
      console.error('Failed to take down post:', err);
      const raw = err.response?.data?.message || err.response?.data?.error || err.message;
      const msg = typeof raw === 'string'
        ? raw
        : (raw?.message || (raw && typeof raw === 'object' ? JSON.stringify(raw) : null) || 'Failed to process post takedown.');
      setFeedback({
        type: 'error',
        message: msg
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
        admin_notes: `Bulk triage action: ${status}`
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
        message: `Batch updated ${ids.length} reports to ${status.toUpperCase()}.`
      });
      setSelectedIds(new Set());
    } catch (err) {
      console.error('Bulk update error:', err);
      const raw = err.response?.data?.message || err.response?.data?.error || err.message;
      const msg = typeof raw === 'string'
        ? raw
        : (raw?.message || (raw && typeof raw === 'object' ? JSON.stringify(raw) : null) || 'Failed to execute bulk action.');
      setFeedback({
        type: 'error',
        message: msg
      });
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

  // Export to CSV
  const exportReportsCSV = (subset = null) => {
    const dataToExport = subset || filteredReports;
    if (dataToExport.length === 0) {
      setFeedback({ type: 'error', message: 'No reports to export.' });
      return;
    }

    const headers = [
      'Report ID',
      'Status',
      'Violation Reason',
      'Post ID',
      'Post Title',
      'Course Code',
      'Post Bounty',
      'Post Status',
      'Author Name',
      'Author Student ID',
      'Author Department',
      'Reporter Name',
      'Reporter Student ID',
      'Reporter Notes',
      'Action Taken',
      'Admin Notes',
      'Created At'
    ];

    const rows = dataToExport.map(r => [
      r.report_id,
      r.status,
      `"${(r.reason || '').replace(/"/g, '""')}"`,
      r.post_id,
      `"${(r.post_title || '').replace(/"/g, '""')}"`,
      r.course_code || '',
      r.bounty || 0,
      r.post_status || '',
      `"${(r.post_author_name || '').replace(/"/g, '""')}"`,
      `"${(r.post_author_student_id || '').replace(/"/g, '""')}"`,
      `"${(r.post_author_department || '').replace(/"/g, '""')}"`,
      `"${(r.reporter_name || '').replace(/"/g, '""')}"`,
      `"${(r.reporter_student_id || '').replace(/"/g, '""')}"`,
      `"${(r.description || '').replace(/"/g, '""')}"`,
      r.action_taken || '',
      `"${(r.admin_notes || '').replace(/"/g, '""')}"`,
      r.created_at ? new Date(r.created_at).toISOString() : ''
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `microteach_report_queue_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Filtered & Sorted Reports
  const filteredReports = useMemo(() => {
    return reports
      .filter(r => {
        // Tab filter
        if (filterTab !== 'all' && r.status !== filterTab) return false;

        // Reason filter
        if (reasonFilter !== 'all' && r.reason !== reasonFilter) return false;

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchTitle = (r.post_title || '').toLowerCase().includes(q);
          const matchCourse = (r.course_code || '').toLowerCase().includes(q);
          const matchCategory = (r.category || '').toLowerCase().includes(q);
          const matchReporter = (r.reporter_name || '').toLowerCase().includes(q);
          const matchReporterId = (r.reporter_student_id || '').toLowerCase().includes(q);
          const matchAuthor = (r.post_author_name || '').toLowerCase().includes(q);
          const matchAuthorId = (r.post_author_student_id || '').toLowerCase().includes(q);
          const matchReason = (r.reason || '').toLowerCase().includes(q);
          const matchId = String(r.report_id).includes(q) || `#rep-${r.report_id}`.includes(q);
          if (
            !matchTitle &&
            !matchCourse &&
            !matchCategory &&
            !matchReporter &&
            !matchReporterId &&
            !matchAuthor &&
            !matchAuthorId &&
            !matchReason &&
            !matchId
          ) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'severity') {
          const sevA = SEVERITY_CONFIG[a.reason]?.level || 0;
          const sevB = SEVERITY_CONFIG[b.reason]?.level || 0;
          if (sevB !== sevA) return sevB - sevA;
          return new Date(b.created_at) - new Date(a.created_at);
        }
        if (sortBy === 'oldest') {
          return new Date(a.created_at) - new Date(b.created_at);
        }
        if (sortBy === 'bounty') {
          return (parseFloat(b.bounty) || 0) - (parseFloat(a.bounty) || 0);
        }
        // Default: newest
        return new Date(b.created_at) - new Date(a.created_at);
      });
  }, [reports, filterTab, reasonFilter, searchQuery, sortBy]);

  // Statistics
  const counts = useMemo(() => {
    const pendingList = reports.filter(r => r.status === 'pending');
    const highSev = pendingList.filter(r => {
      const lvl = SEVERITY_CONFIG[r.reason]?.level || 0;
      return lvl >= 3;
    });

    return {
      all: reports.length,
      pending: pendingList.length,
      reviewed: reports.filter(r => r.status === 'reviewed').length,
      dismissed: reports.filter(r => r.status === 'dismissed').length,
      highSeverity: highSev.length
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
    <div className="admin-content rq-minimal">
      {/* ── Top Header & Telemetry Strip ── */}
      <div className="rq-min-header">
        <div className="rq-min-title-group">
          <div className="rq-breadcrumb">
            <span>Institutional Governance</span>
            <span className="rq-breadcrumb-sep">&rsaquo;</span>
            <span className="rq-breadcrumb-active">Report Queue</span>
          </div>
          <div className="rq-title-row">
            <h1 className="rq-min-title">Report Queue</h1>
            <span className="rq-live-indicator" title="Live moderation feed">
              <span className="rq-live-dot"></span>
              Live Feed
            </span>
          </div>

          <div className="rq-min-stats-strip">
            <span className={`rq-stat-pill ${counts.pending > 0 ? 'alert' : ''}`}>
              Pending Triage: <strong>{counts.pending}</strong>
            </span>
            <span className="rq-stat-sep">&bull;</span>
            <span className={`rq-stat-pill ${counts.highSeverity > 0 ? 'danger' : ''}`}>
              High Severity: <strong>{counts.highSeverity}</strong>
            </span>
            <span className="rq-stat-sep">&bull;</span>
            <span className="rq-stat-pill">
              Reviewed: <strong>{counts.reviewed}</strong>
            </span>
            <span className="rq-stat-sep">&bull;</span>
            <span className="rq-stat-pill">
              Dismissed: <strong>{counts.dismissed}</strong>
            </span>
          </div>
        </div>

        <div className="rq-header-actions">
          <button
            className="rq-min-btn rq-export-btn"
            onClick={() => exportReportsCSV()}
            title="Download CSV report audit log"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="7 10 12 15 17 10" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="12" y1="15" x2="12" y2="3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Export CSV
          </button>
          <button
            className={`rq-min-btn ${refreshing ? 'loading' : ''}`}
            onClick={() => loadReports(true)}
            disabled={refreshing}
            title="Reload report data from database"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 4v6h-6" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M1 20v-6h6" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* ── Toast Notifications ── */}
      {feedback && (
        <div className={`rq-min-toast ${feedback.type}`}>
          <span className="rq-toast-text">{feedback.message}</span>
          <button className="rq-toast-close" onClick={() => setFeedback(null)}>&times;</button>
        </div>
      )}

      {/* ── Filter Bar ── */}
      <div className="rq-min-filters">
        <div className="rq-filter-tabs">
          <button
            className={`rq-tab-btn ${filterTab === 'all' ? 'active' : ''}`}
            onClick={() => { setFilterTab('all'); setCurrentPage(1); }}
          >
            All Reports
            <span className="rq-tab-count">{counts.all}</span>
          </button>
          <button
            className={`rq-tab-btn ${filterTab === 'pending' ? 'active' : ''}`}
            onClick={() => { setFilterTab('pending'); setCurrentPage(1); }}
          >
            Pending Triage
            <span className={`rq-tab-count ${counts.pending > 0 ? 'accent' : ''}`}>{counts.pending}</span>
          </button>
          <button
            className={`rq-tab-btn ${filterTab === 'reviewed' ? 'active' : ''}`}
            onClick={() => { setFilterTab('reviewed'); setCurrentPage(1); }}
          >
            Reviewed
            <span className="rq-tab-count">{counts.reviewed}</span>
          </button>
          <button
            className={`rq-tab-btn ${filterTab === 'dismissed' ? 'active' : ''}`}
            onClick={() => { setFilterTab('dismissed'); setCurrentPage(1); }}
          >
            Dismissed
            <span className="rq-tab-count">{counts.dismissed}</span>
          </button>
        </div>

        <div className="rq-controls-row">
          <div className="rq-search-wrap">
            <svg className="rq-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              placeholder="Search by post, course, author, reporter, or ID..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="rq-search-input"
            />
            {searchQuery && (
              <button className="rq-search-clear" onClick={() => setSearchQuery('')}>&times;</button>
            )}
          </div>

          <div className="rq-select-group">
            <label className="rq-select-label">Violation:</label>
            <select
              className="rq-min-select"
              value={reasonFilter}
              onChange={(e) => { setReasonFilter(e.target.value); setCurrentPage(1); }}
            >
              <option value="all">All Violations</option>
              <option value="academic_dishonesty">Academic Dishonesty</option>
              <option value="fraud">Fraud / Scam</option>
              <option value="harassment">Harassment</option>
              <option value="spam">Spam</option>
              <option value="inappropriate">Inappropriate Content</option>
              <option value="other">Other Concerns</option>
            </select>
          </div>

          <div className="rq-select-group">
            <label className="rq-select-label">Sort:</label>
            <select
              className="rq-min-select"
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value); setCurrentPage(1); }}
            >
              <option value="newest">Newest First</option>
              <option value="severity">Highest Severity First</option>
              <option value="bounty">Highest Bounty First</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>

          {hasActiveFilters && (
            <button className="rq-min-reset" onClick={resetFilters} title="Reset all active filters">
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* ── Bulk Actions Floating Toolbar ── */}
      {selectedIds.size > 0 && (
        <div className="rq-bulk-toolbar">
          <div className="rq-bulk-info">
            <span className="rq-bulk-count">{selectedIds.size}</span>
            <span>report{selectedIds.size > 1 ? 's' : ''} selected</span>
          </div>

          <div className="rq-bulk-actions">
            <button
              className="rq-bulk-btn review"
              onClick={() => handleBulkStatus('reviewed')}
              disabled={actionLoading === 'bulk'}
            >
              ✓ Bulk Mark Reviewed
            </button>
            <button
              className="rq-bulk-btn dismiss"
              onClick={() => handleBulkStatus('dismissed')}
              disabled={actionLoading === 'bulk'}
            >
              ✕ Bulk Dismiss
            </button>
            <button
              className="rq-bulk-btn export"
              onClick={() => {
                const subset = reports.filter(r => selectedIds.has(r.report_id));
                exportReportsCSV(subset);
              }}
            >
              Export Selected
            </button>
            <button
              className="rq-bulk-btn clear"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* ── High-Density Moderation Table ── */}
      <div className="rq-table-wrap">
        <table className="rq-table">
          <thead>
            <tr>
              <th style={{ width: '40px' }} className="rq-th-checkbox">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={handleSelectAll}
                  aria-label="Select all visible reports"
                />
              </th>
              <th style={{ width: '95px' }}>Report ID</th>
              <th style={{ width: '150px' }}>Violation</th>
              <th>Reported Post &amp; Course</th>
              <th>Post Author</th>
              <th>Reporter</th>
              <th style={{ width: '90px' }}>Status</th>
              <th style={{ width: '80px' }}>Reported</th>
              <th style={{ width: '130px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="9" className="rq-empty-td">
                  <div className="rq-table-loading">
                    <span className="rq-spinner"></span>
                    <span>Loading moderation reports...</span>
                  </div>
                </td>
              </tr>
            ) : paginatedReports.length === 0 ? (
              <tr>
                <td colSpan="9" className="rq-empty-td">
                  <div className="rq-empty-state">
                    <span className="rq-empty-icon">🛡️</span>
                    <h3>No reports found</h3>
                    <p>
                      {hasActiveFilters
                        ? 'Try loosening your filter or search criteria.'
                        : 'The moderation queue is clear. No active reports filed.'}
                    </p>
                    {hasActiveFilters && (
                      <button className="rq-min-btn" onClick={resetFilters}>Reset Filters</button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              paginatedReports.map(item => {
                const isExpanded = expandedId === item.report_id;
                const isSelected = selectedIds.has(item.report_id);
                const isPending = item.status === 'pending';
                const isActionLoading = actionLoading === item.report_id;
                const sev = getSeverityInfo(item.reason);
                const isTakedown = item.action_taken === 'post_takedown';
                const isPostClosed = item.post_status === 'closed';

                return (
                  <React.Fragment key={item.report_id}>
                    <tr
                      className={`rq-row ${isExpanded ? 'expanded' : ''} status-${item.status} ${isSelected ? 'selected' : ''}`}
                      onClick={() => setExpandedId(isExpanded ? null : item.report_id)}
                    >
                      <td className="rq-td-checkbox" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(item.report_id)}
                          aria-label={`Select report #${item.report_id}`}
                        />
                      </td>

                      <td className="rq-td-id">
                        <span className="rq-id-text">#REP-{String(item.report_id).padStart(4, '0')}</span>
                        {sev.level >= 4 && <span className="rq-urgent-dot" title="High severity infraction"></span>}
                      </td>

                      <td className="rq-td-violation">
                        <span className={`rq-violation-tag ${sev.badgeClass}`}>
                          <span className="rq-tag-icon">{sev.icon}</span>
                          <span className="rq-tag-label">{sev.label}</span>
                        </span>
                      </td>

                      <td className="rq-td-post">
                        <div className="rq-post-line">
                          <span className="rq-post-title" title={item.post_title}>
                            {item.post_title || 'Untitled Post'}
                          </span>
                        </div>
                        <div className="rq-post-subline">
                          {item.course_code && <span className="rq-course-badge">{item.course_code}</span>}
                          {item.category && <span className="rq-category-badge">{item.category}</span>}
                          <span className="rq-bounty-badge">৳{parseFloat(item.bounty || 0).toFixed(0)}</span>
                          {isPostClosed && (
                            <span className="rq-post-closed-badge" title="Post is closed or removed">
                              Closed
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="rq-td-author">
                        <div className="rq-user-block">
                          <span className="rq-user-name">{item.post_author_name || 'Unknown Author'}</span>
                          <div className="rq-user-sub">
                            {item.post_author_student_id && <span>#{item.post_author_student_id}</span>}
                            {item.post_author_department && (
                              <span className="rq-user-dept" title={item.post_author_department}>
                                {item.post_author_department}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="rq-td-reporter">
                        <div className="rq-user-block">
                          <span className="rq-user-name">{item.reporter_name || 'Anonymous Student'}</span>
                          <div className="rq-user-sub">
                            {item.reporter_student_id && <span>#{item.reporter_student_id}</span>}
                            {item.reporter_department && (
                              <span className="rq-user-dept" title={item.reporter_department}>
                                {item.reporter_department}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="rq-td-status">
                        <span className={`rq-pill ${item.status}`}>
                          {item.status === 'pending' && <span className="rq-pill-pulse"></span>}
                          {item.status === 'reviewed' ? (isTakedown ? 'Taken Down' : 'Reviewed') : item.status}
                        </span>
                      </td>

                      <td className="rq-td-date">
                        <span className="rq-date-rel" title={formatExactDate(item.created_at)}>
                          {getTimeAgo(item.created_at)}
                        </span>
                      </td>

                      <td className="rq-td-actions" onClick={(e) => e.stopPropagation()}>
                        <div className="rq-action-group">
                          {isPending ? (
                            <>
                              <button
                                className="rq-btn-quick review"
                                onClick={() => handleStatusChange(item.report_id, 'reviewed')}
                                disabled={isActionLoading}
                                title="Mark as reviewed / violation acknowledged"
                              >
                                {isActionLoading ? '...' : 'Review'}
                              </button>
                              <button
                                className="rq-btn-quick dismiss"
                                onClick={() => handleStatusChange(item.report_id, 'dismissed')}
                                disabled={isActionLoading}
                                title="Dismiss false positive report"
                              >
                                Dismiss
                              </button>
                            </>
                          ) : (
                            <button
                              className="rq-btn-quick inspect"
                              onClick={() => setExpandedId(isExpanded ? null : item.report_id)}
                              title="Inspect moderation log"
                            >
                              {isExpanded ? 'Close' : 'Inspect'}
                            </button>
                          )}
                          <button
                            className={`rq-btn-chevron ${isExpanded ? 'open' : ''}`}
                            onClick={() => setExpandedId(isExpanded ? null : item.report_id)}
                            aria-label="Toggle details drawer"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* ── Slide-Out Contextual Moderation Drawer ── */}
                    {isExpanded && (
                      <tr className="rq-drawer-row">
                        <td colSpan="9" className="rq-drawer-td">
                          <div className="rq-drawer-container">
                            {/* Column 1: Reported Content Dossier */}
                            <div className="rq-drawer-col">
                              <div className="rq-col-header">
                                <span className="rq-col-icon">📄</span>
                                <h4>Reported Post &amp; Author</h4>
                              </div>

                              <div className="rq-dossier-card">
                                <div className="rq-dossier-field">
                                  <span className="rq-field-lbl">Post Title</span>
                                  <span className="rq-field-val title">{item.post_title}</span>
                                </div>

                                <div className="rq-dossier-row">
                                  <div className="rq-dossier-field">
                                    <span className="rq-field-lbl">Course Code</span>
                                    <span className="rq-badge-mono">{item.course_code || 'General'}</span>
                                  </div>
                                  <div className="rq-dossier-field">
                                    <span className="rq-field-lbl">Escrow Bounty</span>
                                    <span className="rq-badge-mono bounty">৳{parseFloat(item.bounty || 0).toFixed(2)}</span>
                                  </div>
                                  <div className="rq-dossier-field">
                                    <span className="rq-field-lbl">Post Status</span>
                                    <span className={`rq-badge-status ${item.post_status}`}>
                                      {item.post_status || 'active'}
                                    </span>
                                  </div>
                                </div>

                                <div className="rq-dossier-field">
                                  <span className="rq-field-lbl">Post Description / Content</span>
                                  <div className="rq-post-body-box">
                                    {item.post_description ? (
                                      <p>{item.post_description}</p>
                                    ) : (
                                      <em className="rq-muted">No text description attached to this listing.</em>
                                    )}
                                  </div>
                                </div>

                                <div className="rq-party-box">
                                  <div className="rq-party-info">
                                    <span className="rq-field-lbl">Post Author</span>
                                    <span className="rq-party-name">{item.post_author_name}</span>
                                    <span className="rq-party-sub">
                                      {item.post_author_department}
                                      {item.post_author_student_id && ` · ID: ${item.post_author_student_id}`}
                                    </span>
                                    {item.post_author_email && (
                                      <span className="rq-party-email">{item.post_author_email}</span>
                                    )}
                                  </div>
                                  {item.post_author_id && (
                                    <button
                                      className="rq-chat-launch-btn"
                                      onClick={() => setChatUser({
                                        user_id: item.post_author_id,
                                        full_name: item.post_author_name
                                      })}
                                      title="Open direct admin communication with author"
                                    >
                                      💬 Message Author
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Column 2: Infraction & Reporter Testimony */}
                            <div className="rq-drawer-col">
                              <div className="rq-col-header">
                                <span className="rq-col-icon">🚨</span>
                                <h4>Infraction &amp; Reporter Testimony</h4>
                              </div>

                              <div className="rq-dossier-card">
                                <div className="rq-dossier-row">
                                  <div className="rq-dossier-field">
                                    <span className="rq-field-lbl">Violation Type</span>
                                    <span className={`rq-violation-tag ${sev.badgeClass} large`}>
                                      {sev.icon} {sev.label}
                                    </span>
                                  </div>
                                  <div className="rq-dossier-field">
                                    <span className="rq-field-lbl">Severity Tier</span>
                                    <span className="rq-severity-meter">
                                      Level {sev.level}/4 {sev.level >= 4 ? '· High Urgency' : sev.level === 3 ? '· Medium Urgency' : '· Standard'}
                                    </span>
                                  </div>
                                </div>

                                <div className="rq-dossier-field">
                                  <span className="rq-field-lbl">Reporter's Narrative Testimony</span>
                                  <div className="rq-testimony-box">
                                    {item.description ? (
                                      <p>{item.description}</p>
                                    ) : (
                                      <em className="rq-muted">
                                        Reporter did not provide additional written narrative description. Flagged under standard reason: {sev.label}.
                                      </em>
                                    )}
                                  </div>
                                </div>

                                <div className="rq-party-box">
                                  <div className="rq-party-info">
                                    <span className="rq-field-lbl">Reported By</span>
                                    <span className="rq-party-name">{item.reporter_name}</span>
                                    <span className="rq-party-sub">
                                      {item.reporter_department}
                                      {item.reporter_student_id && ` · ID: ${item.reporter_student_id}`}
                                    </span>
                                    {item.reporter_email && (
                                      <span className="rq-party-email">{item.reporter_email}</span>
                                    )}
                                    <span className="rq-party-date">
                                      Report filed on {formatExactDate(item.created_at)}
                                    </span>
                                  </div>
                                  {item.reporter_id && (
                                    <button
                                      className="rq-chat-launch-btn secondary"
                                      onClick={() => setChatUser({
                                        user_id: item.reporter_id,
                                        full_name: item.reporter_name
                                      })}
                                      title="Open direct admin communication with reporter"
                                    >
                                      💬 Message Reporter
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Column 3: Moderation Resolution & Action */}
                            <div className="rq-drawer-col">
                              <div className="rq-col-header">
                                <span className="rq-col-icon">⚖️</span>
                                <h4>Administrative Resolution</h4>
                              </div>

                              <div className="rq-dossier-card resolution">
                                <div className="rq-notes-section">
                                  <div className="rq-notes-header">
                                    <span className="rq-field-lbl">Moderator Notes &amp; Findings</span>
                                    <span className="rq-field-hint">Recorded in compliance log</span>
                                  </div>

                                  <textarea
                                    className="rq-notes-input"
                                    rows="3"
                                    placeholder="Enter administrative notes, findings, or justification..."
                                    value={adminNotes[item.report_id] ?? ''}
                                    onChange={(e) =>
                                      setAdminNotes(prev => ({
                                        ...prev,
                                        [item.report_id]: e.target.value
                                      }))
                                    }
                                  />

                                  <div className="rq-presets-wrap">
                                    <span className="rq-preset-label">Quick Presets:</span>
                                    <div className="rq-preset-pills">
                                      {PRESET_ADMIN_NOTES.map((preset, pIdx) => (
                                        <button
                                          key={pIdx}
                                          className="rq-preset-pill"
                                          onClick={() =>
                                            setAdminNotes(prev => ({
                                              ...prev,
                                              [item.report_id]: preset
                                            }))
                                          }
                                        >
                                          {preset.slice(0, 32)}...
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                </div>

                                {/* Previous Action Log if already resolved */}
                                {item.status !== 'pending' && (
                                  <div className="rq-audit-log-badge">
                                    <div className="rq-audit-row">
                                      <span className="rq-audit-k">Resolution Status:</span>
                                      <span className={`rq-pill ${item.status}`}>{item.status}</span>
                                    </div>
                                    {item.action_taken && (
                                      <div className="rq-audit-row">
                                        <span className="rq-audit-k">Action Executed:</span>
                                        <span className="rq-audit-v highlight">{item.action_taken}</span>
                                      </div>
                                    )}
                                    {item.reviewed_at && (
                                      <div className="rq-audit-row">
                                        <span className="rq-audit-k">Actioned At:</span>
                                        <span className="rq-audit-v">{formatExactDate(item.reviewed_at)}</span>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Action Buttons */}
                                <div className="rq-drawer-actions">
                                  <button
                                    className="rq-btn-action dismiss"
                                    onClick={() => handleStatusChange(item.report_id, 'dismissed')}
                                    disabled={isActionLoading}
                                  >
                                    ✕ Dismiss (False Alarm)
                                  </button>

                                  <button
                                    className="rq-btn-action review"
                                    onClick={() => handleStatusChange(item.report_id, 'reviewed')}
                                    disabled={isActionLoading}
                                  >
                                    ✓ Acknowledge &amp; Keep Live
                                  </button>

                                  {item.post_status !== 'closed' && (
                                    <button
                                      className="rq-btn-action takedown"
                                      onClick={() => setTakedownModal({
                                        report: item,
                                        notes: adminNotes[item.report_id] || ''
                                      })}
                                      disabled={isActionLoading}
                                    >
                                      🗑️ Take Down Post
                                    </button>
                                  )}

                                  {item.status !== 'pending' && (
                                    <button
                                      className="rq-btn-action reset"
                                      onClick={() => handleStatusChange(item.report_id, 'pending', '')}
                                      disabled={isActionLoading}
                                      title="Revert report back to pending triage"
                                    >
                                      Reopen for Review
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

      {/* ── Pagination Bar ── */}
      <div className="rq-pagination-bar">
        <div className="rq-page-info">
          Showing <strong>{filteredReports.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}</strong>–
          <strong>{Math.min(currentPage * pageSize, filteredReports.length)}</strong> of{' '}
          <strong>{filteredReports.length}</strong> reports
        </div>

        <div className="rq-page-controls">
          <div className="rq-page-size-wrap">
            <label>Rows per page:</label>
            <select
              className="rq-page-size-select"
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
            >
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
            </select>
          </div>

          <div className="rq-page-btns">
            <button
              className="rq-page-btn"
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage <= 1}
              aria-label="Previous page"
            >
              &larr; Prev
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                className={`rq-page-btn num ${p === currentPage ? 'active' : ''}`}
                onClick={() => setCurrentPage(p)}
              >
                {p}
              </button>
            ))}
            <button
              className="rq-page-btn"
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage >= totalPages}
              aria-label="Next page"
            >
              Next &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* ── Takedown Confirmation Modal ── */}
      {takedownModal && (
        <div className="rq-modal-overlay" onClick={() => setTakedownModal(null)}>
          <div className="rq-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="rq-modal-header danger">
              <span className="rq-modal-icon">⚠️</span>
              <div className="rq-modal-title-wrap">
                <h3>Confirm Post Takedown</h3>
                <span className="rq-modal-sub">Administrative Moderation Enforcement</span>
              </div>
              <button className="rq-modal-close" onClick={() => setTakedownModal(null)}>&times;</button>
            </div>

            <div className="rq-modal-body">
              <p className="rq-modal-p">
                You are about to enforce a takedown on reported post <strong>#{takedownModal.report.post_id}</strong> (<em>{takedownModal.report.post_title}</em>).
              </p>

              <div className="rq-modal-summary">
                <div className="rq-summary-row">
                  <span>Author:</span>
                  <strong>{takedownModal.report.post_author_name}</strong>
                </div>
                <div className="rq-summary-row">
                  <span>Course:</span>
                  <strong>{takedownModal.report.course_code || 'General'}</strong>
                </div>
                <div className="rq-summary-row">
                  <span>Escrow Bounty:</span>
                  <strong>৳{parseFloat(takedownModal.report.bounty || 0).toFixed(2)}</strong>
                </div>
                <div className="rq-summary-row">
                  <span>Infraction Reason:</span>
                  <strong className="text-danger">{getSeverityInfo(takedownModal.report.reason).label}</strong>
                </div>
              </div>

              <div className="rq-modal-field">
                <label className="rq-modal-label">Enter Moderation Justification:</label>
                <textarea
                  className="rq-modal-textarea"
                  rows="3"
                  value={takedownModal.notes}
                  onChange={(e) => setTakedownModal(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Explain why this content was removed..."
                />
              </div>

              <div className="rq-modal-warning-box">
                <p>
                  <strong>Notice:</strong> Taking down this post will immediately remove it from public marketplace listings. Any held escrow bounty will be returned to the student wallet, and the report will be logged as <code>post_takedown</code>.
                </p>
              </div>
            </div>

            <div className="rq-modal-actions">
              <button
                className="rq-modal-btn cancel"
                onClick={() => setTakedownModal(null)}
              >
                Cancel
              </button>
              <button
                className="rq-modal-btn confirm-danger"
                onClick={handleConfirmTakedown}
                disabled={actionLoading === takedownModal.report.report_id}
              >
                {actionLoading === takedownModal.report.report_id ? 'Taking down...' : 'Confirm Post Takedown'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Integrated Direct Admin Chat ── */}
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
