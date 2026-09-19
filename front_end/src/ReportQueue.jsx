import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import './ReportQueue.css';

const ReportQueue = ({ user }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const reports = [
    {
      id: 'MT-8842',
      type: 'Escrow Dispute',
      typeColor: '#dc2626',
      time: '12m ago',
      title: 'Escrow Dispute: Solution not delivered before submission deadline',
      description: 'Student states code snippets provided failed testcases 10 minutes prior to LMS window close.',
      participants: {
        student: { name: 'Tanvir Ahmed', dept: 'CSE Dept', sem: '6th Sem' },
        tutor: { name: 'Fahim Kabir', dept: 'CSE Dept' },
      },
      meta: { label: 'Locked Bounty', value: '৳ 450 BDT' },
      actions: [
        { label: 'View Chat Logs', icon: '💬', primary: false },
        { label: 'Arbitrate Dispute', icon: '⚖', primary: true },
      ],
      priority: 'high',
    },
    {
      id: 'MT-8839',
      type: 'Integrity Flag',
      typeColor: '#f59e0b',
      time: '28m ago',
      title: 'Flagged Content: Prohibited exam code sharing in problem body',
      description: 'Author: anonymous_student_91 • Automated code scanner flagged 98.4% match with exam repository.',
      course: 'CSE 221',
      meta: { label: 'Violation Code', value: 'ACAD-HONOR-SEC4.2', icon: '🛡' },
      actions: [
        { label: 'Dismiss', primary: false },
        { label: 'Quarantine Post', primary: true },
      ],
    },
    {
      id: 'MT-8831',
      type: 'Credential Review',
      typeColor: '#3b82f6',
      time: '45m ago',
      title: 'Tutor Verification Request: Needs transcript & CGPA check',
      description: 'Candidate: Nusrat Jahan (CGPA: 3.92, Mathematics Dept) uploaded official transcript PDF.',
      meta: { label: 'Documents', value: 'OfficialGradeSheet_Fall24.pdf', icon: '📄' },
      actions: [
        { label: 'Review Credentials', icon: '👁', primary: false },
        { label: 'Approve', icon: '✓', primary: true },
      ],
    },
    {
      id: 'MT-8815',
      type: 'Session Report',
      typeColor: '#8b5cf6',
      time: '1h ago',
      title: 'No-Show Report: Tutor failed to join scheduled Google Meet',
      description: 'Session ID: #SES-4920 • Requester: Rafiqul Islam. Tutor inactive for >15 mins.',
      meta: { label: 'Locked Escrow', value: '৳ 350 BDT' },
      extra: 'WebRTC Attendance: Student (18m) • Tutor (0m)',
      actions: [
        { label: 'Investigate', primary: false },
        { label: 'Refund Student', icon: '↻', primary: true },
      ],
    },
  ];

  const tabs = [
    { key: 'all', label: 'All', count: 23 },
    { key: 'dispute', label: 'Critical Disputes', count: 3 },
    { key: 'integrity', label: 'Academic Integrity', count: 8 },
    { key: 'harassment', label: 'Harassment Reports', count: 4 },
    { key: 'credential', label: 'Credential Reviews', count: 5 },
    { key: 'session', label: 'Session Reports', count: 3 },
  ];

  const filteredReports = reports.filter((item) => {
    if (activeTab !== 'all') {
      const tabMap = { dispute: 'Escrow Dispute', integrity: 'Integrity Flag', credential: 'Credential Review', session: 'Session Report' };
      if (tabMap[activeTab] && item.type !== tabMap[activeTab]) return false;
    }
    if (searchQuery && !item.id.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !item.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const activityLog = [
    { initials: 'SK', name: 'Sarah K.', action: 'resolved #MT-8790', detail: 'Escrow released • ৳ 600', time: '8m ago', color: '#3b82f6' },
    { initials: 'ZR', name: 'Z. Rahman', action: 'banned @scam_test', detail: 'Spam on Discussion Board', time: '24m ago', color: '#dc2626' },
    { initials: 'SYS', name: 'System', action: 'closed #MT-8765', detail: 'Resolved after 48h idle', time: '1h ago', color: '#6b7280' },
  ];

  return (
    <div className="admin-page">
      <AdminSidebar user={user} />

      <div className="admin-main">
        <div className="admin-content">
          {/* Header */}
          <div className="page-header">
            <div className="page-header-left">
              <div className="breadcrumb">
                <span>Institutional Governance</span>
                <span className="breadcrumb-sep">›</span>
                <span className="breadcrumb-active">Report Queue</span>
              </div>
              <h1 className="page-title">Report Queue</h1>
            </div>
            <div className="page-header-actions">
              <button className="btn-outline">
                <span className="btn-icon">⚙</span>
                Escalation Rules
              </button>
              <button className="btn-primary">
                <span className="btn-icon">↓</span>
                Export Log
              </button>
            </div>
          </div>

          {/* Stat Cards */}
          <div className="rq-stats">
            <div className="rq-stat-card">
              <span className="rq-stat-label">Total Open Reports</span>
              <div className="rq-stat-row">
                <span className="rq-stat-value">23</span>
                <span className="rq-stat-sub">Pending</span>
              </div>
            </div>
            <div className="rq-stat-card">
              <span className="rq-stat-label">Resolved Today</span>
              <div className="rq-stat-row">
                <span className="rq-stat-value">14</span>
                <span className="rq-stat-sub positive">+32%</span>
              </div>
            </div>
            <div className="rq-stat-card">
              <span className="rq-stat-label">Avg Resolution Time</span>
              <div className="rq-stat-row">
                <span className="rq-stat-value">4.2 min</span>
                <span className="rq-stat-sub positive">-18%</span>
              </div>
            </div>
            <div className="rq-stat-card">
              <span className="rq-stat-label">Auto-Escalated</span>
              <div className="rq-stat-row">
                <span className="rq-stat-value">6</span>
                <span className="rq-stat-sub">Cases</span>
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
                  placeholder="Search by report ID, student, tutor..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <select
                className="filter-select"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="all">All Types</option>
                <option value="dispute">Escrow Disputes</option>
                <option value="integrity">Integrity Flags</option>
                <option value="credential">Credential Reviews</option>
                <option value="session">Session Reports</option>
              </select>
              <select
                className="filter-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="open">Open</option>
                <option value="investigating">Investigating</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
          </div>

          {/* Main Grid */}
          <div className="rq-grid">
            {/* Queue */}
            <div className="rq-queue">
              {filteredReports.map((item) => (
                <div key={item.id} className="rq-card">
                  {/* Card Header */}
                  <div className="rq-card-header">
                    <div className="rq-card-left">
                      <span className="rq-type-badge" style={{background: item.typeColor + '15', color: item.typeColor, borderColor: item.typeColor + '30'}}>
                        {item.type}
                      </span>
                      <span className="rq-id">#{item.id}</span>
                      <span className="rq-dot">•</span>
                      <span className="rq-time">{item.time}</span>
                    </div>
                    <div className="rq-card-right">
                      {item.course && <span className="rq-course">{item.course}</span>}
                      {item.meta && (
                        <span className="rq-meta-badge">
                          {item.meta.icon && <span>{item.meta.icon}</span>}
                          {item.meta.label}: {item.meta.value}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="rq-card-body">
                    <h3 className="rq-title">{item.title}</h3>
                    <p className="rq-desc">{item.description}</p>

                    {/* Participants */}
                    {item.participants && (
                      <div className="rq-participants">
                        <div className="rq-participant">
                          <span className="rq-participant-label">Student</span>
                          <span className="rq-participant-name">
                            {item.participants.student.name}
                            <span className="rq-participant-meta"> ({item.participants.student.dept} • {item.participants.student.sem})</span>
                          </span>
                        </div>
                        <span className="rq-vs">VS</span>
                        <div className="rq-participant">
                          <span className="rq-participant-label">Assigned Tutor</span>
                          <span className="rq-participant-name">
                            {item.participants.tutor.name}
                            <span className="rq-participant-meta"> ({item.participants.tutor.dept})</span>
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Extra info */}
                    {item.extra && (
                      <div className="rq-extra">
                        <span className="rq-extra-icon">📹</span>
                        <span className="rq-extra-text">{item.extra}</span>
                      </div>
                    )}
                  </div>

                  {/* Card Actions */}
                  <div className="rq-card-footer">
                    {item.actions.map((action, idx) => (
                      <button key={idx} className={`rq-action ${action.primary ? 'primary' : ''}`}>
                        {action.icon && <span className="rq-action-icon">{action.icon}</span>}
                        {action.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Sidebar */}
            <div className="rq-sidebar">
              {/* Campus Live Health */}
              <div className="rq-sidebar-panel">
                <div className="rq-panel-header">
                  <h3 className="rq-panel-title">Campus Live Health</h3>
                  <span className="rq-panel-icon">📡</span>
                </div>
                <div className="rq-panel-body">
                  <div className="rq-health-stat">
                    <span className="rq-health-label">Active Websockets</span>
                    <span className="rq-health-value">842 Students</span>
                  </div>

                  <div className="rq-dept-breakdown">
                    <div className="rq-dept-header">
                      <span className="rq-dept-title">Peak Demand by Department</span>
                      <span className="rq-dept-split">Split</span>
                    </div>
                    <div className="rq-dept-row">
                      <div className="rq-dept-left">
                        <span className="rq-dept-dot" style={{background: '#1a1a2e'}}></span>
                        <span className="rq-dept-name">Computer Science & Engineering</span>
                      </div>
                      <span className="rq-dept-pct">52%</span>
                    </div>
                    <div className="rq-dept-row">
                      <div className="rq-dept-left">
                        <span className="rq-dept-dot" style={{background: '#3b82f6'}}></span>
                        <span className="rq-dept-name">Electrical & Electronic Eng</span>
                      </div>
                      <span className="rq-dept-pct">24%</span>
                    </div>
                    <div className="rq-dept-row">
                      <div className="rq-dept-left">
                        <span className="rq-dept-dot" style={{background: '#f59e0b'}}></span>
                        <span className="rq-dept-name">BBA & Accounting</span>
                      </div>
                      <span className="rq-dept-pct">14%</span>
                    </div>
                    <div className="rq-dept-row">
                      <div className="rq-dept-left">
                        <span className="rq-dept-dot" style={{background: '#8b5cf6'}}></span>
                        <span className="rq-dept-name">Mathematics & Science</span>
                      </div>
                      <span className="rq-dept-pct">10%</span>
                    </div>
                  </div>

                  <div className="rq-node-status">
                    <span className="rq-node-title">Node Status</span>
                    <div className="rq-node-row">
                      <div className="rq-node-left">
                        <span className="rq-node-dot online"></span>
                        <div className="rq-node-info">
                          <span className="rq-node-name">WebRTC Mesh</span>
                          <span className="rq-node-sub">Audio/Video</span>
                        </div>
                      </div>
                      <span className="rq-node-value healthy">100% Healthy</span>
                    </div>
                    <div className="rq-node-row">
                      <div className="rq-node-left">
                        <span className="rq-node-dot online"></span>
                        <div className="rq-node-info">
                          <span className="rq-node-name">bKash / Nagad</span>
                          <span className="rq-node-sub">Gateway</span>
                        </div>
                      </div>
                      <span className="rq-node-value">120ms Latency</span>
                    </div>
                    <div className="rq-node-row">
                      <div className="rq-node-left">
                        <span className="rq-node-dot online"></span>
                        <div className="rq-node-info">
                          <span className="rq-node-name">Honor Code</span>
                          <span className="rq-node-sub">Classifier</span>
                        </div>
                      </div>
                      <span className="rq-node-value healthy">99.4% Accuracy</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Moderator Activity Log */}
              <div className="rq-sidebar-panel">
                <div className="rq-panel-header">
                  <h3 className="rq-panel-title">Moderator Activity Log</h3>
                  <span className="rq-panel-sub">Real-time audit events</span>
                </div>
                <div className="rq-panel-body">
                  {activityLog.map((log, idx) => (
                    <div key={idx} className="rq-log-item">
                      <div className="rq-log-avatar" style={{background: log.color}}>
                        {log.initials}
                      </div>
                      <div className="rq-log-info">
                        <span className="rq-log-text">
                          <strong>{log.name}</strong> {log.action}
                        </span>
                        <span className="rq-log-detail">{log.detail}</span>
                        <span className="rq-log-time">{log.time}</span>
                      </div>
                    </div>
                  ))}
                  <button className="rq-view-all">View Full Chronicle →</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportQueue;
