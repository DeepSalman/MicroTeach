import React, { useState, useEffect, useMemo } from 'react';
import {
  fetchMasterTransactionTypes,
  createOrUpdateTransactionType,
  toggleTransactionType,
  fetchMasterTransactions,
  fetchLedgerReconciliation,
  adjustUserBalance
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
  // Navigation tabs: 'ledger' | 'types' | 'reconciliation'
  const [activeTab, setActiveTab] = useState('ledger');

  // Tab 1: Global Ledger
  const [transactions, setTransactions] = useState([]);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerPageSize, setLedgerPageSize] = useState(15);
  const [ledgerTotal, setLedgerTotal] = useState(0);
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState('all');
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerSort, setLedgerSort] = useState('newest');
  const [ledgerTelemetry, setLedgerTelemetry] = useState({});
  const [expandedTxId, setExpandedTxId] = useState(null);

  // Tab 2: Transaction Types Registry
  const [types, setTypes] = useState([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [typeSearch, setTypeSearch] = useState('');
  const [typeCategoryFilter, setTypeCategoryFilter] = useState('all');
  const [expandedTypeId, setExpandedTypeId] = useState(null);

  // Tab 3: Solvency Reconciliation
  const [reconciliation, setReconciliation] = useState(null);
  const [loadingReconciliation, setLoadingReconciliation] = useState(false);
  const [reconSearch, setReconSearch] = useState('');
  const [reconFilter, setReconFilter] = useState('all'); // 'all' | 'discrepancy' | 'balanced'

  // Modals & Action States
  const [editTypeModal, setEditTypeModal] = useState(null);
  const [adjustModal, setAdjustModal] = useState(null);
  const [chatUser, setChatUser] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadTypes();
  }, []);

  useEffect(() => {
    if (activeTab === 'ledger') loadLedger();
    if (activeTab === 'reconciliation') loadReconciliation();
    if (activeTab === 'types') loadTypes();
  }, [activeTab, ledgerPage, ledgerPageSize, ledgerTypeFilter, ledgerSort]);

  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 4500);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  // Loaders
  const loadTypes = async () => {
    setLoadingTypes(true);
    try {
      const res = await fetchMasterTransactionTypes();
      setTypes(res.data || []);
    } catch (err) {
      console.error('Failed to load transaction types:', err);
      setFeedback({ type: 'error', message: 'Failed to fetch transaction rules.' });
    } finally {
      setLoadingTypes(false);
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
      setLedgerTelemetry(res.data.telemetry || {});
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

  // Toggle Type Active
  const handleToggleType = async (typeCode) => {
    try {
      const res = await toggleTransactionType(typeCode);
      setTypes(prev =>
        prev.map(t => (t.type_code === typeCode ? { ...t, is_active: res.data.is_active } : t))
      );
      setFeedback({ type: 'success', message: res.data.message });
    } catch (err) {
      setFeedback({ type: 'error', message: 'Failed to update transaction rule status.' });
    }
  };

  // Save Transaction Type (Create or Edit)
  const handleSaveType = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await createOrUpdateTransactionType(editTypeModal);
      setFeedback({ type: 'success', message: `Transaction rule '${editTypeModal.type_code}' saved.` });
      setEditTypeModal(null);
      loadTypes();
    } catch (err) {
      const raw = err.response?.data?.message || err.response?.data?.error || err.message;
      setFeedback({ type: 'error', message: typeof raw === 'string' ? raw : 'Failed to save rule.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Execute Balance Adjustment
  const handleExecuteAdjustment = async (e) => {
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

  // Filtered Types
  const filteredTypes = useMemo(() => {
    return types.filter(t => {
      if (typeCategoryFilter !== 'all' && t.category !== typeCategoryFilter) return false;
      if (typeSearch.trim()) {
        const q = typeSearch.toLowerCase().trim();
        const matchCode = (t.type_code || '').toLowerCase().includes(q);
        const matchName = (t.name || '').toLowerCase().includes(q);
        const matchDesc = (t.description || '').toLowerCase().includes(q);
        if (!matchCode && !matchName && !matchDesc) return false;
      }
      return true;
    });
  }, [types, typeCategoryFilter, typeSearch]);

  const uniqueCategories = useMemo(() => {
    const cats = new Set(types.map(t => t.category).filter(Boolean));
    return Array.from(cats);
  }, [types]);

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

  return (
    <div className="md-page">
      {/* ── Header ── */}
      <div className="md-header">
        <div className="md-header-left">
          <h1 className="md-title">Master Data &amp; Finance</h1>
          <p className="md-subtitle">
            Financial ledger, system transaction rules, and wallet reconciliation auditor.
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

          {activeTab === 'types' && (
            <button
              type="button"
              className="md-btn-primary"
              onClick={() =>
                setEditTypeModal({
                  type_code: '',
                  name: '',
                  direction: 'credit',
                  category: 'General',
                  accounting_treatment: 'Platform Reserve',
                  is_disputable: false,
                  is_reversible: false,
                  trigger_method: 'Automated',
                  min_amount: 50,
                  max_amount: 10000,
                  description: '',
                  is_active: true
                })
              }
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>Add Rule</span>
            </button>
          )}

          <button
            type="button"
            className="md-btn-outline"
            onClick={() => {
              if (activeTab === 'ledger') loadLedger();
              if (activeTab === 'types') loadTypes();
              if (activeTab === 'reconciliation') loadReconciliation();
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
          className={`md-tab ${activeTab === 'types' ? 'active' : ''}`}
          onClick={() => setActiveTab('types')}
        >
          <span>Transaction Rules</span>
          <span className="md-tab-badge">{types.length}</span>
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
                <option value="all">All Types</option>
                {types.map(t => (
                  <option key={t.type_code} value={t.type_code}>{t.name}</option>
                ))}
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
          TAB 2: TRANSACTION RULES (COLLAPSIBLE ROW TABLE)
         ══════════════════════════════════════════════════════════════ */}
      {activeTab === 'types' && (
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
                placeholder="Search rule code, name, or description..."
                value={typeSearch}
                onChange={(e) => setTypeSearch(e.target.value)}
              />
              {typeSearch && (
                <button type="button" className="md-clear-btn" onClick={() => setTypeSearch('')}>
                  &times;
                </button>
              )}
            </div>

            <div className="md-controls-row">
              <select
                className="md-select"
                value={typeCategoryFilter}
                onChange={(e) => setTypeCategoryFilter(e.target.value)}
              >
                <option value="all">All Categories</option>
                {uniqueCategories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <span className="md-subtle-count">{filteredTypes.length} Rules Defined</span>
            </div>
          </div>

          {/* Collapsible Rules Table */}
          <div className="md-table-card">
            <table className="md-table">
              <thead>
                <tr>
                  <th style={{ width: '160px' }}>Rule Code</th>
                  <th>Display Name</th>
                  <th>Direction</th>
                  <th style={{ width: '130px', textAlign: 'right' }}>Volume</th>
                  <th style={{ width: '100px', textAlign: 'center' }}>Transactions</th>
                  <th style={{ width: '90px', textAlign: 'center' }}>Active</th>
                  <th style={{ width: '140px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {loadingTypes ? (
                  <tr>
                    <td colSpan="7" className="md-table-empty">Loading transaction rules...</td>
                  </tr>
                ) : filteredTypes.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="md-table-empty">No transaction rules found.</td>
                  </tr>
                ) : (
                  filteredTypes.map(t => {
                    const dirMeta = DIRECTION_META[t.direction] || DIRECTION_META.neutral;
                    const volume = parseFloat(t.total_volume || 0);
                    const count = parseInt(t.tx_count || 0, 10);
                    const isExpanded = expandedTypeId === t.type_code;

                    return (
                      <React.Fragment key={t.type_code}>
                        <tr
                          className={`md-row ${isExpanded ? 'expanded' : ''} ${!t.is_active ? 'inactive' : ''}`}
                          onClick={() => setExpandedTypeId(isExpanded ? null : t.type_code)}
                        >
                          <td className="td-id">
                            <span className="md-mono-pill bold">{t.type_code}</span>
                          </td>

                          <td className="td-name">
                            <span className="md-rule-name">{t.name}</span>
                            <span className="md-cat-badge">{t.category}</span>
                          </td>

                          <td className="td-direction">
                            <span className={`md-type-pill ${dirMeta.class}`}>
                              <span className="md-dir-arrow">{dirMeta.arrow}</span>
                              <span>{dirMeta.label}</span>
                            </span>
                          </td>

                          <td className="td-volume" style={{ textAlign: 'right' }}>
                            <span className="md-vol-text">
                              ৳{volume.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </td>

                          <td className="td-count" style={{ textAlign: 'center' }}>
                            <span className="md-count-pill">{count}</span>
                          </td>

                          <td className="td-active" style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                            <label className="md-switch" title={t.is_active ? 'Rule is active' : 'Rule is deactivated'}>
                              <input
                                type="checkbox"
                                checked={Boolean(t.is_active)}
                                onChange={() => handleToggleType(t.type_code)}
                              />
                              <span className="md-slider" />
                            </label>
                          </td>

                          <td className="td-action" onClick={(e) => e.stopPropagation()}>
                            <div className="md-action-group">
                              <button
                                type="button"
                                className="md-btn-edit-rule"
                                onClick={() => setEditTypeModal(t)}
                                title="Configure rule limits and parameters"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className={`md-expand-btn ${isExpanded ? 'active' : ''}`}
                                onClick={() => setExpandedTypeId(isExpanded ? null : t.type_code)}
                                aria-label="Toggle details"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`md-chevron ${isExpanded ? 'rotate' : ''}`}>
                                  <polyline points="6 9 12 15 18 9" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Collapsible Rule Drawer */}
                        {isExpanded && (
                          <tr className="md-drawer-row">
                            <td colSpan="7" className="md-drawer-td">
                              <div className="md-drawer">
                                <div className="md-drawer-col info">
                                  <div className="md-card-section">
                                    <h4 className="md-section-title">Rule Specifications &amp; Limits</h4>
                                    <div className="md-meta-grid">
                                      <div className="md-meta-item">
                                        <span className="md-meta-k">Accounting Classification</span>
                                        <span className="md-meta-v">{t.accounting_treatment}</span>
                                      </div>
                                      <div className="md-meta-item">
                                        <span className="md-meta-k">Trigger Mechanism</span>
                                        <span className="md-meta-v mono">{t.trigger_method}</span>
                                      </div>
                                      <div className="md-meta-item">
                                        <span className="md-meta-k">Permitted Range</span>
                                        <span className="md-meta-v">৳{parseFloat(t.min_amount).toFixed(0)} – ৳{parseFloat(t.max_amount).toFixed(0)}</span>
                                      </div>
                                      <div className="md-meta-item">
                                        <span className="md-meta-k">Policy Protections</span>
                                        <span className="md-meta-v">
                                          Disputable: <strong>{t.is_disputable ? 'Yes' : 'No'}</strong> • Reversible: <strong>{t.is_reversible ? 'Yes' : 'No'}</strong>
                                        </span>
                                      </div>
                                    </div>

                                    {t.description && (
                                      <div className="md-desc-box">
                                        <span className="md-meta-k">Operational Policy</span>
                                        <p>{t.description}</p>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="md-drawer-col tools">
                                  <div className="md-card-section">
                                    <h4 className="md-section-title">Rule Action</h4>
                                    <p className="md-subtle-hint">
                                      Configure operational thresholds or deactivate this rule from the ledger engine.
                                    </p>
                                    <button
                                      type="button"
                                      className="md-btn-primary"
                                      onClick={() => setEditTypeModal(t)}
                                    >
                                      Configure Rule Parameters
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
          MODAL: CREATE / EDIT TRANSACTION RULE
         ══════════════════════════════════════════════════════════════ */}
      {editTypeModal && (
        <div className="md-modal-overlay" onClick={() => setEditTypeModal(null)}>
          <div className="md-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="md-modal-header">
              <h3>{editTypeModal.type_code ? `Edit Rule: ${editTypeModal.type_code}` : 'Add Transaction Rule'}</h3>
              <button type="button" className="md-modal-close" onClick={() => setEditTypeModal(null)}>&times;</button>
            </div>

            <form onSubmit={handleSaveType}>
              <div className="md-modal-body">
                <div className="md-form-row">
                  <div className="md-form-field">
                    <label>Rule Identifier Code</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. platform_fee, bonus"
                      value={editTypeModal.type_code}
                      onChange={(e) => setEditTypeModal(prev => ({ ...prev, type_code: e.target.value }))}
                      disabled={Boolean(types.some(t => t.type_code === editTypeModal.type_code && t.created_at))}
                    />
                  </div>

                  <div className="md-form-field">
                    <label>Display Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Platform Commission Fee"
                      value={editTypeModal.name}
                      onChange={(e) => setEditTypeModal(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="md-form-row">
                  <div className="md-form-field">
                    <label>Balance Flow Direction</label>
                    <select
                      value={editTypeModal.direction}
                      onChange={(e) => setEditTypeModal(prev => ({ ...prev, direction: e.target.value }))}
                    >
                      <option value="credit">Credit (+) Adds to balance</option>
                      <option value="debit">Debit (-) Deducts from balance</option>
                      <option value="escrow_hold">Escrow Hold (Locks funds)</option>
                      <option value="neutral">Neutral (Internal transfer)</option>
                    </select>
                  </div>

                  <div className="md-form-field">
                    <label>Category</label>
                    <input
                      type="text"
                      placeholder="e.g. Marketplace, Deposit, Penalty"
                      value={editTypeModal.category}
                      onChange={(e) => setEditTypeModal(prev => ({ ...prev, category: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="md-form-row">
                  <div className="md-form-field">
                    <label>Min Permitted Amount (৳)</label>
                    <input
                      type="number"
                      value={editTypeModal.min_amount}
                      onChange={(e) => setEditTypeModal(prev => ({ ...prev, min_amount: e.target.value }))}
                    />
                  </div>

                  <div className="md-form-field">
                    <label>Max Permitted Amount (৳)</label>
                    <input
                      type="number"
                      value={editTypeModal.max_amount}
                      onChange={(e) => setEditTypeModal(prev => ({ ...prev, max_amount: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="md-checkbox-row">
                  <label className="md-check-label">
                    <input
                      type="checkbox"
                      checked={Boolean(editTypeModal.is_disputable)}
                      onChange={(e) => setEditTypeModal(prev => ({ ...prev, is_disputable: e.target.checked }))}
                    />
                    Permit dispute filing
                  </label>

                  <label className="md-check-label">
                    <input
                      type="checkbox"
                      checked={Boolean(editTypeModal.is_reversible)}
                      onChange={(e) => setEditTypeModal(prev => ({ ...prev, is_reversible: e.target.checked }))}
                    />
                    Reversible by administrator
                  </label>
                </div>

                <div className="md-form-field full">
                  <label>Rule Description</label>
                  <textarea
                    rows="3"
                    placeholder="Describe how and when this rule applies..."
                    value={editTypeModal.description || ''}
                    onChange={(e) => setEditTypeModal(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>
              </div>

              <div className="md-modal-footer">
                <button type="button" className="md-btn-outline" onClick={() => setEditTypeModal(null)}>Cancel</button>
                <button type="submit" className="md-btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'Saving...' : 'Save Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          MODAL: ADMIN BALANCE ADJUSTMENT TOOL
         ══════════════════════════════════════════════════════════════ */}
      {adjustModal && (
        <div className="md-modal-overlay" onClick={() => setAdjustModal(null)}>
          <div className="md-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="md-modal-header">
              <h3>Adjust User Balance</h3>
              <button type="button" className="md-modal-close" onClick={() => setAdjustModal(null)}>&times;</button>
            </div>

            <form onSubmit={handleExecuteAdjustment}>
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
