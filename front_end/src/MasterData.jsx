import React, { useState, useEffect, useMemo } from 'react';
import {
  fetchMasterTransactionTypes,
  createOrUpdateTransactionType,
  toggleTransactionType,
  fetchMasterTransactions,
  fetchLedgerReconciliation,
  adjustUserBalance,
  fetchAcademicCatalog
} from './api';
import ChatModal from './ChatModal';
import './MasterData.css';

const DIRECTION_META = {
  credit: { label: 'Credit (+)', class: 'dir-credit', icon: '↗' },
  debit: { label: 'Debit (-)', class: 'dir-debit', icon: '↘' },
  escrow_hold: { label: 'Escrow Reserve', class: 'dir-hold', icon: '🔒' },
  neutral: { label: 'Internal Transfer', class: 'dir-neutral', icon: '⇄' }
};

const MasterData = ({ user }) => {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState('types'); // 'types' | 'ledger' | 'reconciliation' | 'academic'

  // Tab 1: Transaction Types Registry
  const [types, setTypes] = useState([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [typeSearch, setTypeSearch] = useState('');
  const [typeCategoryFilter, setTypeCategoryFilter] = useState('all');

  // Tab 2: Global Ledger
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

  // Tab 3: Reconciliation
  const [reconciliation, setReconciliation] = useState(null);
  const [loadingReconciliation, setLoadingReconciliation] = useState(false);

  // Tab 4: Academic Catalog
  const [academicData, setAcademicData] = useState(null);
  const [loadingAcademic, setLoadingAcademic] = useState(false);

  // Modals & Forms
  const [editTypeModal, setEditTypeModal] = useState(null); // null or object for create/edit
  const [adjustModal, setAdjustModal] = useState(null); // null or { user_id, name, balance }
  const [chatUser, setChatUser] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadTypes();
  }, []);

  useEffect(() => {
    if (activeTab === 'ledger') loadLedger();
    if (activeTab === 'reconciliation') loadReconciliation();
    if (activeTab === 'academic') loadAcademicCatalog();
  }, [activeTab, ledgerPage, ledgerPageSize, ledgerTypeFilter, ledgerSort]);

  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 5000);
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
      setFeedback({ type: 'error', message: 'Failed to fetch transaction registry.' });
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
      console.error('Failed to load global ledger:', err);
      setFeedback({ type: 'error', message: 'Failed to fetch global transactions.' });
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
      setFeedback({ type: 'error', message: 'Failed to run ledger reconciliation.' });
    } finally {
      setLoadingReconciliation(false);
    }
  };

  const loadAcademicCatalog = async () => {
    setLoadingAcademic(true);
    try {
      const res = await fetchAcademicCatalog();
      setAcademicData(res.data || null);
    } catch (err) {
      console.error('Failed to load academic catalog:', err);
    } finally {
      setLoadingAcademic(false);
    }
  };

  // Type Toggle
  const handleToggleType = async (typeCode) => {
    try {
      const res = await toggleTransactionType(typeCode);
      setTypes(prev =>
        prev.map(t => (t.type_code === typeCode ? { ...t, is_active: res.data.is_active } : t))
      );
      setFeedback({ type: 'success', message: res.data.message });
    } catch (err) {
      setFeedback({ type: 'error', message: 'Failed to update transaction type status.' });
    }
  };

  // Save Transaction Type (Create or Edit)
  const handleSaveType = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await createOrUpdateTransactionType(editTypeModal);
      setFeedback({ type: 'success', message: `Transaction type '${editTypeModal.type_code}' saved successfully.` });
      setEditTypeModal(null);
      loadTypes();
    } catch (err) {
      const raw = err.response?.data?.message || err.response?.data?.error || err.message;
      const msg = typeof raw === 'string'
        ? raw
        : (raw?.message || (raw && typeof raw === 'object' ? JSON.stringify(raw) : null) || 'Failed to save transaction type.');
      setFeedback({ type: 'error', message: msg });
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
      loadTypes();
    } catch (err) {
      const raw = err.response?.data?.message || err.response?.data?.error || err.message;
      const msg = typeof raw === 'string'
        ? raw
        : (raw?.message || (raw && typeof raw === 'object' ? JSON.stringify(raw) : null) || 'Failed to adjust user balance.');
      setFeedback({ type: 'error', message: msg });
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
      'Category',
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
      t.category || 'General',
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
    link.setAttribute('download', `microteach_master_ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Filtered types
  const filteredTypes = useMemo(() => {
    return types.filter(t => {
      if (typeCategoryFilter !== 'all' && t.category !== typeCategoryFilter) return false;
      if (typeSearch.trim()) {
        const q = typeSearch.toLowerCase().trim();
        const matchCode = (t.type_code || '').toLowerCase().includes(q);
        const matchName = (t.name || '').toLowerCase().includes(q);
        const matchDesc = (t.description || '').toLowerCase().includes(q);
        const matchCat = (t.category || '').toLowerCase().includes(q);
        if (!matchCode && !matchName && !matchDesc && !matchCat) return false;
      }
      return true;
    });
  }, [types, typeCategoryFilter, typeSearch]);

  const uniqueCategories = useMemo(() => {
    const cats = new Set(types.map(t => t.category).filter(Boolean));
    return Array.from(cats);
  }, [types]);

  // Telemetry Aggregates
  const stats = useMemo(() => {
    const totalVolume = types.reduce((acc, t) => acc + parseFloat(t.total_volume || 0), 0);
    const totalTxCount = types.reduce((acc, t) => acc + parseInt(t.tx_count || 0, 10), 0);
    const activeCount = types.filter(t => t.is_active).length;

    const escrowHeld = types.find(t => t.type_code === 'bounty_held')?.total_volume || 0;
    const tutorPayouts = types.find(t => t.type_code === 'bounty_received')?.total_volume || 0;
    const inflows = types.find(t => t.type_code === 'top_up')?.total_volume || 0;

    return {
      totalVolume,
      totalTxCount,
      activeCount,
      escrowHeld,
      tutorPayouts,
      inflows
    };
  }, [types]);

  return (
    <div className="admin-content md-minimal">
      {/* ── Top Header & Breadcrumb ── */}
      <div className="md-header">
        <div className="md-title-group">
          <div className="md-breadcrumb">
            <span>Institutional Governance</span>
            <span className="md-breadcrumb-sep">&rsaquo;</span>
            <span className="md-breadcrumb-active">Master Data Management</span>
          </div>
          <div className="md-title-row">
            <h1 className="md-title">Master Data &amp; Financial Registry</h1>
            <span className="md-system-pill">
              <span className="md-pulse-dot"></span>
              Core Ledger Engine
            </span>
          </div>

          <div className="md-stats-strip">
            <span className="md-stat-pill">
              Types: <strong>{types.length} Defined</strong> ({stats.activeCount} Active)
            </span>
            <span className="md-stat-sep">&bull;</span>
            <span className="md-stat-pill">
              Platform Inflows: <strong>৳{parseFloat(stats.inflows).toLocaleString()}</strong>
            </span>
            <span className="md-stat-sep">&bull;</span>
            <span className="md-stat-pill">
              Escrow Holds: <strong>৳{parseFloat(stats.escrowHeld).toLocaleString()}</strong>
            </span>
            <span className="md-stat-sep">&bull;</span>
            <span className="md-stat-pill">
              Tutor Earnings: <strong>৳{parseFloat(stats.tutorPayouts).toLocaleString()}</strong>
            </span>
          </div>
        </div>

        <div className="md-header-actions">
          <button
            className="md-btn-outline"
            onClick={() => {
              if (activeTab === 'ledger') exportLedgerCSV();
              else {
                setActiveTab('ledger');
                setTimeout(exportLedgerCSV, 300);
              }
            }}
            title="Download full ledger records in CSV format"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="7 10 12 15 17 10" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="12" y1="15" x2="12" y2="3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Export Ledger CSV
          </button>

          <button
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
            + Register Transaction Type
          </button>
        </div>
      </div>

      {/* ── Toast Feedback ── */}
      {feedback && (
        <div className={`md-toast ${feedback.type}`}>
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)}>&times;</button>
        </div>
      )}

      {/* ── Navigation Tabs ── */}
      <div className="md-tab-nav">
        <button
          className={`md-nav-btn ${activeTab === 'types' ? 'active' : ''}`}
          onClick={() => setActiveTab('types')}
        >
          <span className="md-tab-icon">🗂️</span>
          Transaction Types Registry
          <span className="md-tab-badge">{types.length}</span>
        </button>

        <button
          className={`md-nav-btn ${activeTab === 'ledger' ? 'active' : ''}`}
          onClick={() => setActiveTab('ledger')}
        >
          <span className="md-tab-icon">📜</span>
          Global Financial Journal
          <span className="md-tab-badge">{ledgerTotal || stats.totalTxCount}</span>
        </button>

        <button
          className={`md-nav-btn ${activeTab === 'reconciliation' ? 'active' : ''}`}
          onClick={() => setActiveTab('reconciliation')}
        >
          <span className="md-tab-icon">⚖️</span>
          Ledger Solvency &amp; Reconciliation
        </button>

        <button
          className={`md-nav-btn ${activeTab === 'academic' ? 'active' : ''}`}
          onClick={() => setActiveTab('academic')}
        >
          <span className="md-tab-icon">🏛️</span>
          University Academic Catalog
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          TAB 1: TRANSACTION TYPES REGISTRY
         ══════════════════════════════════════════════════════════════ */}
      {activeTab === 'types' && (
        <div className="md-tab-content">
          {/* Controls Bar */}
          <div className="md-filter-bar">
            <div className="md-search-box">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                placeholder="Filter by code, name, category, or treatment..."
                value={typeSearch}
                onChange={(e) => setTypeSearch(e.target.value)}
              />
              {typeSearch && <button onClick={() => setTypeSearch('')}>&times;</button>}
            </div>

            <div className="md-select-wrap">
              <label>Category:</label>
              <select
                value={typeCategoryFilter}
                onChange={(e) => setTypeCategoryFilter(e.target.value)}
              >
                <option value="all">All Categories</option>
                {uniqueCategories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <span className="md-type-count-text">
              Showing {filteredTypes.length} of {types.length} Master Types
            </span>
          </div>

          {/* Cards Grid */}
          {loadingTypes ? (
            <div className="md-loading-box">Loading master transaction types...</div>
          ) : filteredTypes.length === 0 ? (
            <div className="md-empty-box">No transaction types matching your query.</div>
          ) : (
            <div className="md-types-grid">
              {filteredTypes.map(t => {
                const dirMeta = DIRECTION_META[t.direction] || DIRECTION_META.neutral;
                const volume = parseFloat(t.total_volume || 0);
                const count = parseInt(t.tx_count || 0, 10);
                const avg = parseFloat(t.avg_amount || 0);

                return (
                  <div key={t.type_code} className={`md-type-card ${!t.is_active ? 'inactive' : ''}`}>
                    <div className="md-card-top">
                      <div className="md-card-identity">
                        <div className="md-code-row">
                          <code className="md-type-code">{t.type_code}</code>
                          <span className={`md-dir-pill ${dirMeta.class}`}>
                            {dirMeta.icon} {dirMeta.label}
                          </span>
                        </div>
                        <h3 className="md-type-name">{t.name}</h3>
                        <span className="md-category-tag">{t.category}</span>
                      </div>

                      <div className="md-card-toggle">
                        <label className="md-switch" title={t.is_active ? 'Active on platform' : 'Deactivated'}>
                          <input
                            type="checkbox"
                            checked={Boolean(t.is_active)}
                            onChange={() => handleToggleType(t.type_code)}
                          />
                          <span className="md-slider"></span>
                        </label>
                      </div>
                    </div>

                    <p className="md-type-desc">
                      {t.description || 'No detailed reference notes provided for this transaction rule.'}
                    </p>

                    <div className="md-rule-meta">
                      <div className="md-rule-item">
                        <span className="md-meta-k">Accounting Classification</span>
                        <span className="md-meta-v">{t.accounting_treatment}</span>
                      </div>
                      <div className="md-rule-item">
                        <span className="md-meta-k">Trigger Mechanism</span>
                        <span className="md-meta-v mono">{t.trigger_method}</span>
                      </div>
                      <div className="md-rule-row">
                        <span className="md-policy-badge">
                          Disputable: <strong>{t.is_disputable ? 'Yes' : 'No'}</strong>
                        </span>
                        <span className="md-policy-badge">
                          Reversible: <strong>{t.is_reversible ? 'Yes' : 'No'}</strong>
                        </span>
                        <span className="md-policy-badge">
                          Range: <strong>৳{parseFloat(t.min_amount).toFixed(0)}–৳{parseFloat(t.max_amount).toFixed(0)}</strong>
                        </span>
                      </div>
                    </div>

                    {/* Live Usage Strip */}
                    <div className="md-card-telemetry">
                      <div className="md-card-stat">
                        <span className="md-stat-num">{count}</span>
                        <span className="md-stat-lbl">Transactions</span>
                      </div>
                      <div className="md-card-stat">
                        <span className="md-stat-num">৳{volume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        <span className="md-stat-lbl">Recorded Volume</span>
                      </div>
                      <div className="md-card-stat">
                        <span className="md-stat-num">৳{avg.toFixed(0)}</span>
                        <span className="md-stat-lbl">Average Ticket</span>
                      </div>
                    </div>

                    <div className="md-card-footer">
                      <span className="md-last-seen">
                        {t.last_occurred_at
                          ? `Last seen: ${new Date(t.last_occurred_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`
                          : 'No recorded entries yet'}
                      </span>
                      <button
                        className="md-edit-btn"
                        onClick={() => setEditTypeModal(t)}
                      >
                        Edit Rule &rarr;
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          TAB 2: GLOBAL TRANSACTION JOURNAL
         ══════════════════════════════════════════════════════════════ */}
      {activeTab === 'ledger' && (
        <div className="md-tab-content">
          {/* Ledger Filter Strip */}
          <div className="md-filter-bar ledger">
            <div className="md-search-box">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                placeholder="Search user, email, student ID, post #ref, or description..."
                value={ledgerSearch}
                onChange={(e) => { setLedgerSearch(e.target.value); setLedgerPage(1); }}
                onKeyDown={(e) => { if (e.key === 'Enter') loadLedger(); }}
              />
              {ledgerSearch && <button onClick={() => { setLedgerSearch(''); setTimeout(loadLedger, 50); }}>&times;</button>}
            </div>

            <div className="md-select-wrap">
              <label>Type:</label>
              <select
                value={ledgerTypeFilter}
                onChange={(e) => { setLedgerTypeFilter(e.target.value); setLedgerPage(1); }}
              >
                <option value="all">All Transaction Types</option>
                {types.map(t => (
                  <option key={t.type_code} value={t.type_code}>{t.name} ({t.type_code})</option>
                ))}
              </select>
            </div>

            <div className="md-select-wrap">
              <label>Sort:</label>
              <select
                value={ledgerSort}
                onChange={(e) => { setLedgerSort(e.target.value); setLedgerPage(1); }}
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="amount_desc">Highest Amount</option>
                <option value="amount_asc">Lowest Amount</option>
              </select>
            </div>

            <button className="md-btn-refresh" onClick={loadLedger} disabled={loadingLedger}>
              {loadingLedger ? 'Querying...' : 'Filter Ledger'}
            </button>
          </div>

          {/* Ledger Table */}
          <div className="md-table-wrap">
            <table className="md-table">
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>ID</th>
                  <th style={{ width: '130px' }}>Date</th>
                  <th>Account User</th>
                  <th>Transaction Type</th>
                  <th style={{ width: '90px' }}>Reference</th>
                  <th style={{ width: '110px', textAlign: 'right' }}>Amount</th>
                  <th style={{ width: '110px', textAlign: 'right' }}>Balance After</th>
                  <th>Audit Description</th>
                  <th style={{ width: '60px', textAlign: 'center' }}>Inspect</th>
                </tr>
              </thead>
              <tbody>
                {loadingLedger ? (
                  <tr>
                    <td colSpan="9" className="md-empty-td">Loading ledger records from database...</td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="md-empty-td">No transactions found matching criteria.</td>
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
                          <td className="md-td-id">#TX-{String(t.transaction_id).padStart(4, '0')}</td>
                          <td className="md-td-date">
                            <span className="md-date-main">
                              {new Date(t.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </span>
                            <span className="md-date-time">
                              {new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </td>
                          <td className="md-td-user">
                            <div className="md-user-info">
                              <span className="md-user-name">{t.full_name}</span>
                              <div className="md-user-sub">
                                {t.student_id && <span className="md-id-pill">#{t.student_id}</span>}
                                <span className="md-dept-pill">{t.department || t.role}</span>
                              </div>
                            </div>
                          </td>
                          <td className="md-td-type">
                            <span className={`md-dir-pill ${dirMeta.class}`}>
                              {dirMeta.icon} {t.type_name || t.type}
                            </span>
                          </td>
                          <td className="md-td-ref">
                            {t.reference_id ? (
                              <span className="md-ref-badge" title={`Post #${t.reference_id}`}>
                                Post #{t.reference_id}
                              </span>
                            ) : (
                              <span className="md-muted">—</span>
                            )}
                          </td>
                          <td className="md-td-amount">
                            <span className={`md-amt ${isCredit ? 'credit' : isDebit ? 'debit' : 'neutral'}`}>
                              {isCredit ? '+' : isDebit ? '-' : ''}৳{amt.toFixed(2)}
                            </span>
                          </td>
                          <td className="md-td-bal">
                            <span className="md-bal-val">৳{bal.toFixed(2)}</span>
                          </td>
                          <td className="md-td-desc">
                            <span className="md-desc-text" title={t.description}>{t.description}</span>
                          </td>
                          <td className="md-td-actions" onClick={(e) => e.stopPropagation()}>
                            <button
                              className="md-chevron-btn"
                              onClick={() => setExpandedTxId(isExpanded ? null : t.transaction_id)}
                            >
                              {isExpanded ? '▲' : '▼'}
                            </button>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr className="md-drawer-row">
                            <td colSpan="9" className="md-drawer-td">
                              <div className="md-ledger-drawer">
                                <div className="md-ld-col">
                                  <h4>Transaction Metadata</h4>
                                  <div className="md-ld-grid">
                                    <div><label>Entry Identifier:</label> <code>#{t.transaction_id}</code></div>
                                    <div><label>System Code:</label> <code>{t.type}</code></div>
                                    <div><label>Direction / Flow:</label> <strong>{dirMeta.label}</strong></div>
                                    <div><label>Accounting Category:</label> <span>{t.category}</span></div>
                                    <div><label>Timestamp:</label> <span>{new Date(t.created_at).toLocaleString()}</span></div>
                                    <div><label>Reference Entity:</label> <span>{t.reference_id ? `Post #${t.reference_id}` : 'General / Wallet'}</span></div>
                                  </div>
                                </div>

                                <div className="md-ld-col">
                                  <h4>Account Participant</h4>
                                  <div className="md-ld-grid">
                                    <div><label>User Name:</label> <strong>{t.full_name}</strong></div>
                                    <div><label>Campus Email:</label> <span>{t.email}</span></div>
                                    <div><label>Campus Student ID:</label> <span>#{t.student_id || 'N/A'}</span></div>
                                    <div><label>Academic Unit:</label> <span>{t.department || 'N/A'}</span></div>
                                    <div><label>Current Wallet Balance:</label> <strong className="text-success">৳{parseFloat(t.current_user_balance || 0).toFixed(2)}</strong></div>
                                  </div>
                                  <button
                                    className="md-action-chat-btn"
                                    onClick={() => setChatUser({ user_id: t.user_id, full_name: t.full_name })}
                                  >
                                    💬 Message User in Admin Chat
                                  </button>
                                </div>

                                <div className="md-ld-col">
                                  <h4>Audit Log &amp; Balance Impact</h4>
                                  <div className="md-ld-desc-box">
                                    <p>{t.description}</p>
                                  </div>
                                  <div className="md-bal-impact">
                                    <span>Balance After Transaction:</span>
                                    <strong>৳{bal.toFixed(2)}</strong>
                                  </div>
                                  <button
                                    className="md-adjust-btn"
                                    onClick={() => setAdjustModal({ user_id: t.user_id, name: t.full_name, balance: t.current_user_balance, amount: '', direction: 'credit', reason: '' })}
                                  >
                                    ⚖️ Adjust Balance (Admin Override)
                                  </button>
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
              Showing <strong>{transactions.length === 0 ? 0 : (ledgerPage - 1) * ledgerPageSize + 1}</strong>–
              <strong>{Math.min(ledgerPage * ledgerPageSize, ledgerTotal)}</strong> of{' '}
              <strong>{ledgerTotal}</strong> records
            </div>

            <div className="md-page-btns">
              <button
                className="md-page-btn"
                disabled={ledgerPage <= 1}
                onClick={() => setLedgerPage(prev => Math.max(prev - 1, 1))}
              >
                &larr; Prev
              </button>
              <span className="md-page-current">Page {ledgerPage}</span>
              <button
                className="md-page-btn"
                disabled={ledgerPage * ledgerPageSize >= ledgerTotal}
                onClick={() => setLedgerPage(prev => prev + 1)}
              >
                Next &rarr;
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          TAB 3: RECONCILIATION & SOLVENCY AUDITOR
         ══════════════════════════════════════════════════════════════ */}
      {activeTab === 'reconciliation' && (
        <div className="md-tab-content">
          {loadingReconciliation ? (
            <div className="md-loading-box">Running platform ledger solvency audit...</div>
          ) : !reconciliation ? (
            <div className="md-empty-box">Unable to fetch reconciliation data.</div>
          ) : (
            <div className="md-reconciliation-view">
              {/* Summary KPIs */}
              <div className="md-solvency-cards">
                <div className="md-solvency-card">
                  <span className="md-card-k">Total Enrolled User Wallets</span>
                  <h3 className="md-card-v">৳{reconciliation.totalBalances.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
                  <span className="md-card-sub">{reconciliation.userCount} active accounts registered</span>
                </div>
                <div className="md-solvency-card">
                  <span className="md-card-k">Lifetime Inflow (Deposits)</span>
                  <h3 className="md-card-v text-success">৳{parseFloat(reconciliation.flows.total_deposits || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
                  <span className="md-card-sub">Bank &amp; MFS Top-ups</span>
                </div>
                <div className="md-solvency-card">
                  <span className="md-card-k">Tutor Marketplace Payouts</span>
                  <h3 className="md-card-v text-primary">৳{parseFloat(reconciliation.flows.total_payouts || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
                  <span className="md-card-sub">Earned Peer Teaching</span>
                </div>
                <div className="md-solvency-card">
                  <span className="md-card-k">Active Escrow Liability</span>
                  <h3 className="md-card-v text-warning">৳{parseFloat(reconciliation.flows.total_held || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
                  <span className="md-card-sub">Locked in ongoing requests</span>
                </div>
              </div>

              {/* User-by-User Audit Matrix */}
              <div className="md-audit-section">
                <div className="md-audit-header">
                  <div>
                    <h3>User Wallet Reconciliation Journal</h3>
                    <p>Compares recorded wallet balance in `Users` against the net sum of all journal debit/credit transactions in `Transactions`.</p>
                  </div>
                  <button className="md-btn-refresh" onClick={loadReconciliation}>
                    Re-run Audit Check
                  </button>
                </div>

                <div className="md-table-wrap">
                  <table className="md-table">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Role</th>
                        <th style={{ textAlign: 'right' }}>Recorded Wallet Balance</th>
                        <th style={{ textAlign: 'right' }}>Calculated Net Ledger Flow</th>
                        <th style={{ textAlign: 'center' }}>Total Journal Entries</th>
                        <th style={{ textAlign: 'center' }}>Reconciliation Status</th>
                        <th style={{ textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reconciliation.userAudits.map(u => (
                        <tr key={u.user_id} className={`md-audit-row ${u.discrepancy ? 'discrepancy' : 'balanced'}`}>
                          <td>
                            <strong>{u.full_name}</strong>
                            <div className="md-user-sub">#{u.student_id || u.user_id} &middot; {u.email}</div>
                          </td>
                          <td><span className="md-role-tag">{u.role}</span></td>
                          <td style={{ textAlign: 'right', fontWeight: '700' }}>
                            ৳{u.recorded_balance.toFixed(2)}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                            ৳{u.calculated_flow.toFixed(2)}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span className="md-badge-mono">{u.tx_count} TX</span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {u.discrepancy ? (
                              <span className="md-audit-pill alert" title="Balance differs from transaction ledger sum">
                                ⚠️ Discrepancy (Δ ৳{Math.abs(u.recorded_balance - u.calculated_flow).toFixed(2)})
                              </span>
                            ) : (
                              <span className="md-audit-pill balanced">
                                ✓ Reconciled (100%)
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              className="md-btn-quick-adj"
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
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          TAB 4: ACADEMIC MASTER CATALOG
         ══════════════════════════════════════════════════════════════ */}
      {activeTab === 'academic' && (
        <div className="md-tab-content">
          {loadingAcademic ? (
            <div className="md-loading-box">Loading academic master data...</div>
          ) : !academicData ? (
            <div className="md-empty-box">No academic catalog data available.</div>
          ) : (
            <div className="md-academic-grid">
              {/* Departments */}
              <div className="md-academic-card">
                <h3>🏛️ University Departments Master</h3>
                <div className="md-catalog-list">
                  {academicData.departments.map((dept, idx) => (
                    <div key={idx} className="md-catalog-item">
                      <div>
                        <strong>{dept.department}</strong>
                        <span className="md-cat-sub">{dept.student_count} Students Enrolled</span>
                      </div>
                      <span className="md-pill-tutor">{dept.tutor_count} Peer Tutors</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Courses */}
              <div className="md-academic-card">
                <h3>📚 Registered Course Codes &amp; Bounty Volume</h3>
                <div className="md-catalog-list">
                  {academicData.courses.map((c, idx) => (
                    <div key={idx} className="md-catalog-item">
                      <div>
                        <strong className="md-course-code">{c.course_code}</strong>
                        <span className="md-cat-sub">{c.post_count} Tutoring Requests</span>
                      </div>
                      <span className="md-pill-vol">৳{parseFloat(c.total_bounty_volume).toLocaleString()} Total Bounties</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          MODAL: CREATE / EDIT TRANSACTION TYPE
         ══════════════════════════════════════════════════════════════ */}
      {editTypeModal && (
        <div className="md-modal-overlay" onClick={() => setEditTypeModal(null)}>
          <div className="md-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="md-modal-header">
              <h3>{editTypeModal.type_code ? `Configure '${editTypeModal.type_code}'` : 'Register Master Transaction Type'}</h3>
              <button className="md-modal-close" onClick={() => setEditTypeModal(null)}>&times;</button>
            </div>

            <form onSubmit={handleSaveType}>
              <div className="md-modal-body">
                <div className="md-form-row">
                  <div className="md-form-field">
                    <label>Transaction Type Code (Immutable Identifier)</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. platform_fee, referral_bonus"
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
                      <option value="credit">Credit (+ Increments Balance)</option>
                      <option value="debit">Debit (- Deducts Balance)</option>
                      <option value="escrow_hold">Escrow Hold (Locks Balance)</option>
                      <option value="neutral">Neutral / Internal Reallocation</option>
                    </select>
                  </div>

                  <div className="md-form-field">
                    <label>Operational Category</label>
                    <input
                      type="text"
                      placeholder="e.g. Marketplace Settlement, Inflow / Funding"
                      value={editTypeModal.category}
                      onChange={(e) => setEditTypeModal(prev => ({ ...prev, category: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="md-form-row">
                  <div className="md-form-field">
                    <label>Accounting Treatment</label>
                    <input
                      type="text"
                      placeholder="e.g. Student Wallet Asset, Tutor Earned Revenue"
                      value={editTypeModal.accounting_treatment}
                      onChange={(e) => setEditTypeModal(prev => ({ ...prev, accounting_treatment: e.target.value }))}
                    />
                  </div>

                  <div className="md-form-field">
                    <label>Trigger Mechanism</label>
                    <input
                      type="text"
                      placeholder="e.g. Automated (Session Completion)"
                      value={editTypeModal.trigger_method}
                      onChange={(e) => setEditTypeModal(prev => ({ ...prev, trigger_method: e.target.value }))}
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
                    Permit Escrow Dispute Filing
                  </label>

                  <label className="md-check-label">
                    <input
                      type="checkbox"
                      checked={Boolean(editTypeModal.is_reversible)}
                      onChange={(e) => setEditTypeModal(prev => ({ ...prev, is_reversible: e.target.checked }))}
                    />
                    Reversible by Administrator
                  </label>
                </div>

                <div className="md-form-field full">
                  <label>Rule Description &amp; Operational Policy</label>
                  <textarea
                    rows="3"
                    placeholder="Describe how and when this transaction type is triggered..."
                    value={editTypeModal.description || ''}
                    onChange={(e) => setEditTypeModal(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>
              </div>

              <div className="md-modal-footer">
                <button type="button" className="md-btn-outline" onClick={() => setEditTypeModal(null)}>Cancel</button>
                <button type="submit" className="md-btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          MODAL: ADMIN BALANCE ADJUSTMENT
         ══════════════════════════════════════════════════════════════ */}
      {adjustModal && (
        <div className="md-modal-overlay" onClick={() => setAdjustModal(null)}>
          <div className="md-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="md-modal-header danger">
              <h3>Super Admin Balance Adjustment</h3>
              <button className="md-modal-close" onClick={() => setAdjustModal(null)}>&times;</button>
            </div>

            <form onSubmit={handleExecuteAdjustment}>
              <div className="md-modal-body">
                <div className="md-adjust-summary">
                  <div><span>Target User:</span> <strong>{adjustModal.name}</strong></div>
                  <div><span>Current Wallet Balance:</span> <strong>৳{parseFloat(adjustModal.balance || 0).toFixed(2)}</strong></div>
                </div>

                <div className="md-form-row">
                  <div className="md-form-field">
                    <label>Adjustment Direction</label>
                    <select
                      value={adjustModal.direction}
                      onChange={(e) => setAdjustModal(prev => ({ ...prev, direction: e.target.value }))}
                    >
                      <option value="credit">Credit (+) Add to balance</option>
                      <option value="debit">Debit (-) Deduct from balance</option>
                    </select>
                  </div>

                  <div className="md-form-field">
                    <label>Amount in BDT (৳)</label>
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
                  <label>Mandatory Audit Reason / Resolution Memo</label>
                  <textarea
                    rows="3"
                    required
                    placeholder="Enter formal justification for ledger correction..."
                    value={adjustModal.reason}
                    onChange={(e) => setAdjustModal(prev => ({ ...prev, reason: e.target.value }))}
                  />
                </div>
              </div>

              <div className="md-modal-footer">
                <button type="button" className="md-btn-outline" onClick={() => setAdjustModal(null)}>Cancel</button>
                <button type="submit" className="md-btn-danger" disabled={actionLoading}>
                  {actionLoading ? 'Executing...' : 'Post Audited Adjustment'}
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
