import React, { useState, useEffect } from 'react';
import { fetchReports, updateReportStatus } from './api';
import './ReportQueue.css';

const ReportQueue = ({ user }) => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      const response = await fetchReports();
      setReports(response.data);
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatus = async (reportId, newStatus) => {
    try {
      await updateReportStatus(reportId, newStatus);
      setReports((prev) =>
        prev.map((r) => (r.report_id === reportId ? { ...r, status: newStatus } : r))
      );
    } catch (err) {
      console.error('Failed to update report:', err);
    }
  };

  const getReasonLabel = (reason) => {
    const labels = {
      spam: 'Spam',
      inappropriate: 'Inappropriate Content',
      fraud: 'Fraud or Scam',
      harassment: 'Harassment',
      academic_dishonesty: 'Academic Dishonesty',
      other: 'Other',
    };
    return labels[reason] || reason;
  };

  const getTimeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const filtered = reports.filter((r) => {
    if (filter === 'all') return true;
    return r.status === filter;
  });

  const counts = {
    all: reports.length,
    pending: reports.filter((r) => r.status === 'pending').length,
    reviewed: reports.filter((r) => r.status === 'reviewed').length,
    dismissed: reports.filter((r) => r.status === 'dismissed').length,
  };

  return (
    <div className="admin-content">
      <div className="page-header">
        <div className="page-header-left">
          <div className="breadcrumb">
            <span>Institutional Governance</span>
            <span className="breadcrumb-sep">&rsaquo;</span>
            <span className="breadcrumb-active">Report Queue</span>
          </div>
          <h1 className="page-title">Report Queue</h1>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="rq-filters">
        {['all', 'pending', 'reviewed', 'dismissed'].map((f) => (
          <button
            key={f}
            className={`rq-filter-btn ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            <span className="rq-filter-count">{counts[f]}</span>
          </button>
        ))}
      </div>

      {/* Report Cards */}
      {loading ? (
        <div className="rq-loading">Loading reports...</div>
      ) : filtered.length === 0 ? (
        <div className="rq-empty">No reports found.</div>
      ) : (
        <div className="rq-queue">
          {filtered.map((item) => (
            <div key={item.report_id} className={`rq-card ${item.status}`}>
              <div className="rq-card-header">
                <div className="rq-card-left">
                  <span className="rq-id">#{item.report_id}</span>
                  <span className="rq-dot">&bull;</span>
                  <span className="rq-course">{item.course_code}</span>
                  <span className="rq-dot">&bull;</span>
                  <span className="rq-time">{getTimeAgo(item.created_at)}</span>
                </div>
                <span className={`rq-status-badge ${item.status}`}>
                  {item.status}
                </span>
              </div>

              <div className="rq-card-body">
                <div className="rq-report-info">
                  <div className="rq-report-row">
                    <span className="rq-label">Reported Post</span>
                    <span className="rq-value">{item.post_title}</span>
                  </div>
                  <div className="rq-report-row">
                    <span className="rq-label">Post Author</span>
                    <span className="rq-value">
                      {item.post_author_name}
                      <span className="rq-sub"> &middot; {item.post_author_department}</span>
                    </span>
                  </div>
                  <div className="rq-report-row">
                    <span className="rq-label">Reported By</span>
                    <span className="rq-value">
                      {item.reporter_name}
                      <span className="rq-sub"> &middot; {item.reporter_student_id}</span>
                    </span>
                  </div>
                  <div className="rq-report-row">
                    <span className="rq-label">Reason</span>
                    <span className="rq-violation">{getReasonLabel(item.reason)}</span>
                  </div>
                  {item.bounty > 0 && (
                    <div className="rq-report-row">
                      <span className="rq-label">Bounty</span>
                      <span className="rq-value">&#2547;{item.bounty}</span>
                    </div>
                  )}
                </div>

                {item.description && (
                  <p className="rq-content">{item.description}</p>
                )}
              </div>

              {item.status === 'pending' && (
                <div className="rq-card-actions">
                  <button
                    className="rq-action-btn review"
                    onClick={() => handleStatus(item.report_id, 'reviewed')}
                  >
                    Mark Reviewed
                  </button>
                  <button
                    className="rq-action-btn dismiss"
                    onClick={() => handleStatus(item.report_id, 'dismissed')}
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ReportQueue;
