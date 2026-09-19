import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import './DisputesEscrow.css';

const DisputesEscrow = ({ user }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [sortOption, setSortOption] = useState('sla');

  const disputes = [
    {
      id: 'DISP-9402',
      course: 'CSE 221: Algorithms',
      session: 'SES-9844',
      priority: 'HIGH PRIORITY',
      sla: '12m SLA',
      elapsed: '33m 00s',
      maxSla: '45m 00s',
      student: {
        name: 'Tanvir Ahmed',
        id: '#21101428',
        dept: 'CSE 6th Sem',
        strikes: '0 previous strikes',
      },
      tutor: {
        name: 'Fahim Kabir',
        id: '#19301054',
        rating: '4.98',
        sessions: '118 sessions',
      },
      narrative: 'Tutor promised full dynamic programming algorithm walkthrough before 11:30 PM homework cutoff. Only provided incomplete pseudo-code that threw index out of bounds errors. Missed assignment submission window entirely.',
      evidence: [
        { type: 'audio', name: 'webrtc_session_42m.wav' },
        { type: 'code', name: 'dijkstra_dp_memo.cpp' },
      ],
      telemetry: '42m WebRTC duration, 14 commits. Flagged timestamp at 08:22.',
      escrow: { amount: 750, status: 'Locked' },
      verdict: {
        recommended: '60/40 Split',
        options: [
          { label: 'Full Student Refund', amount: '৳ 750', note: '0 strike applied', selected: false },
          { label: 'Compromise Split', amount: '৳ 450 / ৳ 300', note: '60% student, 40% tutor', selected: true },
          { label: 'Full Tutor Payout', amount: '৳ 750', note: 'Student claim dismissed', selected: false },
        ],
      },
      actions: [
        { label: 'Execute Settlement', primary: true },
        { label: 'Request Evidence (12h)', primary: false },
        { label: 'Escalate to Chair', primary: false },
        { label: 'Dismiss Case', primary: false, ghost: true },
      ],
    },
    {
      id: 'DISP-9388',
      course: 'MAT 120: Calculus',
      session: 'SES-9812',
      priority: 'MEDIUM',
      sla: '38m ago',
      narrative: 'Audio degradation and dropped call after 8 mins. WebRTC diagnostic logs confirmed packet loss > 42% on tutor uplink.',
      escrow: { amount: 350, status: 'Locked' },
      actions: [
        { label: 'Instant Refund (৳ 350)', primary: true },
        { label: 'Review Telemetry', primary: false },
      ],
    },
    {
      id: 'DISP-9375',
      course: 'PHY 112: Electricity & Magnetism',
      session: 'SES-9760',
      priority: 'HIGH PRIORITY',
      sla: '1h 05m ago',
      narrative: 'Tutor sent external Nagad payment number in live whiteboard chat before sharing circuit derivation formulas.',
      escrow: { amount: 500, status: 'Locked' },
      actions: [
        { label: 'Sanction & Suspend', primary: true },
        { label: 'Escalate to Proctor', primary: false },
      ],
    },
  ];

  const tabs = [
    { key: 'all', label: 'All Disputes', count: 3 },
    { key: 'code', label: 'Code / Delivery', count: 1 },
    { key: 'noshow', label: 'No-Show', count: 1 },
    { key: 'scope', label: 'Scope Creep', count: 1 },
  ];

  const filteredDisputes = disputes.filter((item) => {
    if (activeTab !== 'all') return false;
    if (searchQuery && !item.id.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !item.course.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const isExpanded = (id) => id === 'DISP-9402';

  return (
    <div className="admin-page">
      <AdminSidebar user={user} />

      <div className="admin-main">
        <div className="admin-content">
          {/* Header */}
          <div className="page-header">
            <div className="page-header-left">
              <div className="breadcrumb">
                <span>Governance</span>
                <span className="breadcrumb-sep">›</span>
                <span>Integrity Council</span>
                <span className="breadcrumb-sep">›</span>
                <span className="breadcrumb-active">Disputes & Escrow</span>
              </div>
              <h1 className="page-title">Disputes & Escrow Arbitration</h1>
            </div>
            <div className="page-header-actions">
              <button className="btn-outline">
                <span className="btn-icon">↓</span>
                Export Ledger
              </button>
              <button className="btn-primary">
                <span className="btn-icon">⚙</span>
                Configure Safeguards
              </button>
            </div>
          </div>

          {/* Stat Cards */}
          <div className="de-stats">
            <div className="de-stat-card">
              <span className="de-stat-label">Total in Dispute</span>
              <div className="de-stat-row">
                <span className="de-stat-icon">৳</span>
                <span className="de-stat-value">24,650</span>
                <span className="de-stat-sub">3 Active Cases</span>
              </div>
            </div>
            <div className="de-stat-card">
              <span className="de-stat-label">Median Resolution SLA</span>
              <div className="de-stat-row">
                <span className="de-stat-value">26.4</span>
                <span className="de-stat-unit">min</span>
                <span className="de-stat-sub">Target: &lt; 45m</span>
              </div>
            </div>
            <div className="de-stat-card">
              <span className="de-stat-label">Adjudication Ratio</span>
              <div className="de-stat-row">
                <span className="de-stat-value">58% / 34%</span>
                <span className="de-stat-sub">Refund vs Tutor</span>
              </div>
            </div>
            <div className="de-stat-card">
              <span className="de-stat-label">Protection Reserve</span>
              <div className="de-stat-row">
                <span className="de-stat-icon">৳</span>
                <span className="de-stat-value">180,000</span>
                <span className="de-stat-sub">0 Defaults (90d)</span>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="filter-bar">
            <div className="filter-tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  className={`filter-tab ${activeTab === tab.key ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label}
                  <span className="tab-count">{tab.count}</span>
                </button>
              ))}
            </div>
            <div className="filter-controls">
              <div className="search-box">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                <input
                  type="text"
                  placeholder="Filter by ID, session..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <select
                className="filter-select"
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
              >
                <option value="all">All Severities</option>
                <option value="high">High Priority</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <select
                className="filter-select"
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
              >
                <option value="sla">Expiring SLA First</option>
                <option value="newest">Newest First</option>
                <option value="amount">Highest Amount</option>
              </select>
            </div>
          </div>

          {/* Main Grid */}
          <div className="de-grid">
            {/* Queue */}
            <div className="de-queue">
              {filteredDisputes.map((item) => (
                <div key={item.id} className={`de-card ${isExpanded(item.id) ? 'expanded' : ''}`}>
                  {/* Card Header */}
                  <div className="de-card-header">
                    <div className="de-card-left">
                      <span className="de-id">#{item.id}</span>
                      <span className="de-dot">•</span>
                      <span className="de-course">{item.course}</span>
                      <span className="de-dot">•</span>
                      <span className="de-session">Session #{item.session}</span>
                    </div>
                    <div className="de-card-right">
                      <span className={`de-priority-badge ${item.priority === 'HIGH PRIORITY' ? 'high' : 'medium'}`}>
                        {item.priority}
                      </span>
                      <span className="de-sla-text">{item.sla}</span>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="de-card-body">
                    {/* Participants (expanded only) */}
                    {isExpanded(item.id) && (
                      <div className="de-participants">
                        <div className="de-participant">
                          <span className="de-participant-label">STUDENT (COMPLAINANT)</span>
                          <span className="de-participant-name">
                            {item.student.name}
                            <span className="de-participant-id"> ({item.student.id})</span>
                          </span>
                          <span className="de-participant-meta">{item.student.dept} • {item.student.strikes}</span>
                        </div>
                        <div className="de-participant">
                          <span className="de-participant-label">ACCUSED TUTOR</span>
                          <span className="de-participant-name">
                            {item.tutor.name}
                            <span className="de-participant-id"> ({item.tutor.id})</span>
                          </span>
                          <span className="de-participant-meta">Rating: {item.tutor.rating} ★ • {item.tutor.sessions}</span>
                        </div>
                      </div>
                    )}

                    {/* Narrative */}
                    <div className="de-narrative">
                      <span className="de-narrative-label">Dispute Narrative & Claim Statement</span>
                      <p className="de-narrative-text">"{item.narrative}"</p>
                    </div>

                    {/* Evidence (expanded only) */}
                    {isExpanded(item.id) && item.evidence && (
                      <div className="de-evidence">
                        {item.evidence.map((ev, idx) => (
                          <span key={idx} className="de-evidence-file">
                            <span className="de-evidence-icon">{ev.type === 'audio' ? '🔊' : '📄'}</span>
                            {ev.name}
                          </span>
                        ))}
                        <div className="de-escrow-badge">
                          Contested Escrow: <strong>৳ {item.escrow.amount} BDT</strong>
                          <span className="de-escrow-status">({item.escrow.status})</span>
                        </div>
                      </div>
                    )}

                    {/* Telemetry (expanded only) */}
                    {isExpanded(item.id) && item.telemetry && (
                      <div className="de-telemetry">
                        <span className="de-telemetry-icon">⏱</span>
                        <span className="de-telemetry-text">Automated Telemetry: {item.telemetry}</span>
                        <span className="de-telemetry-badge">Log Verified</span>
                      </div>
                    )}

                    {/* Verdict (expanded only) */}
                    {isExpanded(item.id) && item.verdict && (
                      <div className="de-verdict">
                        <div className="de-verdict-header">
                          <span className="de-verdict-title">Arbitration Verdict & Remedy Allocation</span>
                          <span className="de-verdict-rec">Recommended: {item.verdict.recommended}</span>
                        </div>
                        <div className="de-verdict-options">
                          {item.verdict.options.map((opt, idx) => (
                            <label key={idx} className={`de-verdict-option ${opt.selected ? 'selected' : ''}`}>
                              <input type="radio" name="verdict" defaultChecked={opt.selected} />
                              <div className="de-option-content">
                                <span className="de-option-label">{opt.label}</span>
                                <span className="de-option-amount">{opt.amount}</span>
                                <span className="de-option-note">{opt.note}</span>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Simple escrow (non-expanded) */}
                    {!isExpanded(item.id) && (
                      <div className="de-escrow-row">
                        <span className="de-escrow-label">Escrow: <strong>৳ {item.escrow.amount} BDT</strong></span>
                      </div>
                    )}
                  </div>

                  {/* Card Actions */}
                  <div className="de-card-footer">
                    {item.actions.map((action, idx) => (
                      <button key={idx} className={`de-action ${action.primary ? 'primary' : ''} ${action.ghost ? 'ghost' : ''}`}>
                        {action.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Sidebar */}
            <div className="de-sidebar">
              {/* Dispute SLA Watch */}
              <div className="de-sidebar-panel">
                <div className="de-panel-header">
                  <h3 className="de-panel-title">Dispute SLA Watch</h3>
                  <span className="de-panel-sub">Target: 45m</span>
                </div>
                <div className="de-panel-body">
                  <div className="de-sla-breach">
                    <span className="de-sla-label">Next Breach In:</span>
                    <span className="de-sla-time">12m 00s</span>
                    <span className="de-sla-id">(#DISP-9402)</span>
                  </div>
                  <div className="de-sla-bar">
                    <div className="de-sla-bar-fill" style={{width: '73%'}}></div>
                  </div>
                  <div className="de-sla-meta">
                    <span>Elapsed: 33m 00s</span>
                    <span>Max: 45m 00s</span>
                  </div>

                  <div className="de-severity-breakdown">
                    <span className="de-severity-title">SEVERITY BREAKDOWN</span>
                    <div className="de-severity-row">
                      <span className="de-severity-label">High Severity (&lt; 15 min SLA)</span>
                      <span className="de-severity-count">2 cases</span>
                    </div>
                    <div className="de-severity-row">
                      <span className="de-severity-label">Medium Severity (&lt; 1h SLA)</span>
                      <span className="de-severity-count">1 case</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Gateway Health */}
              <div className="de-sidebar-panel">
                <div className="de-panel-header">
                  <h3 className="de-panel-title">Gateway Health</h3>
                  <span className="de-panel-status synced">Synced</span>
                </div>
                <div className="de-panel-body">
                  <div className="de-gateway-row">
                    <span className="de-gateway-label">bKash Escrow Vault:</span>
                    <span className="de-gateway-value connected">Connected</span>
                  </div>
                  <div className="de-gateway-row">
                    <span className="de-gateway-label">Nagad Liquidity Pool:</span>
                    <span className="de-gateway-value ready">100% Ready</span>
                  </div>
                  <div className="de-gateway-row">
                    <span className="de-gateway-label">Bank Wire Settlement:</span>
                    <span className="de-gateway-value">Scheduled</span>
                  </div>

                  <div className="de-hold-section">
                    <div className="de-hold-header">
                      <span className="de-hold-title">Hold Tutor Dispersals</span>
                      <button className="de-hold-btn">Configure</button>
                    </div>
                    <span className="de-hold-sub">Freeze automated releases</span>
                  </div>
                </div>
              </div>

              {/* Duty Arbitrator */}
              <div className="de-sidebar-panel">
                <div className="de-panel-header">
                  <h3 className="de-panel-title">Duty Arbitrator</h3>
                  <span className="de-panel-sub">Active Shift</span>
                </div>
                <div className="de-panel-body">
                  <div className="de-arbitrator">
                    <div className="de-arbitrator-avatar">EV</div>
                    <div className="de-arbitrator-info">
                      <span className="de-arbitrator-name">Dr. E. Vance</span>
                      <span className="de-arbitrator-role">Chief Arbitrator</span>
                    </div>
                    <span className="de-arbitrator-active">3 active</span>
                  </div>
                  <button className="de-next-btn">Arbitrate Next in Queue</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DisputesEscrow;
