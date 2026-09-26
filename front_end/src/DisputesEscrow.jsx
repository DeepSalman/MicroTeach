import React, { useState, useEffect } from 'react';
import { fetchTransactionDisputes, resolveTransactionDispute, updateTransactionDisputeStatus } from './api';
import './DisputesEscrow.css';

const DisputesEscrow = ({ user }) => {
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedResolutions, setSelectedResolutions] = useState({}); // { [dispute_id]: { type, splitPct, notes } }
  const [actionLoading, setActionLoading] = useState(null);
  const [feedback, setFeedback] = useState(null); // { type, message }

  useEffect(() => {
    loadDisputes();
  }, []);

  const loadDisputes = async () => {
    setLoading(true);
    try {
      const res = await fetchTransactionDisputes();
      setDisputes(res.data);
      // Initialize default resolution options for each dispute based on reporter's request
      const initRes = {};
      res.data.forEach(d => {
        initRes[d.dispute_id] = {
          type: d.dispute_type || 'full_refund',
          splitPct: d.split_percentage || 50,
          notes: ''
        };
      });
      setSelectedResolutions(initRes);
    } catch (err) {
      console.error('Failed to load transaction disputes:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleResolutionChange = (disputeId, field, value) => {
    setSelectedResolutions(prev => ({
      ...prev,
      [disputeId]: {
        ...(prev[disputeId] || {}),
        [field]: value
      }
    }));
  };

  const handleExecuteSettlement = async (disputeId) => {
    const config = selectedResolutions[disputeId] || { type: 'full_refund', splitPct: 50, notes: '' };
    setActionLoading(disputeId);
    setFeedback(null);
    try {
      const payload = {
        resolution_type: config.type,
        split_percentage: config.splitPct,
        resolution_notes: config.notes,
        admin_id: user?.user_id
      };
      const res = await resolveTransactionDispute(disputeId, payload);
      setFeedback({ type: 'success', message: res.data.message });
      // Update dispute in state
      setDisputes(prev => prev.map(d => {
        if (d.dispute_id === disputeId) {
          return {
            ...d,
            status: config.type === 'dismissed' ? 'dismissed' : 'resolved',
            resolution_type: config.type,
            resolution_notes: config.notes,
            resolved_at: new Date().toISOString()
          };
        }
        return d;
      }));
    } catch (err) {
      console.error('Settlement execution failed:', err);
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Failed to execute settlement.' });
    } finally {
      setActionLoading(null);
    }
  };

  // Metrics calculation
  const pendingDisputes = disputes.filter(d => d.status === 'pending' || d.status === 'under_review');
  const resolvedDisputes = disputes.filter(d => d.status === 'resolved');
  const dismissedDisputes = disputes.filter(d => d.status === 'dismissed');

  const totalEscrowInDispute = pendingDisputes.reduce((acc, d) => acc + (parseFloat(d.bounty) || 0), 0);

  // Filter tabs
  const tabs = [
    { key: 'all', label: 'All Disputes', count: disputes.length },
    { key: 'pending', label: 'Pending Review', count: pendingDisputes.length },
    { key: 'full_refund', label: 'Full Refund Claims', count: disputes.filter(d => d.dispute_type === 'full_refund').length },
    { key: 'split', label: 'Split Claims', count: disputes.filter(d => d.dispute_type === 'split').length },
    { key: 'full_payment', label: 'Full Payout Claims', count: disputes.filter(d => d.dispute_type === 'full_payment').length },
    { key: 'resolved', label: 'Resolved / Settled', count: resolvedDisputes.length }
  ];

  const filteredDisputes = disputes.filter(d => {
    if (activeTab === 'pending' && d.status !== 'pending' && d.status !== 'under_review') return false;
    if (activeTab === 'resolved' && d.status !== 'resolved') return false;
    if (['full_refund', 'split', 'full_payment'].includes(activeTab) && d.dispute_type !== activeTab) return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const caseId = `tx-disp-${String(d.dispute_id).padStart(4, '0')}`;
      const title = (d.post_title || '').toLowerCase();
      const code = (d.course_code || '').toLowerCase();
      const reporter = (d.reporter_name || '').toLowerCase();
      const respondent = (d.respondent_name || '').toLowerCase();
      if (!caseId.includes(q) && !title.includes(q) && !code.includes(q) && !reporter.includes(q) && !respondent.includes(q)) {
        return false;
      }
    }
    return true;
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getDisputeTypeLabel = (type) => {
    if (type === 'full_refund') return '🔄 Full Refund';
    if (type === 'split') return '⚖️ Compromise Split';
    if (type === 'full_payment') return '💰 Full Tutor Payout';
    return type;
  };

  return (
    <div className="admin-content">
      {/* Header */}
      <div className="page-header">
        <div className="page-header-left">
          <div className="breadcrumb">
            <span>Governance</span>
            <span className="breadcrumb-sep">›</span>
            <span>Integrity Council</span>
            <span className="breadcrumb-sep">›</span>
            <span className="breadcrumb-active">Disputes &amp; Escrow</span>
          </div>
          <h1 className="page-title">Disputes &amp; Escrow Arbitration</h1>
        </div>
        <div className="page-header-actions">
          <button className="btn-outline" onClick={loadDisputes}>
            <span className="btn-icon">🔄</span> Refresh Queue
          </button>
        </div>
      </div>

      {feedback && (
        <div className={`de-feedback-alert ${feedback.type}`}>
          <span>{feedback.type === 'success' ? '✅' : '⚠️'}</span>
          <span>{feedback.message}</span>
          <button className="de-alert-close" onClick={() => setFeedback(null)}>×</button>
        </div>
      )}

      {/* Stat Cards */}
      <div className="de-stats">
        <div className="de-stat-card">
          <span className="de-stat-label">Active Escrow in Dispute</span>
          <div className="de-stat-row">
            <span className="de-stat-icon">৳</span>
            <span className="de-stat-value">{totalEscrowInDispute.toLocaleString()}</span>
            <span className="de-stat-sub">{pendingDisputes.length} Active Case{pendingDisputes.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <div className="de-stat-card">
          <span className="de-stat-label">Pending Arbitration</span>
          <div className="de-stat-row">
            <span className="de-stat-value">{pendingDisputes.length}</span>
            <span className="de-stat-unit">cases</span>
            <span className="de-stat-sub">Requires Settlement</span>
          </div>
        </div>
        <div className="de-stat-card">
          <span className="de-stat-label">Total Resolved</span>
          <div className="de-stat-row">
            <span className="de-stat-value">{resolvedDisputes.length}</span>
            <span className="de-stat-unit">settled</span>
            <span className="de-stat-sub">{dismissedDisputes.length} Dismissed</span>
          </div>
        </div>
        <div className="de-stat-card">
          <span className="de-stat-label">Platform Integrity Rate</span>
          <div className="de-stat-row">
            <span className="de-stat-value">99.2%</span>
            <span className="de-stat-sub">Zero Escrow Loss</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="filter-bar">
        <div className="filter-tabs">
          {tabs.map(t => (
            <button
              key={t.key}
              className={`filter-tab ${activeTab === t.key ? 'active' : ''}`}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
              <span className="tab-count">{t.count}</span>
            </button>
          ))}
        </div>
        <div className="filter-controls">
          <div className="search-box">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search case ID, course, student..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="de-layout">
        {/* Dispute List / Queue */}
        <div className="de-main">
          {loading ? (
            <div className="de-loading">Loading transaction disputes from ledger...</div>
          ) : filteredDisputes.length === 0 ? (
            <div className="de-empty">
              <div className="de-empty-icon">🛡️</div>
              <h3>No transaction disputes found</h3>
              <p>There are no disputes matching the current filter criteria.</p>
            </div>
          ) : (
            filteredDisputes.map(item => {
              const caseId = `TX-DISP-${String(item.dispute_id).padStart(4, '0')}`;
              const bounty = parseFloat(item.bounty) || 0;
              const isResolved = item.status === 'resolved';
              const isDismissed = item.status === 'dismissed';
              const isPending = !isResolved && !isDismissed;

              const resState = selectedResolutions[item.dispute_id] || {
                type: item.dispute_type || 'full_refund',
                splitPct: item.split_percentage || 50,
                notes: ''
              };

              const studentShare = ((bounty * resState.splitPct) / 100).toFixed(2);
              const tutorShare = (bounty - parseFloat(studentShare)).toFixed(2);

              return (
                <div key={item.dispute_id} className={`de-card ${isResolved ? 'de-card--resolved' : ''} ${isDismissed ? 'de-card--dismissed' : ''}`}>
                  {/* Card Header */}
                  <div className="de-card-header">
                    <div className="de-card-header-left">
                      <span className="de-id">{caseId}</span>
                      <span className="de-dot">•</span>
                      <span className="de-course">{item.course_code}: {item.post_title}</span>
                      <span className="de-priority-badge">{getDisputeTypeLabel(item.dispute_type)}</span>
                    </div>
                    <div className="de-card-header-right">
                      <span className={`de-status-badge ${item.status}`}>
                        {item.status.toUpperCase()}
                      </span>
                      <span className="de-sla-timer">{formatDate(item.created_at)}</span>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="de-card-body">
                    {/* Parties Grid */}
                    <div className="de-parties">
                      {/* Reporter */}
                      <div className="de-party">
                        <div className="de-party-header">
                          <span className="de-party-role">
                            REPORTER ({item.reporter_role === 'student' ? 'Student' : 'Tutor'})
                          </span>
                          <span className="de-party-dept">{item.reporter_department || 'Student Dept'}</span>
                        </div>
                        <div className="de-party-name">
                          {item.reporter_name}
                          {item.reporter_student_id && <span className="de-party-id"> #{item.reporter_student_id}</span>}
                        </div>
                        <div className="de-party-meta">{item.reporter_email}</div>
                      </div>

                      {/* Respondent */}
                      <div className="de-party">
                        <div className="de-party-header">
                          <span className="de-party-role">
                            RESPONDENT ({item.reporter_role === 'student' ? 'Tutor' : 'Student'})
                          </span>
                          <span className="de-party-dept">{item.respondent_department || 'Respondent Dept'}</span>
                        </div>
                        <div className="de-party-name">
                          {item.respondent_name || 'Accepted Tutor / Counterparty'}
                          {item.respondent_student_id && <span className="de-party-id"> #{item.respondent_student_id}</span>}
                        </div>
                        <div className="de-party-meta">{item.respondent_email || 'Verified Campus Account'}</div>
                      </div>
                    </div>

                    {/* Dispute Reason & Narrative */}
                    <div className="de-narrative">
                      <div className="de-narrative-header">
                        <span className="de-narrative-label">Primary Issue:</span>
                        <span className="de-reason-pill">{item.reason}</span>
                      </div>
                      <p className="de-narrative-text">"{item.description}"</p>
                    </div>

                    {/* Evidence & Escrow Badge */}
                    <div className="de-evidence-row">
                      <div className="de-escrow-badge">
                        Contested Escrow: <strong>৳ {bounty} BDT</strong>
                        <span className="de-escrow-status">({isResolved ? 'Released' : 'Locked in Escrow'})</span>
                      </div>
                      {item.evidence_url && (
                        <a
                          href={item.evidence_url}
                          target="_blank"
                          rel="noreferrer"
                          className="de-evidence-link"
                        >
                          🔗 Open Evidence / Verification Link
                        </a>
                      )}
                    </div>

                    {/* Remedy Requested by Reporter */}
                    <div className="de-remedy-requested">
                      <span className="de-remedy-tag">Claimant Requested:</span>
                      <strong>
                        {item.dispute_type === 'full_refund' && `100% Full Refund (৳${bounty}) to Student`}
                        {item.dispute_type === 'split' && `Split Settlement (Student: ৳${item.proposed_refund_amount} / Tutor: ৳${item.proposed_payout_amount})`}
                        {item.dispute_type === 'full_payment' && `100% Full Payout (৳${bounty}) to Tutor`}
                      </strong>
                    </div>

                    {/* Adjudication Verdict & Execution (Active for Pending Cases) */}
                    {isPending && (
                      <div className="de-verdict">
                        <div className="de-verdict-header">
                          <span className="de-verdict-title">Arbitration Verdict &amp; Fund Allocation</span>
                          <span className="de-verdict-rec">Select Settlement Action:</span>
                        </div>

                        <div className="de-verdict-options">
                          {/* Option 1: Full Refund */}
                          <label
                            className={`de-verdict-option ${resState.type === 'full_refund' ? 'selected' : ''}`}
                            onClick={() => handleResolutionChange(item.dispute_id, 'type', 'full_refund')}
                          >
                            <input
                              type="radio"
                              name={`verdict_${item.dispute_id}`}
                              checked={resState.type === 'full_refund'}
                              onChange={() => handleResolutionChange(item.dispute_id, 'type', 'full_refund')}
                            />
                            <div className="de-option-content">
                              <span className="de-option-label">🔄 Full Student Refund</span>
                              <span className="de-option-amount">৳ {bounty} to Student</span>
                              <span className="de-option-note">100% return to poster wallet; tutor dismissed</span>
                            </div>
                          </label>

                          {/* Option 2: Split Settlement */}
                          <label
                            className={`de-verdict-option ${resState.type === 'split' ? 'selected' : ''}`}
                            onClick={() => handleResolutionChange(item.dispute_id, 'type', 'split')}
                          >
                            <input
                              type="radio"
                              name={`verdict_${item.dispute_id}`}
                              checked={resState.type === 'split'}
                              onChange={() => handleResolutionChange(item.dispute_id, 'type', 'split')}
                            />
                            <div className="de-option-content">
                              <span className="de-option-label">⚖️ Compromise Split</span>
                              <span className="de-option-amount">৳ {studentShare} / ৳ {tutorShare}</span>
                              <span className="de-option-note">{resState.splitPct}% Student, {100 - resState.splitPct}% Tutor</span>
                            </div>
                          </label>

                          {/* Option 3: Full Payout */}
                          <label
                            className={`de-verdict-option ${resState.type === 'full_payment' ? 'selected' : ''}`}
                            onClick={() => handleResolutionChange(item.dispute_id, 'type', 'full_payment')}
                          >
                            <input
                              type="radio"
                              name={`verdict_${item.dispute_id}`}
                              checked={resState.type === 'full_payment'}
                              onChange={() => handleResolutionChange(item.dispute_id, 'type', 'full_payment')}
                            />
                            <div className="de-option-content">
                              <span className="de-option-label">💰 Full Tutor Payout</span>
                              <span className="de-option-amount">৳ {bounty} to Tutor</span>
                              <span className="de-option-note">100% release to tutor wallet; post marked complete</span>
                            </div>
                          </label>

                          {/* Option 4: Dismiss */}
                          <label
                            className={`de-verdict-option ${resState.type === 'dismissed' ? 'selected' : ''}`}
                            onClick={() => handleResolutionChange(item.dispute_id, 'type', 'dismissed')}
                          >
                            <input
                              type="radio"
                              name={`verdict_${item.dispute_id}`}
                              checked={resState.type === 'dismissed'}
                              onChange={() => handleResolutionChange(item.dispute_id, 'type', 'dismissed')}
                            />
                            <div className="de-option-content">
                              <span className="de-option-label">🚫 Dismiss Dispute</span>
                              <span className="de-option-amount">No Funds Moved</span>
                              <span className="de-option-note">Claim deemed invalid or outside jurisdiction</span>
                            </div>
                          </label>
                        </div>

                        {/* Split Slider when Split selected */}
                        {resState.type === 'split' && (
                          <div className="de-admin-split-slider">
                            <div className="de-slider-header">
                              <span>Student Share: <strong>{resState.splitPct}% (৳{studentShare})</strong></span>
                              <span>Tutor Share: <strong>{100 - resState.splitPct}% (৳{tutorShare})</strong></span>
                            </div>
                            <input
                              type="range"
                              min="10"
                              max="90"
                              step="5"
                              value={resState.splitPct}
                              onChange={(e) => handleResolutionChange(item.dispute_id, 'splitPct', Number(e.target.value))}
                              className="de-slider-input"
                            />
                          </div>
                        )}

                        {/* Arbitrator Notes */}
                        <div className="de-notes-box">
                          <input
                            type="text"
                            placeholder="Arbitrator settlement notes (optional, entered into ledger)..."
                            value={resState.notes}
                            onChange={(e) => handleResolutionChange(item.dispute_id, 'notes', e.target.value)}
                            className="de-notes-input"
                          />
                        </div>
                      </div>
                    )}

                    {/* Resolved View */}
                    {(isResolved || isDismissed) && (
                      <div className="de-resolved-view">
                        <div className="de-resolved-badge">
                          <span>{isResolved ? '✅ Case Resolved & Settled' : '🚫 Case Dismissed'}</span>
                          <span className="de-resolved-type">Verdict: {item.resolution_type?.toUpperCase()}</span>
                        </div>
                        {item.resolution_notes && (
                          <div className="de-resolved-notes">
                            Notes: "{item.resolution_notes}"
                          </div>
                        )}
                        <div className="de-resolved-time">
                          Settled on {formatDate(item.resolved_at)}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card Footer Actions */}
                  {isPending && (
                    <div className="de-card-footer">
                      <button
                        className="de-action primary"
                        disabled={actionLoading === item.dispute_id}
                        onClick={() => handleExecuteSettlement(item.dispute_id)}
                      >
                        {actionLoading === item.dispute_id ? 'Executing Settlement...' : 'Execute Settlement'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Sidebar Status & Health */}
        <div className="de-sidebar">
          {/* Dispute SLA Watch */}
          <div className="de-sidebar-panel">
            <div className="de-panel-header">
              <h3 className="de-panel-title">Arbitration SLA Watch</h3>
              <span className="de-panel-sub">Target: &lt; 24h</span>
            </div>
            <div className="de-panel-body">
              <div className="de-sla-breach">
                <span className="de-sla-label">Pending Adjudication:</span>
                <span className="de-sla-time">{pendingDisputes.length} active</span>
              </div>
              <div className="de-sla-bar">
                <div
                  className="de-sla-bar-fill"
                  style={{ width: `${Math.min(100, pendingDisputes.length * 25)}%` }}
                />
              </div>
              <div className="de-severity-breakdown">
                <span className="de-severity-title">TOPIC BREAKDOWN</span>
                <div className="de-severity-row">
                  <span className="de-severity-label">Full Refund Claims</span>
                  <span className="de-severity-count">
                    {disputes.filter(d => d.dispute_type === 'full_refund').length}
                  </span>
                </div>
                <div className="de-severity-row">
                  <span className="de-severity-label">Compromise Split</span>
                  <span className="de-severity-count">
                    {disputes.filter(d => d.dispute_type === 'split').length}
                  </span>
                </div>
                <div className="de-severity-row">
                  <span className="de-severity-label">Full Payout Claims</span>
                  <span className="de-severity-count">
                    {disputes.filter(d => d.dispute_type === 'full_payment').length}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Gateway Health */}
          <div className="de-sidebar-panel">
            <div className="de-panel-header">
              <h3 className="de-panel-title">Escrow Vault Safeguards</h3>
              <span className="de-panel-status synced">Active</span>
            </div>
            <div className="de-panel-body">
              <div className="de-gateway-row">
                <span className="de-gateway-label">Internal Campus Escrow:</span>
                <span className="de-gateway-value connected">100% Liquid</span>
              </div>
              <div className="de-gateway-row">
                <span className="de-gateway-label">Double-Spend Protection:</span>
                <span className="de-gateway-value ready">Enabled</span>
              </div>
              <div className="de-gateway-row">
                <span className="de-gateway-label">Atomic Settlement:</span>
                <span className="de-gateway-value ready">Active</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DisputesEscrow;
