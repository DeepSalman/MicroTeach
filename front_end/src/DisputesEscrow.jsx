import React, { useState, useEffect, useMemo } from 'react';
import { fetchTransactionDisputes, resolveTransactionDispute, updateTransactionDisputeStatus } from './api';
import './DisputesEscrow.css';

const DisputesEscrow = ({ user }) => {
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [statusTab, setStatusTab] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [searchQuery, setSearchQuery] = useState('');

  // Expandable row state: set of expanded dispute IDs (or single active ID)
  const [expandedId, setExpandedId] = useState(null);

  // Resolution state per dispute
  const [resolutions, setResolutions] = useState({});
  const [actionLoading, setActionLoading] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    loadDisputes();
  }, []);

  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  const loadDisputes = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetchTransactionDisputes();
      const data = res.data || [];
      setDisputes(data);

      const initRes = {};
      data.forEach(d => {
        initRes[d.dispute_id] = {
          type: d.dispute_type || 'full_refund',
          splitPct: d.split_percentage || 50,
          notes: ''
        };
      });
      setResolutions(prev => ({ ...initRes, ...prev }));
    } catch (err) {
      console.error('Failed to load disputes:', err);
      setFeedback({ type: 'error', message: 'Failed to fetch disputes from ledger.' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleResolutionChange = (disputeId, field, value) => {
    setResolutions(prev => ({
      ...prev,
      [disputeId]: {
        ...(prev[disputeId] || { type: 'full_refund', splitPct: 50, notes: '' }),
        [field]: value
      }
    }));
  };

  const handleStatusChange = async (disputeId, newStatus) => {
    setActionLoading(disputeId);
    setFeedback(null);
    try {
      await updateTransactionDisputeStatus(disputeId, newStatus);
      setDisputes(prev => prev.map(d => (d.dispute_id === disputeId ? { ...d, status: newStatus } : d)));
      setFeedback({ type: 'success', message: `Case #TX-${String(disputeId).padStart(4, '0')} marked as ${newStatus.replace('_', ' ').toUpperCase()}.` });
    } catch (err) {
      console.error('Failed to update status:', err);
      const raw = err.response?.data?.message || err.response?.data?.error || err.message;
      const msg = typeof raw === 'string'
        ? raw
        : (raw?.message || (raw && typeof raw === 'object' ? JSON.stringify(raw) : null) || 'Failed to update status.');
      setFeedback({ type: 'error', message: msg });
    } finally {
      setActionLoading(null);
    }
  };

  const initiateSettlement = (item) => {
    const config = resolutions[item.dispute_id] || {
      type: item.dispute_type || 'full_refund',
      splitPct: item.split_percentage || 50,
      notes: ''
    };
    const bounty = parseFloat(item.bounty) || 0;
    const studentShare = ((bounty * config.splitPct) / 100).toFixed(2);
    const tutorShare = (bounty - parseFloat(studentShare)).toFixed(2);

    setConfirmModal({
      dispute: item,
      config,
      bounty,
      studentShare,
      tutorShare
    });
  };

  const executeConfirmedSettlement = async () => {
    if (!confirmModal) return;
    const { dispute, config } = confirmModal;
    const disputeId = dispute.dispute_id;

    setActionLoading(disputeId);
    setFeedback(null);
    setConfirmModal(null);

    try {
      const payload = {
        resolution_type: config.type,
        split_percentage: config.splitPct,
        resolution_notes: config.notes,
        admin_id: user?.user_id
      };
      const res = await resolveTransactionDispute(disputeId, payload);
      setFeedback({ type: 'success', message: res.data?.message || 'Settlement executed successfully.' });

      setDisputes(prev => prev.map(d => {
        if (d.dispute_id === disputeId) {
          return {
            ...d,
            status: config.type === 'dismissed' ? 'dismissed' : 'resolved',
            resolution_type: config.type,
            resolution_notes: config.notes,
            resolved_at: new Date().toISOString(),
            resolved_by: user?.user_id
          };
        }
        return d;
      }));
    } catch (err) {
      console.error('Settlement execution failed:', err);
      const raw = err.response?.data?.message || err.response?.data?.error || err.message;
      const msg = typeof raw === 'string'
        ? raw
        : (raw?.message || (raw && typeof raw === 'object' ? JSON.stringify(raw) : null) || 'Failed to execute settlement.');
      setFeedback({ type: 'error', message: msg });
    } finally {
      setActionLoading(null);
    }
  };

  // Metrics
  const pendingCount = useMemo(() => disputes.filter(d => d.status === 'pending').length, [disputes]);
  const reviewCount = useMemo(() => disputes.filter(d => d.status === 'under_review').length, [disputes]);
  const resolvedCount = useMemo(() => disputes.filter(d => d.status === 'resolved').length, [disputes]);
  const dismissedCount = useMemo(() => disputes.filter(d => d.status === 'dismissed').length, [disputes]);
  const totalLocked = useMemo(() => {
    return disputes
      .filter(d => d.status === 'pending' || d.status === 'under_review')
      .reduce((sum, d) => sum + (parseFloat(d.bounty) || 0), 0);
  }, [disputes]);

  const tabs = [
    { key: 'all', label: 'All', count: disputes.length },
    { key: 'pending', label: 'Pending', count: pendingCount },
    { key: 'under_review', label: 'Review', count: reviewCount },
    { key: 'resolved', label: 'Resolved', count: resolvedCount },
    { key: 'dismissed', label: 'Dismissed', count: dismissedCount }
  ];

  // Filtering
  const filteredDisputes = useMemo(() => {
    return disputes.filter(d => {
      if (statusTab !== 'all' && d.status !== statusTab) return false;
      if (typeFilter !== 'all' && d.dispute_type !== typeFilter) return false;
      if (roleFilter !== 'all' && d.reporter_role !== roleFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const rawId = String(d.dispute_id);
        const code = (d.course_code || '').toLowerCase();
        const title = (d.post_title || '').toLowerCase();
        const rep = (d.reporter_name || '').toLowerCase();
        const resp = (d.respondent_name || '').toLowerCase();
        const reason = (d.reason || '').toLowerCase();

        if (
          rawId !== q &&
          !code.includes(q) &&
          !title.includes(q) &&
          !rep.includes(q) &&
          !resp.includes(q) &&
          !reason.includes(q)
        ) {
          return false;
        }
      }
      return true;
    }).sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.created_at) - new Date(a.created_at);
      if (sortBy === 'oldest') return new Date(a.created_at) - new Date(b.created_at);
      if (sortBy === 'amount_high') return (parseFloat(b.bounty) || 0) - (parseFloat(a.bounty) || 0);
      if (sortBy === 'amount_low') return (parseFloat(a.bounty) || 0) - (parseFloat(b.bounty) || 0);
      return 0;
    });
  }, [disputes, statusTab, typeFilter, roleFilter, sortBy, searchQuery]);

  const hasActiveFilters = statusTab !== 'all' || typeFilter !== 'all' || roleFilter !== 'all' || searchQuery.trim() !== '';

  const resetFilters = () => {
    setStatusTab('all');
    setTypeFilter('all');
    setRoleFilter('all');
    setSortBy('newest');
    setSearchQuery('');
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'under_review': return 'Review';
      case 'resolved': return 'Resolved';
      case 'dismissed': return 'Dismissed';
      default: return status;
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case 'full_refund': return 'Full Refund';
      case 'split': return 'Split';
      case 'full_payment': return 'Full Payout';
      default: return type;
    }
  };

  return (
    <div className="admin-content de-minimal">
      {/* ── Header & Inline Stats ── */}
      <div className="de-min-header">
        <div className="de-min-title-group">
          <h1 className="de-min-title">Disputes &amp; Escrow</h1>
          <div className="de-min-stats-strip">
            <span className="de-stat-pill">
              Locked Escrow: <strong>৳{totalLocked.toLocaleString()}</strong>
            </span>
            <span className="de-stat-sep">&bull;</span>
            <span className="de-stat-pill">
              Pending: <strong>{pendingCount + reviewCount}</strong>
            </span>
            <span className="de-stat-sep">&bull;</span>
            <span className="de-stat-pill">
              Resolved: <strong>{resolvedCount}</strong>
            </span>
          </div>
        </div>

        <button
          className={`de-min-btn ${refreshing ? 'loading' : ''}`}
          onClick={() => loadDisputes(true)}
          disabled={refreshing}
          title="Refresh"
        >
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* ── Toast Feedback ── */}
      {feedback && (
        <div className={`de-min-toast ${feedback.type}`}>
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)}>&times;</button>
        </div>
      )}

      {/* ── Filter Bar ── */}
      <div className="de-min-filters">
        {/* Tabs */}
        <div className="de-min-tabs">
          {tabs.map(tab => (
            <button
              key={tab.key}
              className={`de-min-tab ${statusTab === tab.key ? 'active' : ''}`}
              onClick={() => setStatusTab(tab.key)}
            >
              {tab.label}
              <span className="de-tab-num">{tab.count}</span>
            </button>
          ))}
        </div>

        {/* Inputs */}
        <div className="de-min-filter-inputs">
          <div className="de-min-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Filter by ID, course, person..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="de-min-clear" onClick={() => setSearchQuery('')}>&times;</button>
            )}
          </div>

          <select
            className="de-min-select"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">All Types</option>
            <option value="full_refund">Full Refund</option>
            <option value="split">Split</option>
            <option value="full_payment">Full Payout</option>
          </select>

          <select
            className="de-min-select"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="all">All Roles</option>
            <option value="student">Student Claimant</option>
            <option value="tutor">Tutor Claimant</option>
          </select>

          <select
            className="de-min-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="amount_high">Highest ৳</option>
            <option value="amount_low">Lowest ৳</option>
          </select>

          {hasActiveFilters && (
            <button className="de-min-reset" onClick={resetFilters}>Reset</button>
          )}
        </div>
      </div>

      {/* ── Compact Disputes Table / List ── */}
      <div className="de-table-wrap">
        <table className="de-table">
          <thead>
            <tr>
              <th style={{ width: '80px' }}>ID</th>
              <th>Course &amp; Title</th>
              <th>Claimant &rarr; Counterparty</th>
              <th>Issue / Type</th>
              <th style={{ width: '90px' }}>Escrow</th>
              <th style={{ width: '95px' }}>Status</th>
              <th style={{ width: '70px' }}>Date</th>
              <th style={{ width: '80px', textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="8" className="de-empty-td">Loading disputes...</td>
              </tr>
            ) : filteredDisputes.length === 0 ? (
              <tr>
                <td colSpan="8" className="de-empty-td">No disputes matching criteria.</td>
              </tr>
            ) : (
              filteredDisputes.map(item => {
                const isExpanded = expandedId === item.dispute_id;
                const isResolved = item.status === 'resolved';
                const isDismissed = item.status === 'dismissed';
                const isPending = !isResolved && !isDismissed;
                const isUnderReview = item.status === 'under_review';
                const bounty = parseFloat(item.bounty) || 0;

                const resState = resolutions[item.dispute_id] || {
                  type: item.dispute_type || 'full_refund',
                  splitPct: item.split_percentage || 50,
                  notes: ''
                };
                const studentShare = ((bounty * resState.splitPct) / 100).toFixed(2);
                const tutorShare = (bounty - parseFloat(studentShare)).toFixed(2);

                return (
                  <React.Fragment key={item.dispute_id}>
                    <tr
                      className={`de-row ${isExpanded ? 'expanded' : ''} status-${item.status}`}
                      onClick={() => setExpandedId(isExpanded ? null : item.dispute_id)}
                    >
                      <td className="de-td-id">#TX-{String(item.dispute_id).padStart(4, '0')}</td>
                      <td className="de-td-title">
                        <span className="de-code-badge">{item.course_code || 'GIG'}</span>
                        <span className="de-item-title" title={item.post_title}>{item.post_title}</span>
                      </td>
                      <td className="de-td-parties">
                        <span className="de-party-strong">{item.reporter_name}</span>
                        <span className="de-arrow">&rarr;</span>
                        <span className="de-party-muted">{item.respondent_name || 'Counterparty'}</span>
                      </td>
                      <td className="de-td-type">
                        <span className="de-type-tag">{getTypeLabel(item.dispute_type)}</span>
                      </td>
                      <td className="de-td-escrow">৳{bounty.toLocaleString()}</td>
                      <td className="de-td-status">
                        <span className={`de-pill ${item.status}`}>
                          {getStatusLabel(item.status)}
                        </span>
                      </td>
                      <td className="de-td-date">{formatDate(item.created_at)}</td>
                      <td className="de-td-action" style={{ textAlign: 'right' }}>
                        <button
                          className={`de-expand-btn ${isExpanded ? "active" : ""}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedId(isExpanded ? null : item.dispute_id);
                          }}
                        >
                          {isExpanded ? 'Close' : isPending ? 'Arbitrate' : 'Details'}
                        </button>
                      </td>
                    </tr>

                    {/* Inline Expandable Drawer (Noticeable & Minimal) */}
                    {isExpanded && (
                      <tr className="de-detail-row">
                        <td colSpan="8">
                          <div className="de-detail-panel">
                            {/* Top Noticeable Summary Ribbon */}
                            <div className="de-detail-banner">
                              <div className="de-banner-left">
                                <span className="de-banner-id">#TX-{String(item.dispute_id).padStart(4, '0')}</span>
                                <span className="de-banner-course">{item.course_code || 'GIG'}</span>
                                <span className="de-banner-title">{item.post_title}</span>
                              </div>
                              <div className="de-banner-right">
                                <span className="de-banner-escrow">
                                  Contested Escrow: <strong>৳{bounty.toLocaleString()} BDT</strong>
                                </span>
                              </div>
                            </div>

                            <div className="de-detail-grid">
                              {/* Left Column: Key Facts & Narrative */}
                              <div className="de-detail-facts">
                                {/* Primary Issue & Remedy Card */}
                                <div className="de-key-issue-card">
                                  <div className="de-issue-header">
                                    <div className="de-issue-title-wrap">
                                      <span className="de-key-label">PRIMARY GRIEVANCE</span>
                                      <span className="de-key-reason">⚠️ {item.reason}</span>
                                    </div>
                                    {item.evidence_url && (
                                      <a
                                        href={item.evidence_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="de-evidence-chip"
                                        title="Open submitted proof link in new tab"
                                      >
                                        🔗 Supporting Evidence &nearr;
                                      </a>
                                    )}
                                  </div>

                                  <div className="de-remedy-strip">
                                    <span className="de-remedy-tag">Claimant Requested:</span>
                                    <strong className="de-remedy-val">
                                      {item.dispute_type === 'full_refund' && `100% Full Refund (৳${bounty}) to Student`}
                                      {item.dispute_type === 'split' && `Compromise Split (Student: ৳${item.proposed_refund_amount} / Tutor: ৳${item.proposed_payout_amount})`}
                                      {item.dispute_type === 'full_payment' && `100% Full Payout (৳${bounty}) to Tutor`}
                                    </strong>
                                  </div>
                                </div>

                                {/* Statement Quote */}
                                <div className="de-quote-box">
                                  <span className="de-quote-label">Claimant's Written Statement</span>
                                  <blockquote className="de-quote-body">
                                    "{item.description}"
                                  </blockquote>
                                </div>

                                {/* Parties Breakdown Card */}
                                <div className="de-parties-duo">
                                  <div className="de-duo-card claimant">
                                    <div className="de-duo-role">Claimant ({item.reporter_role === 'student' ? 'Student' : 'Tutor'})</div>
                                    <div className="de-duo-name">{item.reporter_name}</div>
                                    <div className="de-duo-email">{item.reporter_email}</div>
                                    {item.reporter_student_id && (
                                      <div className="de-duo-sub">ID: #{item.reporter_student_id} &bull; {item.reporter_department || 'Student'}</div>
                                    )}
                                  </div>

                                  <div className="de-duo-card respondent">
                                    <div className="de-duo-role">Counterparty ({item.reporter_role === 'student' ? 'Tutor' : 'Student'})</div>
                                    <div className="de-duo-name">{item.respondent_name || 'Accepted Tutor / Counterparty'}</div>
                                    <div className="de-duo-email">{item.respondent_email || 'Campus Verified Account'}</div>
                                    {item.respondent_student_id && (
                                      <div className="de-duo-sub">ID: #{item.respondent_student_id} &bull; {item.respondent_department || 'Peer'}</div>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Right Column: Adjudication Console */}
                              <div className="de-detail-action-side">
                                {isPending ? (
                                  <div className="de-adjudicate-box">
                                    <div className="de-adj-header">
                                      <div>
                                        <span className="de-adj-title">Adjudication Verdict</span>
                                        <span className="de-adj-sub">Select fund disbursement action</span>
                                      </div>
                                      <button
                                        type="button"
                                        className="de-under-review-btn"
                                        disabled={actionLoading === item.dispute_id}
                                        onClick={() => handleStatusChange(item.dispute_id, isUnderReview ? 'pending' : 'under_review')}
                                      >
                                        {isUnderReview ? 'Revert to Pending' : 'Mark Under Review'}
                                      </button>
                                    </div>

                                    {/* Noticeable Verdict Option Cards */}
                                    <div className="de-verdict-cards-grid">
                                      {[
                                        { key: 'full_refund', label: 'Full Student Refund', amount: `৳${bounty} to Student (100%)` },
                                        { key: 'split', label: 'Compromise Split', amount: `৳${studentShare} / ৳${tutorShare}` },
                                        { key: 'full_payment', label: 'Full Tutor Payout', amount: `৳${bounty} to Tutor (100%)` },
                                        { key: 'dismissed', label: 'Dismiss Dispute', amount: 'No Funds Transferred' }
                                      ].map(opt => (
                                        <label
                                          key={opt.key}
                                          className={`de-verdict-card ${resState.type === opt.key ? 'selected' : ''}`}
                                        >
                                          <input
                                            type="radio"
                                            name={`verdict_${item.dispute_id}`}
                                            checked={resState.type === opt.key}
                                            onChange={() => handleResolutionChange(item.dispute_id, 'type', opt.key)}
                                          />
                                          <div className="de-verdict-card-text">
                                            <span className="de-verdict-name">{opt.label}</span>
                                            <span className="de-verdict-amt">{opt.amount}</span>
                                          </div>
                                        </label>
                                      ))}
                                    </div>

                                    {/* Split Slider when selected */}
                                    {resState.type === 'split' && (
                                      <div className="de-slider-wrap">
                                        <div className="de-slider-labels">
                                          <span>Student: <strong>৳{studentShare} ({resState.splitPct}%)</strong></span>
                                          <span>Tutor: <strong>৳{tutorShare} ({100 - resState.splitPct}%)</strong></span>
                                        </div>
                                        <input
                                          type="range"
                                          min="10"
                                          max="90"
                                          step="5"
                                          value={resState.splitPct}
                                          onChange={(e) => handleResolutionChange(item.dispute_id, 'splitPct', Number(e.target.value))}
                                          className="de-slider"
                                        />
                                        <div className="de-slider-ticks">
                                          <span>10%</span>
                                          <span>50% (Equal)</span>
                                          <span>90%</span>
                                        </div>
                                      </div>
                                    )}

                                    {/* Ledger Notes */}
                                    <div className="de-notes-group">
                                      <label className="de-notes-label">Arbitrator Ledger Notes (Optional)</label>
                                      <input
                                        type="text"
                                        className="de-min-input"
                                        placeholder="Add settlement notes to the financial ledger..."
                                        value={resState.notes}
                                        onChange={(e) => handleResolutionChange(item.dispute_id, 'notes', e.target.value)}
                                      />
                                    </div>

                                    {/* Action Button */}
                                    <div className="de-adj-action-row">
                                      <button
                                        className="de-min-primary-btn"
                                        disabled={actionLoading === item.dispute_id}
                                        onClick={() => initiateSettlement(item)}
                                      >
                                        {actionLoading === item.dispute_id ? 'Settling...' : 'Review & Execute Settlement'}
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className={`de-settled-card ${isResolved ? 'resolved' : 'dismissed'}`}>
                                    <div className="de-settled-top">
                                      <div>
                                        <span className="de-settled-status">{isResolved ? '✅ Arbitrated & Closed' : '🚫 Dismissed'}</span>
                                        <h4 className="de-settled-heading">Verdict: {getTypeLabel(item.resolution_type)}</h4>
                                      </div>
                                      <span className="de-settled-date">{formatDate(item.resolved_at)}</span>
                                    </div>
                                    {item.resolution_notes && (
                                      <div className="de-settled-note-box">
                                        "{item.resolution_notes}"
                                      </div>
                                    )}
                                    <div className="de-settled-footer">
                                      <span>Recorded in campus audit ledger &bull; Case closed</span>
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

      {/* ── Confirmation Modal ── */}
      {confirmModal && (
        <div className="de-modal-overlay" onClick={() => setConfirmModal(null)}>
          <div className="de-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="de-modal-header">
              <h3>Confirm Settlement</h3>
              <button onClick={() => setConfirmModal(null)}>&times;</button>
            </div>
            <div className="de-modal-body">
              <p className="de-modal-warn">
                This will disburse <strong>৳{confirmModal.bounty}</strong> from platform escrow and update wallet balances.
              </p>
              <div className="de-modal-summary">
                <div>Case: <strong>#TX-{String(confirmModal.dispute.dispute_id).padStart(4, '0')}</strong></div>
                <div>Verdict: <strong>{getTypeLabel(confirmModal.config.type)}</strong></div>
                {confirmModal.config.type === 'split' && (
                  <div>Allocation: <strong>Student: ৳{confirmModal.studentShare} | Tutor: ৳{confirmModal.tutorShare}</strong></div>
                )}
              </div>
            </div>
            <div className="de-modal-actions">
              <button className="de-min-btn" onClick={() => setConfirmModal(null)}>Cancel</button>
              <button className="de-min-primary-btn" onClick={executeConfirmedSettlement}>Confirm &amp; Disburse</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DisputesEscrow;
