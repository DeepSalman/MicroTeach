import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import './ContentModeration.css';

const ContentModeration = ({ user }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [sortOption, setSortOption] = useState('priority');

  const moderationItems = [
    {
      id: 'MOD-9104',
      course: 'CSE 221 • Algorithms',
      time: '8 min ago',
      aiConfidence: '99.2%',
      requestor: {
        name: 'Tanvir Ahmed',
        id: '#21101428',
        details: 'CSE 6th Sem • CGPA 3.42 • 0 prior strikes',
      },
      violation: 'SEC 4.2 Body Match',
      title: 'Need urgent solution for Dijkstra graph with dynamic weight updating within 20 mins',
      description: 'Hello, I am stuck on this graph problem for an active test. Consider a directed weighted graph G=(V,E) where edge weights update periodically via matrix W(t)... This is question 3b from current ongoing morning assessment. Paying double bounty (৳ 700) if solved before 11:30 AM. Need C++ code with complexity O(E log V) or explanation.',
      attachment: {
        name: 'CSE221_Fall24_SetB.pdf',
        status: 'Vault Matched',
        details: 'question_snapshot_paper.jpg (1.8 MB)',
        overlap: '99.2%',
      },
      type: 'exam-leak',
      urgent: true,
    },
    {
      id: 'MOD-9098',
      course: 'MAT 215 • Complex Variables',
      time: '32m ago',
      aiConfidence: '94.5%',
      requestor: {
        name: 'anonymous_student_91',
        ip: '103.144.12.8',
      },
      violation: 'Commercial Spam',
      title: 'WhatsApp me on +88017XXXXXXXX for guaranteed A grade assignments and lab report packages...',
      type: 'spam',
    },
    {
      id: 'MOD-9082',
      course: 'EEE 301 • Signals & Systems',
      time: '1h ago',
      aiConfidence: '88.0%',
      requestor: {
        name: 'Nabila Farhan',
        id: '#19301012',
      },
      violation: 'Escrow Bypass',
      title: "Don't pay through MicroTeach escrow, send bKash directly to personal number 01912XXXXXX to avoid platform fees...",
      type: 'escrow-bypass',
    },
  ];

  const tabs = [
    { key: 'all', label: 'All', count: 14 },
    { key: 'exam-leak', label: 'Exam Leaks', count: 6 },
    { key: 'spam', label: 'Spam', count: 3 },
    { key: 'contact-sharing', label: 'Contact Sharing', count: 3 },
    { key: 'other', label: 'Other', count: 2 },
  ];

  const filteredItems = moderationItems.filter((item) => {
    if (activeTab !== 'all' && item.type !== activeTab) return false;
    if (searchQuery && !item.id.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !item.course.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

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
                <span className="breadcrumb-active">Content Moderation</span>
              </div>
              <h1 className="page-title">Content Moderation</h1>
            </div>
            <div className="page-header-actions">
              <button className="btn-outline">
                <span className="btn-icon">⚙</span>
                Rules Config
              </button>
              <button className="btn-primary">
                <span className="btn-icon">↓</span>
                Export Log
              </button>
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
                  placeholder="Search by flag ID, course, student..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <select
                className="filter-select"
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
              >
                <option value="all">All Departments</option>
                <option value="cse">Computer Science (CSE)</option>
                <option value="eee">Electrical Eng (EEE)</option>
                <option value="mns">Mathematics (MNS)</option>
              </select>
              <select
                className="filter-select"
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
              >
                <option value="priority">Priority / Urgency</option>
                <option value="newest">Newest First</option>
                <option value="confidence">AI Confidence</option>
              </select>
            </div>
          </div>

          {/* Moderation Queue */}
          <div className="moderation-queue">
            {filteredItems.map((item) => (
                <div key={item.id} className="mod-card">
                  {/* Card Header */}
                  <div className="mod-card-header">
                    <div className="mod-card-left">
                      <span className="mod-id">{item.id}</span>
                      <span className="mod-dot">•</span>
                      <span className="mod-course">{item.course}</span>
                      <span className="mod-dot">•</span>
                      <span className="mod-time">{item.time}</span>
                    </div>
                    <div className="mod-card-right">
                      {item.urgent && <span className="urgent-badge">URGENT</span>}
                      <span className="ai-badge">{item.aiConfidence}</span>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="mod-card-body">
                    {/* Requestor Row */}
                    <div className="mod-requestor">
                      <div className="requestor-info">
                        <span className="requestor-name">
                          {item.requestor.name}
                          {item.requestor.id && (
                            <span className="requestor-id"> {item.requestor.id}</span>
                          )}
                          {item.requestor.ip && (
                            <span className="requestor-ip"> (IP: {item.requestor.ip})</span>
                          )}
                        </span>
                        {item.requestor.details && (
                          <span className="requestor-meta">{item.requestor.details}</span>
                        )}
                      </div>
                      <span className="violation-tag">{item.violation}</span>
                    </div>

                    {/* Flagged Content */}
                    <div className="mod-flagged">
                      <p className="flagged-text">"{item.title}"</p>
                      {item.description && (
                        <p className="flagged-desc">{item.description}</p>
                      )}
                    </div>

                    {/* Attachment (if exists) */}
                    {item.attachment && (
                      <div className="mod-attachment">
                        <div className="attachment-left">
                          <div className="attachment-icon">📄</div>
                          <div className="attachment-info">
                            <span className="attachment-name">{item.attachment.name}</span>
                            <span className="attachment-meta">{item.attachment.details}</span>
                          </div>
                        </div>
                        <div className="attachment-right">
                          <span className="vault-badge">{item.attachment.status}</span>
                          <span className="overlap-text">{item.attachment.overlap} overlap</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card Actions */}
                  <div className="mod-card-footer">
                    {item.type === 'exam-leak' && (
                      <>
                        <button className="mod-action primary">Quarantine Post</button>
                        <button className="mod-action">Issue Warning</button>
                        <button className="mod-action">Inspect Session</button>
                        <button className="mod-action ghost">Dismiss</button>
                      </>
                    )}
                    {item.type === 'spam' && (
                      <>
                        <button className="mod-action primary">Quarantine & Ban</button>
                        <button className="mod-action">Quarantine Only</button>
                        <button className="mod-action ghost">Dismiss</button>
                      </>
                    )}
                    {item.type === 'escrow-bypass' && (
                      <>
                        <button className="mod-action primary">Freeze Wallet</button>
                        <button className="mod-action">Warn User</button>
                        <button className="mod-action ghost">Dismiss</button>
                      </>
                    )}
                  </div>
                </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContentModeration;
