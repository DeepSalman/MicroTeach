import React, { useState, useEffect, useMemo } from 'react';
import {
  fetchMasterTransactions,
  adjustUserBalance,
  previewBatchAdjustment,
  executeBatchAdjustment,
  fetchLedgerReconciliation,
  fetchUsers
} from './api';
import ChatModal from './ChatModal';
import './MasterData.css';

const DIRECTION_META = {
  credit: { label: 'Credit (+)', class: 'dir-credit', arrow: '↑' },
  debit: { label: 'Debit (-)', class: 'dir-debit', arrow: '↓' },
  escrow_hold: { label: 'Escrow Reserve', class: 'dir-hold', arrow: '•' },
  neutral: { label: 'Internal Transfer', class: 'dir-neutral', arrow: '↔' }
};

const MasterData = ({ user }) => {
  // Navigation tabs: 'ledger' | 'batch_adjust' | 'reconciliation'
  const [activeTab, setActiveTab] = useState('ledger');

  // ── Tab 1: Global Ledger ──
  const [transactions, setTransactions] = useState([]);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerPageSize, setLedgerPageSize] = useState(15);
  const [ledgerTotal, setLedgerTotal] = useState(0);
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState('all');
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerSort, setLedgerSort] = useState('newest');
  const [expandedTxId, setExpandedTxId] = useState(null);

  // ── Tab 2: Batch / Targeted Balance Tool ──
  const [allUsersList, setAllUsersList] = useState([]);
  const [batchAction, setBatchAction] = useState('debit'); // 'debit' | 'credit'
  const [batchTarget, setBatchTarget] = useState('student'); // 'student' | 'tutor' | 'both' | 'all_users' | 'admin' | 'specific'
  const [batchCalcMode, setBatchCalcMode] = useState('percentage'); // 'fixed' | 'percentage'
  const [batchValue, setBatchValue] = useState(5); // e.g. 5% or ৳50
  const [batchReason, setBatchReason] = useState('');
  const [batchFloorZero, setBatchFloorZero] = useState(true);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');

  // Preview state
  const [previewData, setPreviewData] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [confirmBatchModal, setConfirmBatchModal] = useState(false);
  const [executingBatch, setExecutingBatch] = useState(false);

  // ── Tab 3: Solvency Reconciliation ──
  const [reconciliation, setReconciliation] = useState(null);
  const [loadingReconciliation, setLoadingReconciliation] = useState(false);
  const [reconSearch, setReconSearch] = useState('');
  const [reconFilter, setReconFilter] = useState('all'); // 'all' | 'discrepancy' | 'balanced'

  // Modals & Action States
  const [adjustModal, setAdjustModal] = useState(null); // single user adjust
  const [chatUser, setChatUser] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadLedger();
    loadUsers();
  }, []);

  useEffect(() => {
    if (activeTab === 'ledger') loadLedger();
    if (activeTab === 'reconciliation') loadReconciliation();
    if (activeTab === 'batch_adjust') loadBatchPreview();
  }, [activeTab, ledgerPage, ledgerPageSize, ledgerTypeFilter, ledgerSort]);

  // Re-run batch preview when configuration changes
  useEffect(() => {
    if (activeTab === 'batch_adjust') {
      const timer = setTimeout(() => {
        loadBatchPreview();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [batchAction, batchTarget, batchCalcMode, batchValue, batchFloorZero, selectedUserIds]);

  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 4500);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  // Loaders
  const loadUsers = async () => {
    try {
      const res = await fetchUsers();
      setAllUsersList(res.data || []);
    } catch (err) {
      console.error('Failed to load user list:', err);
    }
  };

  const loadLedger = async () => {
    setLoadingLedger(true);
    try {
      const params = {
        page: ledgerPage,
        limit: ledgerPageSize,
        type: ledgerTypeFilter,
        search: ledgerSearch,
        sortBy: ledgerSort
      };
      const res = await fetchMasterTransactions(params);
      setTransactions(res.data.transactions || []);
      setLedgerTotal(res.data.pagination?.total || 0);
    } catch (err) {
      console.error('Failed to load ledger:', err);
      setFeedback({ type: 'error', message: 'Failed to fetch transaction ledger.' });
    } finally {
      setLoadingLedger(false);
    }
  };

  const loadReconciliation = async () => {
    setLoadingReconciliation(true);
    try {
      const res = await fetchLedgerReconciliation();
      setReconciliation(res.data || null);
    } catch (err) {
      console.error('Failed to load reconciliation:', err);
      setFeedback({ type: 'error', message: 'Failed to run ledger audit.' });
    } finally {
      setLoadingReconciliation(false);
    }
  };

  // Preview Batch Adjustment
  const loadBatchPreview = async () => {
    if (!batchValue || parseFloat(batchValue) <= 0) {
      setPreviewData(null);
      return;
    }
    if (batchTarget === 'specific' && selectedUserIds.length === 0) {
      setPreviewData(null);
      return;
    }

    setLoadingPreview(true);
    try {
      const payload = {
        target: batchTarget,
        user_ids: selectedUserIds,
        action: batchAction,
        calc_mode: batchCalcMode,
        value: parseFloat(batchValue),
        floor_zero: batchFloorZero
      };
      const res = await previewBatchAdjustment(payload);
      setPreviewData(res.data);
    } catch (err) {
      console.error('Failed to load batch preview:', err);
      setPreviewData(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  // Execute Batch Adjustment
  const handleExecuteBatch = async () => {
    if (!batchReason.trim()) {
      setFeedback({ type: 'error', message: 'Please enter a justification memo for this batch operation.' });
      return;
    }

    setExecutingBatch(true);
    try {
      const payload = {
        target: batchTarget,
        user_ids: selectedUserIds,
        action: batchAction,
        calc_mode: batchCalcMode,
        value: parseFloat(batchValue),
        reason: batchReason.trim(),
        admin_id: user?.user_id,
        floor_zero: batchFloorZero
      };
      const res = await executeBatchAdjustment(payload);
      setFeedback({ type: 'success', message: res.data.message });
      setConfirmBatchModal(false);
      setBatchReason('');
      loadBatchPreview();
      loadLedger();
    } catch (err) {
      const raw = err.response?.data?.message || err.response?.data?.error || err.message;
      setFeedback({ type: 'error', message: typeof raw === 'string' ? raw : 'Failed to execute batch adjustment.' });
    } finally {
      setExecutingBatch(false);
    }
  };

  // Single User Balance Adjustment
  const handleExecuteSingleAdjustment = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await adjustUserBalance({
        ...adjustModal,
        admin_id: user?.user_id
      });
      setFeedback({ type: 'success', message: res.data.message });
      setAdjustModal(null);
      if (activeTab === 'reconciliation') loadReconciliation();
      if (activeTab === 'ledger') loadLedger();
      if (activeTab === 'batch_adjust') loadBatchPreview();
    } catch (err) {
      const raw = err.response?.data?.message || err.response?.data?.error || err.message;
      setFeedback({ type: 'error', message: typeof raw === 'string' ? raw : 'Failed to adjust balance.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Export Ledger CSV
  const exportLedgerCSV = () => {
    if (transactions.length === 0) {
      setFeedback({ type: 'error', message: 'No transaction entries to export.' });
      return;
    }

    const headers = [
      'Transaction ID',
      'Created At',
      'User ID',
      'User Name',
      'Email',
      'Role',
      'Department',
      'Type Code',
      'Type Name',
      'Direction',
      'Amount (BDT)',
      'Balance After',
      'Reference ID',
      'Description'
    ];

    const rows = transactions.map(t => [
      t.transaction_id,
      t.created_at ? new Date(t.created_at).toISOString() : '',
      t.user_id,
      `"${(t.full_name || '').replace(/"/g, '""')}"`,
      `"${(t.email || '').replace(/"/g, '""')}"`,
      t.role || 'student',
      `"${(t.department || '').replace(/"/g, '""')}"`,
      t.type,
      `"${(t.type_name || t.type).replace(/"/g, '""')}"`,
      t.direction || 'neutral',
      parseFloat(t.amount || 0).toFixed(2),
      parseFloat(t.balance_after || 0).toFixed(2),
      t.reference_id || '',
      `"${(t.description || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `microteach_ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Filtered Reconciliation Rows
  const filteredAudits = useMemo(() => {
    if (!reconciliation?.userAudits) return [];
    return reconciliation.userAudits.filter(u => {
      if (reconFilter === 'discrepancy' && !u.discrepancy) return false;
      if (reconFilter === 'balanced' && u.discrepancy) return false;
      if (reconSearch.trim()) {
        const q = reconSearch.toLowerCase().trim();
        const matchName = (u.full_name || '').toLowerCase().includes(q);
        const matchEmail = (u.email || '').toLowerCase().includes(q);
        const matchId = String(u.student_id || u.user_id).includes(q);
        if (!matchName && !matchEmail && !matchId) return false;
      }
      return true;
    });
  }, [reconciliation, reconFilter, reconSearch]);

  const totalDiscrepancies = useMemo(() => {
    if (!reconciliation?.userAudits) return 0;
    return reconciliation.userAudits.filter(u => u.discrepancy).length;
  }, [reconciliation]);

  // Filtered User Picker for specific target
  const filteredUsersPicker = useMemo(() => {
    if (!userSearchQuery.trim()) return allUsersList.slice(0, 20);
    const q = userSearchQuery.toLowerCase().trim();
    return allUsersList.filter(u =>
      (u.full_name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      String(u.student_id || '').includes(q)
    ).slice(0, 30);
  }, [allUsersList, userSearchQuery]);

  const toggleSelectUser = (id) => {
    setSelectedUserIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="md-page">
      {/* ── Header ── */}
      <div className="md-header">
        <div className="md-header-left">
          <h1 className="md-title">Master Data &amp; Financial Ledger</h1>
          <p className="md-subtitle">
            Audit platform transactions, execute targeted mass balance operations, and reconcile wallets.
          </p>
        </div>

        <div className="md-header-actions">
          {activeTab === 'ledger' && (
            <button
              type="button"
              className="md-btn-outline"
              onClick={exportLedgerCSV}
              title="Export Ledger CSV"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Export CSV</span>
            </button>
          )}

          <button
            type="button"
            className="md-btn-primary"
            onClick={() => setActiveTab('batch_adjust')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Batch Balance Tool</span>
          </button>

          <button
            type="button"
            className="md-btn-outline"
            onClick={() => {
              if (activeTab === 'ledger') loadLedger();
              if (activeTab === 'reconciliation') loadReconciliation();
              if (activeTab === 'batch_adjust') loadBatchPreview();
            }}
            title="Refresh current view"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 4v6h-6" />
              <path d="M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ── Toast Feedback ── */}
      {feedback && (
        <div className={`md-toast ${feedback.type}`}>
          <span>{feedback.message}</span>
          <button type="button" className="md-toast-close" onClick={() => setFeedback(null)}>&times;</button>
        </div>
      )}

      {/* ── Main Tab Navigation ── */}
      <div className="md-tabs">
        <button
          type="button"
          className={`md-tab ${activeTab === 'ledger' ? 'active' : ''}`}
          onClick={() => setActiveTab('ledger')}
        >
          <span>Transaction Ledger</span>
          <span className="md-tab-badge">{ledgerTotal || 0}</span>
        </button>

        <button
          type="button"
          className={`md-tab ${activeTab === 'batch_adjust' ? 'active' : ''}`}
          onClick={() => setActiveTab('batch_adjust')}
        >
          <span>Mass Balance Operations</span>
          <span className="md-tab-badge highlight">New</span>
        </button>

        <button
          type="button"
          className={`md-tab ${activeTab === 'reconciliation' ? 'active' : ''}`}
          onClick={() => setActiveTab('reconciliation')}
        >
          <span>Wallet Reconciliation</span>
          {totalDiscrepancies > 0 && (
            <span className="md-tab-badge alert">{totalDiscrepancies}</span>
          )}
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          TAB 1: GLOBAL TRANSACTION LEDGER (COLLAPSIBLE ROWS)
         ══════════════════════════════════════════════════════════════ */}
      {activeTab === 'ledger' && (
        <div className="md-tab-pane">
          {/* Controls Bar */}
          <div className="md-filter-card">
            <div className="md-search-box">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search user, email, student ID, post #ref, or description..."
                value={ledgerSearch}
                onChange={(e) => { setLedgerSearch(e.target.value); setLedgerPage(1); }}
                onKeyDown={(e) => { if (e.key === 'Enter') loadLedger(); }}
              />
              {ledgerSearch && (
                <button type="button" className="md-clear-btn" onClick={() => { setLedgerSearch(''); setTimeout(loadLedger, 50); }}>
                  &times;
                </button>
              )}
            </div>

            <div className="md-controls-row">
              <select
                className="md-select"
                value={ledgerTypeFilter}
                onChange={(e) => { setLedgerTypeFilter(e.target.value); setLedgerPage(1); }}
              >
                <option value="all">All Transaction Types</option>
                <option value="top_up">Top Up</option>
                <option value="bounty_held">Bounty Held (Escrow)</option>
                <option value="bounty_received">Bounty Received (Payout)</option>
                <option value="refund">Refund</option>
                <option value="admin_adjustment">Admin Adjustment</option>
                <option value="withdrawal">Withdrawal</option>
              </select>

              <select
                className="md-select"
                value={ledgerSort}
                onChange={(e) => { setLedgerSort(e.target.value); setLedgerPage(1); }}
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="amount_desc">Highest Amount</option>
                <option value="amount_asc">Lowest Amount</option>
              </select>

              <button
                type="button"
                className="md-btn-filter"
                onClick={loadLedger}
                disabled={loadingLedger}
              >
                {loadingLedger ? 'Querying...' : 'Filter'}
              </button>
            </div>
          </div>

          {/* Collapsible Ledger Table */}
          <div className="md-table-card">
            <table className="md-table">
              <thead>
                <tr>
                  <th style={{ width: '85px' }}>ID</th>
                  <th style={{ width: '130px' }}>Date</th>
                  <th>User</th>
                  <th>Type</th>
                  <th style={{ width: '90px' }}>Reference</th>
                  <th style={{ width: '110px', textAlign: 'right' }}>Amount</th>
                  <th style={{ width: '115px', textAlign: 'right' }}>Balance After</th>
                  <th style={{ width: '90px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {loadingLedger ? (
                  <tr>
                    <td colSpan="8" className="md-table-empty">Loading transaction ledger...</td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="md-table-empty">No transactions found matching your criteria.</td>
                  </tr>
                ) : (
                  transactions.map(t => {
                    const dirMeta = DIRECTION_META[t.direction] || DIRECTION_META.neutral;
                    const amt = parseFloat(t.amount || 0);
                    const bal = parseFloat(t.balance_after || 0);
                    const isCredit = t.direction === 'credit';
                    const isDebit = t.direction === 'debit';
                    const isExpanded = expandedTxId === t.transaction_id;

                    return (
                      <React.Fragment key={t.transaction_id}>
                        <tr
                          className={`md-row ${isExpanded ? 'expanded' : ''}`}
                          onClick={() => setExpandedTxId(isExpanded ? null : t.transaction_id)}
                        >
                          <td className="td-id">
                            <span className="md-mono-pill">#TX-{String(t.transaction_id).padStart(4, '0')}</span>
                          </td>

                          <td className="td-date">
                            <div className="md-date-stack">
                              <span className="md-date-primary">
                                {new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </span>
                              <span className="md-date-sub">
                                {new Date(t.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </td>

                          <td className="td-user">
                            <div className="md-user-stack">
                              <span className="md-user-name" title={t.full_name}>{t.full_name}</span>
                              <span className="md-user-sub">
                                {t.student_id ? `#${t.student_id}` : t.email}
                              </span>
                            </div>
                          </td>

                          <td className="td-type">
                            <span className={`md-type-pill ${dirMeta.class}`}>
                              <span className="md-dir-arrow">{dirMeta.arrow}</span>
                              <span>{t.type_name || t.type}</span>
                            </span>
                          </td>

                          <td className="td-ref">
                            {t.reference_id ? (
                              <span className="md-ref-badge">Post #{t.reference_id}</span>
                            ) : (
                              <span className="md-muted">—</span>
                            )}
                          </td>

                          <td className="td-amount">
                            <span className={`md-amt-badge ${isCredit ? 'credit' : isDebit ? 'debit' : 'hold'}`}>
                              {isCredit ? '+' : isDebit ? '-' : ''}৳{amt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </td>

                          <td className="td-balance">
                            <span className="md-bal-text">
                              ৳{bal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </td>

                          <td className="td-action" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              className={`md-expand-btn ${isExpanded ? 'active' : ''}`}
                              onClick={() => setExpandedTxId(isExpanded ? null : t.transaction_id)}
                              aria-label="Inspect transaction"
                            >
                              <span>{isExpanded ? 'Close' : 'Inspect'}</span>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`md-chevron ${isExpanded ? 'rotate' : ''}`}>
                                <polyline points="6 9 12 15 18 9" />
                              </svg>
                            </button>
                          </td>
                        </tr>

                        {/* Collapsible Row Drawer */}
                        {isExpanded && (
                          <tr className="md-drawer-row">
                            <td colSpan="8" className="md-drawer-td">
                              <div className="md-drawer">
                                {/* Left Section: Transaction Info */}
                                <div className="md-drawer-col info">
                                  <div className="md-card-section">
                                    <h4 className="md-section-title">Transaction Information</h4>
                                    <div className="md-meta-grid">
                                      <div className="md-meta-item">
                                        <span className="md-meta-k">System Type Code</span>
                                        <span className="md-meta-v mono">{t.type}</span>
                                      </div>
                                      <div className="md-meta-item">
                                        <span className="md-meta-k">Flow Direction</span>
                                        <span className="md-meta-v">{dirMeta.label}</span>
                                      </div>
                                      <div className="md-meta-item">
                                        <span className="md-meta-k">Operational Category</span>
                                        <span className="md-meta-v">{t.category || 'General'}</span>
                                      </div>
                                      <div className="md-meta-item">
                                        <span className="md-meta-k">Reference Post</span>
                                        <span className="md-meta-v">{t.reference_id ? `Post #${t.reference_id}` : 'General / Wallet'}</span>
                                      </div>
                                    </div>

                                    {t.description && (
                                      <div className="md-desc-box">
                                        <span className="md-meta-k">Audit Description</span>
                                        <p>{t.description}</p>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Right Section: Account & Quick Tools */}
                                <div className="md-drawer-col tools">
                                  <div className="md-card-section">
                                    <h4 className="md-section-title">Account Holder &amp; Tools</h4>
                                    <div className="md-user-profile-strip">
                                      <div className="md-profile-info">
                                        <span className="md-profile-name">{t.full_name}</span>
                                        <span className="md-profile-sub">
                                          {t.email} {t.student_id ? `• ID #${t.student_id}` : ''} {t.department ? `• ${t.department}` : ''}
                                        </span>
                                      </div>
                                      <div className="md-profile-balance">
                                        <span className="md-meta-k">Current Wallet Balance</span>
                                        <strong className="md-live-bal">
                                          ৳{parseFloat(t.current_user_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </strong>
                                      </div>
                                    </div>

                                    <div className="md-tool-actions">
                                      <button
                                        type="button"
                                        className="md-btn-tool-chat"
                                        onClick={() => setChatUser({ user_id: t.user_id, full_name: t.full_name })}
                                      >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                        </svg>
                                        <span>Message User</span>
                                      </button>

                                      <button
                                        type="button"
                                        className="md-btn-tool-adjust"
                                        onClick={() => setAdjustModal({
                                          user_id: t.user_id,
                                          name: t.full_name,
                                          balance: t.current_user_balance,
                                          amount: '',
                                          direction: 'credit',
                                          reason: ''
                                        })}
                                      >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                          <line x1="12" y1="5" x2="12" y2="19" />
                                          <line x1="5" y1="12" x2="19" y2="12" />
                                        </svg>
                                        <span>Adjust Balance</span>
                                      </button>
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

          {/* Pagination */}
          <div className="md-pagination">
            <div className="md-page-info">
              Showing <strong>{transactions.length === 0 ? 0 : (ledgerPage - 1) * ledgerPageSize + 1}</strong> to{' '}
              <strong>{Math.min(ledgerPage * ledgerPageSize, ledgerTotal)}</strong> of{' '}
              <strong>{ledgerTotal}</strong> records
            </div>

            <div className="md-page-controls">
              <button
                type="button"
                className="md-page-btn"
                disabled={ledgerPage <= 1}
                onClick={() => setLedgerPage(prev => Math.max(prev - 1, 1))}
              >
                Previous
              </button>
              <span className="md-page-current">Page {ledgerPage}</span>
              <button
                type="button"
                className="md-page-btn"
                disabled={ledgerPage * ledgerPageSize >= ledgerTotal}
                onClick={() => setLedgerPage(prev => prev + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          TAB 2: MASS / TARGETED BALANCE OPERATIONS (NEW REQUESTED FEATURE)
         ══════════════════════════════════════════════════════════════ */}
      {activeTab === 'batch_adjust' && (
        <div className="md-tab-pane">
          <div className="md-batch-layout">
            {/* Left Configuration Panel */}
            <div className="md-batch-config-card">
              <h3 className="md-batch-card-title">Configure Balance Operation</h3>
              <p className="md-batch-card-subtitle">
                Add or deduct funds across specific user groups or selected accounts.
              </p>

              {/* 1. Operation Direction */}
              <div className="md-form-field">
                <label>Operation Type</label>
                <div className="md-segment-group">
                  <button
                    type="button"
                    className={`md-segment-btn debit ${batchAction === 'debit' ? 'active' : ''}`}
                    onClick={() => setBatchAction('debit')}
                  >
                    Deduct Funds (Debit)
                  </button>
                  <button
                    type="button"
                    className={`md-segment-btn credit ${batchAction === 'credit' ? 'active' : ''}`}
                    onClick={() => setBatchAction('credit')}
                  >
                    Add Funds (Credit)
                  </button>
                </div>
              </div>

              {/* 2. Target Audience */}
              <div className="md-form-field">
                <label>Target Group</label>
                <select
                  className="md-select full"
                  value={batchTarget}
                  onChange={(e) => setBatchTarget(e.target.value)}
                >
                  <option value="student">Students Only (role: student)</option>
                  <option value="tutor">Tutors Only (role: tutor)</option>
                  <option value="both">Both Students &amp; Tutors (role: both)</option>
                  <option value="all_users">All Campus Users (Non-admins)</option>
                  <option value="admin">Administrators Only</option>
                  <option value="specific">Specific Selected Accounts</option>
                </select>
              </div>

              {/* Specific user selection if target === 'specific' */}
              {batchTarget === 'specific' && (
                <div className="md-specific-picker-box">
                  <label className="md-meta-k">Select Target Accounts ({selectedUserIds.length} Selected)</label>
                  <input
                    type="text"
                    className="md-user-search-input"
                    placeholder="Search user name, email, or student ID..."
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                  />

                  <div className="md-users-chips-container">
                    {filteredUsersPicker.map(u => {
                      const isSel = selectedUserIds.includes(u.user_id);
                      return (
                        <div
                          key={u.user_id}
                          className={`md-user-chip ${isSel ? 'selected' : ''}`}
                          onClick={() => toggleSelectUser(u.user_id)}
                        >
                          <input type="checkbox" checked={isSel} readOnly />
                          <span className="md-chip-name">{u.full_name}</span>
                          <span className="md-chip-role">({u.role})</span>
                          <span className="md-chip-bal">৳{parseFloat(u.wallet_balance || 0).toFixed(0)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 3. Calculation Mode & Amount */}
              <div className="md-form-row">
                <div className="md-form-field">
                  <label>Calculation Method</label>
                  <select
                    className="md-select full"
                    value={batchCalcMode}
                    onChange={(e) => setBatchCalcMode(e.target.value)}
                  >
                    <option value="percentage">Percentage (%) of Current Balance</option>
                    <option value="fixed">Fixed Amount (৳)</option>
                  </select>
                </div>

                <div className="md-form-field">
                  <label>
                    {batchCalcMode === 'percentage' ? 'Percentage Rate (%)' : 'Amount in BDT (৳)'}
                  </label>
                  <input
                    type="number"
                    step={batchCalcMode === 'percentage' ? '0.5' : '1'}
                    min="0.01"
                    className="md-input-val"
                    value={batchValue}
                    onChange={(e) => setBatchValue(e.target.value)}
                    placeholder={batchCalcMode === 'percentage' ? 'e.g. 5%' : 'e.g. 100'}
                  />
                </div>
              </div>

              {/* 4. Safety Floor */}
              {batchAction === 'debit' && (
                <div className="md-checkbox-row">
                  <label className="md-check-label">
                    <input
                      type="checkbox"
                      checked={batchFloorZero}
                      onChange={(e) => setBatchFloorZero(e.target.checked)}
                    />
                    <span>Protect against negative balance (floor deduction at ৳0.00)</span>
                  </label>
                </div>
              )}

              {/* 5. Audit Reason */}
              <div className="md-form-field full">
                <label>Audit Memo / Formal Justification (Mandatory)</label>
                <textarea
                  rows="2"
                  required
                  className="md-textarea"
                  placeholder="e.g. Semester platform maintenance fee, bonus credit grant, etc."
                  value={batchReason}
                  onChange={(e) => setBatchReason(e.target.value)}
                />
              </div>

              <div className="md-batch-action-row">
                <button
                  type="button"
                  className={`md-btn-execute ${batchAction}`}
                  disabled={!previewData || previewData.total_users === 0 || !batchReason.trim() || loadingPreview}
                  onClick={() => setConfirmBatchModal(true)}
                >
                  {batchAction === 'debit' ? 'Execute Batch Deduction' : 'Execute Batch Addition'}
                </button>
              </div>
            </div>

            {/* Right Live Impact Preview */}
            <div className="md-batch-preview-card">
              <div className="md-preview-header">
                <div>
                  <h3 className="md-batch-card-title">Live Impact Preview</h3>
                  <span className="md-preview-subtitle">
                    Calculated in real-time based on live wallet balances
                  </span>
                </div>
                {loadingPreview && <span className="md-preview-loading">Calculating...</span>}
              </div>

              {previewData ? (
                <>
                  <div className="md-preview-kpis">
                    <div className="md-pkpi">
                      <span className="md-pkpi-k">Affected Accounts</span>
                      <strong className="md-pkpi-v">{previewData.total_users}</strong>
                    </div>

                    <div className="md-pkpi">
                      <span className="md-pkpi-k">Total Current Holdings</span>
                      <strong className="md-pkpi-v">
                        ৳{previewData.total_current_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </strong>
                    </div>

                    <div className="md-pkpi">
                      <span className="md-pkpi-k">
                        Total {batchAction === 'debit' ? 'Deduction' : 'Addition'}
                      </span>
                      <strong className={`md-pkpi-v ${batchAction === 'debit' ? 'debit' : 'credit'}`}>
                        {batchAction === 'debit' ? '-' : '+'}৳{previewData.total_adjustment_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </strong>
                    </div>
                  </div>

                  {/* Impacted User Table */}
                  <div className="md-preview-table-wrap">
                    <table className="md-preview-table">
                      <thead>
                        <tr>
                          <th>Account</th>
                          <th>Role</th>
                          <th style={{ textAlign: 'right' }}>Current Balance</th>
                          <th style={{ textAlign: 'right' }}>Adjustment</th>
                          <th style={{ textAlign: 'right' }}>Projected Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.preview.map(u => (
                          <tr key={u.user_id}>
                            <td>
                              <span className="md-user-name">{u.full_name}</span>
                              <span className="md-user-sub">{u.student_id ? `#${u.student_id}` : u.email}</span>
                            </td>
                            <td><span className="md-role-tag">{u.role}</span></td>
                            <td style={{ textAlign: 'right' }}>৳{u.current_balance.toFixed(2)}</td>
                            <td style={{ textAlign: 'right' }} className={batchAction === 'debit' ? 'text-danger' : 'text-success'}>
                              {batchAction === 'debit' ? '-' : '+'}৳{u.adjustment_amount.toFixed(2)}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: '700' }}>
                              ৳{u.new_balance.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="md-preview-empty">
                  {batchTarget === 'specific' && selectedUserIds.length === 0
                    ? 'Please select one or more accounts to calculate preview.'
                    : 'Enter an amount or percentage above to preview impact.'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          TAB 3: SOLVENCY RECONCILIATION & BALANCE AUDITOR
         ══════════════════════════════════════════════════════════════ */}
      {activeTab === 'reconciliation' && (
        <div className="md-tab-pane">
          {loadingReconciliation ? (
            <div className="md-table-empty">Running ledger solvency audit...</div>
          ) : !reconciliation ? (
            <div className="md-table-empty">Unable to fetch reconciliation data.</div>
          ) : (
            <>
              {/* Summary KPIs */}
              <div className="md-kpi-grid">
                <div className="md-kpi-card">
                  <span className="md-kpi-lbl">Total User Wallet Liabilities</span>
                  <h3 className="md-kpi-val">৳{reconciliation.totalBalances.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h3>
                  <span className="md-kpi-sub">{reconciliation.userCount} user accounts enrolled</span>
                </div>
                <div className="md-kpi-card">
                  <span className="md-kpi-lbl">Lifetime Deposits Inflow</span>
                  <h3 className="md-kpi-val credit">৳{parseFloat(reconciliation.flows.total_deposits || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h3>
                  <span className="md-kpi-sub">Total top-ups</span>
                </div>
                <div className="md-kpi-card">
                  <span className="md-kpi-lbl">Tutor Earned Payouts</span>
                  <h3 className="md-kpi-val">৳{parseFloat(reconciliation.flows.total_payouts || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h3>
                  <span className="md-kpi-sub">Completed tutoring payments</span>
                </div>
                <div className="md-kpi-card">
                  <span className="md-kpi-lbl">Current Escrow Reserve</span>
                  <h3 className="md-kpi-val hold">৳{parseFloat(reconciliation.flows.total_held || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h3>
                  <span className="md-kpi-sub">Locked in ongoing sessions</span>
                </div>
              </div>

              {/* Audit Filter Controls */}
              <div className="md-filter-card">
                <div className="md-search-box">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search account name, email, or student ID..."
                    value={reconSearch}
                    onChange={(e) => setReconSearch(e.target.value)}
                  />
                  {reconSearch && (
                    <button type="button" className="md-clear-btn" onClick={() => setReconSearch('')}>
                      &times;
                    </button>
                  )}
                </div>

                <div className="md-controls-row">
                  <select
                    className="md-select"
                    value={reconFilter}
                    onChange={(e) => setReconFilter(e.target.value)}
                  >
                    <option value="all">All Accounts ({reconciliation.userAudits.length})</option>
                    <option value="discrepancy">Discrepancies Only ({totalDiscrepancies})</option>
                    <option value="balanced">Balanced ({reconciliation.userAudits.length - totalDiscrepancies})</option>
                  </select>
                </div>
              </div>

              {/* Reconciliation Matrix Table */}
              <div className="md-table-card">
                <table className="md-table">
                  <thead>
                    <tr>
                      <th>Account User</th>
                      <th style={{ width: '90px' }}>Role</th>
                      <th style={{ width: '130px', textAlign: 'right' }}>Recorded Wallet</th>
                      <th style={{ width: '130px', textAlign: 'right' }}>Ledger Net Sum</th>
                      <th style={{ width: '90px', textAlign: 'center' }}>Entries</th>
                      <th style={{ width: '140px', textAlign: 'center' }}>Audit Status</th>
                      <th style={{ width: '110px', textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAudits.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="md-table-empty">No account records matching criteria.</td>
                      </tr>
                    ) : (
                      filteredAudits.map(u => (
                        <tr key={u.user_id} className={`md-row ${u.discrepancy ? 'has-discrepancy' : ''}`}>
                          <td className="td-user">
                            <div className="md-user-stack">
                              <span className="md-user-name">{u.full_name}</span>
                              <span className="md-user-sub">
                                {u.email} {u.student_id ? `• #${u.student_id}` : ''}
                              </span>
                            </div>
                          </td>

                          <td className="td-role">
                            <span className="md-role-tag">{u.role}</span>
                          </td>

                          <td className="td-rec-bal" style={{ textAlign: 'right' }}>
                            <strong>৳{u.recorded_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                          </td>

                          <td className="td-ledger-bal" style={{ textAlign: 'right', fontFamily: 'var(--font-mono, monospace)' }}>
                            ৳{u.calculated_flow.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>

                          <td className="td-tx-count" style={{ textAlign: 'center' }}>
                            <span className="md-count-pill">{u.tx_count}</span>
                          </td>

                          <td className="td-status" style={{ textAlign: 'center' }}>
                            {u.discrepancy ? (
                              <span className="md-status-pill alert" title="Balance differs from transaction sum">
                                Discrepancy (Δ ৳{Math.abs(u.recorded_balance - u.calculated_flow).toFixed(2)})
                              </span>
                            ) : (
                              <span className="md-status-pill success">
                                Balanced
                              </span>
                            )}
                          </td>

                          <td className="td-action" style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              className="md-btn-quick-adjust"
                              onClick={() => setAdjustModal({
                                user_id: u.user_id,
                                name: u.full_name,
                                balance: u.recorded_balance,
                                amount: '',
                                direction: 'credit',
                                reason: ''
                              })}
                            >
                              Adjust
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          MODAL: CONFIRM BATCH BALANCE OPERATION
         ══════════════════════════════════════════════════════════════ */}
      {confirmBatchModal && previewData && (
        <div className="md-modal-overlay" onClick={() => !executingBatch && setConfirmBatchModal(false)}>
          <div className="md-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className={`md-modal-header ${batchAction === 'debit' ? 'danger' : ''}`}>
              <h3>
                Confirm Batch {batchAction === 'debit' ? 'Deduction' : 'Addition'}
              </h3>
              <button
                type="button"
                className="md-modal-close"
                onClick={() => setConfirmBatchModal(false)}
                disabled={executingBatch}
              >
                &times;
              </button>
            </div>

            <div className="md-modal-body">
              <p className="md-modal-p">
                You are about to execute a mass balance adjustment across <strong>{previewData.total_users}</strong> accounts.
              </p>

              <div className="md-confirm-summary-box">
                <div className="md-cs-row">
                  <span>Target Group:</span>
                  <strong>{batchTarget.toUpperCase()}</strong>
                </div>
                <div className="md-cs-row">
                  <span>Adjustment Rule:</span>
                  <strong>{batchCalcMode === 'percentage' ? `${batchValue}% of balance` : `৳${parseFloat(batchValue).toFixed(2)}`}</strong>
                </div>
                <div className="md-cs-row">
                  <span>Total Financial Impact:</span>
                  <strong className={batchAction === 'debit' ? 'text-danger' : 'text-success'}>
                    {batchAction === 'debit' ? '-' : '+'}৳{previewData.total_adjustment_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </strong>
                </div>
                <div className="md-cs-row">
                  <span>Audit Memo:</span>
                  <em>&ldquo;{batchReason}&rdquo;</em>
                </div>
              </div>

              <p className="md-confirm-warning">
                This operation will update user balances immediately and write an audited ledger transaction for each account.
              </p>
            </div>

            <div className="md-modal-footer">
              <button
                type="button"
                className="md-btn-outline"
                onClick={() => setConfirmBatchModal(false)}
                disabled={executingBatch}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`md-btn-primary ${batchAction === 'debit' ? 'danger' : ''}`}
                onClick={handleExecuteBatch}
                disabled={executingBatch}
              >
                {executingBatch ? 'Processing...' : `Confirm & Execute ${batchAction === 'debit' ? 'Deduction' : 'Addition'}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          MODAL: ADMIN SINGLE BALANCE ADJUSTMENT TOOL
         ══════════════════════════════════════════════════════════════ */}
      {adjustModal && (
        <div className="md-modal-overlay" onClick={() => setAdjustModal(null)}>
          <div className="md-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="md-modal-header">
              <h3>Adjust User Balance</h3>
              <button type="button" className="md-modal-close" onClick={() => setAdjustModal(null)}>&times;</button>
            </div>

            <form onSubmit={handleExecuteSingleAdjustment}>
              <div className="md-modal-body">
                <div className="md-adjust-summary">
                  <div><span>Target Account:</span> <strong>{adjustModal.name}</strong></div>
                  <div><span>Current Balance:</span> <strong>৳{parseFloat(adjustModal.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
                </div>

                <div className="md-form-row">
                  <div className="md-form-field">
                    <label>Adjustment Type</label>
                    <select
                      value={adjustModal.direction}
                      onChange={(e) => setAdjustModal(prev => ({ ...prev, direction: e.target.value }))}
                    >
                      <option value="credit">Credit (+) Add to balance</option>
                      <option value="debit">Debit (-) Deduct from balance</option>
                    </select>
                  </div>

                  <div className="md-form-field">
                    <label>Amount (৳)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="e.g. 250.00"
                      value={adjustModal.amount}
                      onChange={(e) => setAdjustModal(prev => ({ ...prev, amount: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="md-form-field full">
                  <label>Audit Memo / Reason</label>
                  <textarea
                    rows="3"
                    required
                    placeholder="Enter reason for manual adjustment (recorded in ledger)..."
                    value={adjustModal.reason}
                    onChange={(e) => setAdjustModal(prev => ({ ...prev, reason: e.target.value }))}
                  />
                </div>
              </div>

              <div className="md-modal-footer">
                <button type="button" className="md-btn-outline" onClick={() => setAdjustModal(null)}>Cancel</button>
                <button type="submit" className="md-btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'Executing...' : 'Post Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Chat Modal Integration ── */}
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

export default MasterData;
