import React, { useState, useEffect } from 'react';
import { fetchTeacherApplications, reviewTeacherApplication } from './api';
import './TeacherApplications.css';

const BASE_URL = 'http://localhost:3001';

const TeacherApplications = ({ user }) => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null); // { url, label }

  useEffect(() => {
    loadApplications();
  }, []);

  const loadApplications = async () => {
    setLoading(true);
    try {
      const response = await fetchTeacherApplications();
      setApplications(response.data);
    } catch (err) {
      console.error('Failed to load applications:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (applicationId, status) => {
    setActionLoading(applicationId);
    try {
      await reviewTeacherApplication(applicationId, {
        status,
        reviewed_by: user.user_id
      });
      setApplications((prev) =>
        prev.map((app) =>
          app.application_id === applicationId
            ? { ...app, status, reviewed_at: new Date().toISOString() }
            : app
        )
      );
    } catch (err) {
      console.error('Failed to review application:', err);
      alert(err.response?.data?.message || 'Failed to update application.');
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const filteredApps = applications.filter((app) => {
    if (filter === 'all') return true;
    return app.status === filter;
  });

  const pendingCount  = applications.filter((a) => a.status === 'pending').length;
  const approvedCount = applications.filter((a) => a.status === 'approved').length;
  const rejectedCount = applications.filter((a) => a.status === 'rejected').length;

  const getInitials = (name) => name.split(' ').map((n) => n[0]).join('');
  const parseExpertise = (expertise) => {
    if (!expertise) return [];
    return expertise.split(',').map((s) => s.trim()).filter(Boolean);
  };
  const getStatusLabel = (status) => {
    const labels = { pending: 'Pending Review', approved: 'Approved', rejected: 'Rejected' };
    return labels[status] || status;
  };

  const docLabel = (type) => {
    if (type === 'student_id_card') return 'Student ID Card';
    if (type === 'nid_card')        return 'National ID (NID)';
    return type;
  };

  return (
    <div className="admin-content">
      <div className="page-header">
        <div className="page-header-left">
          <div className="breadcrumb">
            <span>Institutional Governance</span>
            <span className="breadcrumb-sep">›</span>
            <span className="breadcrumb-active">Teacher Applications</span>
          </div>
          <h1 className="page-title">Teacher Applications</h1>
        </div>
      </div>

      <div className="ta-stats">
        <div className="ta-stat-card">
          <span className="ta-stat-number">{applications.length}</span>
          <span className="ta-stat-label">Total Applications</span>
        </div>
        <div className="ta-stat-card pending">
          <span className="ta-stat-number">{pendingCount}</span>
          <span className="ta-stat-label">Pending Review</span>
        </div>
        <div className="ta-stat-card approved">
          <span className="ta-stat-number">{approvedCount}</span>
          <span className="ta-stat-label">Approved</span>
        </div>
        <div className="ta-stat-card rejected">
          <span className="ta-stat-number">{rejectedCount}</span>
          <span className="ta-stat-label">Rejected</span>
        </div>
      </div>

      <div className="ta-filters">
        {['all', 'pending', 'approved', 'rejected'].map((f) => (
          <button
            key={f}
            className={`ta-filter-btn ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="ta-loading">Loading applications...</div>
      ) : filteredApps.length === 0 ? (
        <div className="ta-empty">
          <p>No {filter !== 'all' ? filter : ''} applications found.</p>
        </div>
      ) : (
        <div className="ta-queue">
          {filteredApps.map((app) => (
            <div key={app.application_id} className="ta-card">
              <div className="ta-card-header">
                <div className="ta-card-left">
                  <span className="ta-id">APP-{String(app.application_id).padStart(4, '0')}</span>
                  <span className="ta-dot">•</span>
                  <span className="ta-time">{formatDate(app.created_at)}</span>
                </div>
                <span className={`ta-status ${app.status}`}>
                  {getStatusLabel(app.status)}
                </span>
              </div>

              <div className="ta-card-body">
                <div className="ta-applicant">
                  <div className="ta-avatar">{getInitials(app.full_name)}</div>
                  <div className="ta-applicant-info">
                    <span className="ta-name">
                      {app.full_name} <span className="ta-id-ref">#{app.user_student_id || app.student_id}</span>
                    </span>
                    <span className="ta-meta">
                      {app.department} • {app.email}
                    </span>
                    <span className="ta-email">Role: {app.role}</span>
                  </div>
                </div>

                {parseExpertise(app.expertise).length > 0 && (
                  <div className="ta-expertise">
                    <span className="ta-expertise-label">Expertise:</span>
                    {parseExpertise(app.expertise).map((skill, idx) => (
                      <span key={idx} className="ta-skill">{skill}</span>
                    ))}
                  </div>
                )}

                <div className="ta-reason">
                  <span className="ta-reason-label">Application Reason:</span>
                  <p className="ta-reason-text">"{app.reason}"</p>
                </div>

                {/* ── Document Thumbnails ── */}
                {app.documents && app.documents.length > 0 && (
                  <div className="ta-documents-section">
                    <span className="ta-docs-label">📄 Identity Documents</span>
                    <div className="ta-docs-grid">
                      {app.documents.map((doc) => (
                        <button
                          key={doc.document_id}
                          className="ta-doc-thumb-btn"
                          onClick={() => setPreviewDoc({ url: `${BASE_URL}/${doc.file_path}`, label: docLabel(doc.document_type) })}
                          title={`View ${docLabel(doc.document_type)}`}
                        >
                          <img
                            src={`${BASE_URL}/${doc.file_path}`}
                            alt={docLabel(doc.document_type)}
                            className="ta-doc-thumb-img"
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                          <span className="ta-doc-thumb-label">{docLabel(doc.document_type)}</span>
                          <span className="ta-doc-thumb-zoom">🔍 View</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {app.status === 'pending' && (
                <div className="ta-card-footer">
                  <button
                    className="ta-action primary"
                    disabled={actionLoading === app.application_id}
                    onClick={() => handleReview(app.application_id, 'approved')}
                  >
                    {actionLoading === app.application_id ? 'Processing...' : 'Approve'}
                  </button>
                  <button
                    className="ta-action ghost"
                    disabled={actionLoading === app.application_id}
                    onClick={() => handleReview(app.application_id, 'rejected')}
                  >
                    {actionLoading === app.application_id ? 'Processing...' : 'Reject'}
                  </button>
                </div>
              )}

              {(app.status === 'approved' || app.status === 'rejected') && (
                <div className="ta-card-footer">
                  <span className="ta-reviewed">
                    Reviewed {app.reviewed_at ? formatDate(app.reviewed_at) : ''}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Lightbox Modal ── */}
      {previewDoc && (
        <div className="ta-modal-overlay" onClick={() => setPreviewDoc(null)}>
          <div className="ta-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="ta-modal-header">
              <span className="ta-modal-title">{previewDoc.label}</span>
              <button className="ta-modal-close" onClick={() => setPreviewDoc(null)}>×</button>
            </div>
            <div className="ta-modal-body">
              <img src={previewDoc.url} alt={previewDoc.label} className="ta-modal-img" />
            </div>
            <div className="ta-modal-footer">
              <a href={previewDoc.url} target="_blank" rel="noreferrer" className="ta-modal-download-btn">
                ⬇ Open Full Size
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherApplications;
