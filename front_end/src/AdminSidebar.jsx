import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { fetchTeacherApplications } from './api';

const AdminSidebar = ({ user, userCount, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [appCount, setAppCount] = useState(0);

  useEffect(() => {
    loadAppCount();
  }, []);

  const loadAppCount = async () => {
    try {
      const response = await fetchTeacherApplications();
      setAppCount(response.data.length);
    } catch (err) {
      console.error('Failed to load application count:', err);
    }
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const isActive = (path) => location.pathname === path;

  const handleLogout = () => {
    if (onLogout) onLogout();
  };

  return (
    <aside className="admin-sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">MT</div>
          <div className="sidebar-logo-text">
            <span className="logo-title">MicroTeach</span>
            <span className="logo-subtitle">Admin Portal <span className="version">v2.4</span></span>
          </div>
        </div>
      </div>
      <div className="sidebar-status">
        <span className="sidebar-status-dot"></span>
        <span>Node: Academic-East</span>
        <span className="status-active">Active</span>
      </div>
      <nav className="sidebar-nav">
        <div className="nav-section">
          <button className={`nav-item ${isActive('/admin') ? 'active' : ''}`} onClick={() => navigate('/admin')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" strokeLinecap="round" strokeLinejoin="round"/><rect x="14" y="3" width="7" height="7" strokeLinecap="round" strokeLinejoin="round"/><rect x="14" y="14" width="7" height="7" strokeLinecap="round" strokeLinejoin="round"/><rect x="3" y="14" width="7" height="7" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Dashboard
          </button>
          <button className={`nav-item ${isActive('/admin/users') ? 'active' : ''}`} onClick={() => navigate('/admin/users')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="9" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round"/><path d="M23 21v-2a4 4 0 0 0-3-3.87" strokeLinecap="round" strokeLinejoin="round"/><path d="M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" strokeLinejoin="round"/></svg>
            User Management
            {userCount !== undefined && <span className="nav-badge">{userCount}</span>}
          </button>
          <button className={`nav-item ${isActive('/admin/moderation') ? 'active' : ''}`} onClick={() => navigate('/admin/moderation')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9" strokeLinecap="round" strokeLinejoin="round"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Content Moderation
          </button>
          <button className={`nav-item ${isActive('/admin/reports') ? 'active' : ''}`} onClick={() => navigate('/admin/reports')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinecap="round" strokeLinejoin="round"/><polyline points="14 2 14 8 20 8" strokeLinecap="round" strokeLinejoin="round"/><line x1="16" y1="13" x2="8" y2="13" strokeLinecap="round" strokeLinejoin="round"/><line x1="16" y1="17" x2="8" y2="17" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Report Queue
          </button>
          <button className={`nav-item ${isActive('/admin/disputes') ? 'active' : ''}`} onClick={() => navigate('/admin/disputes')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round"/><line x1="12" y1="8" x2="12" y2="12" strokeLinecap="round" strokeLinejoin="round"/><line x1="12" y1="16" x2="12.01" y2="16" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Disputes &amp; Escrow
          </button>
          <button className={`nav-item ${isActive('/admin/teacher-applications') ? 'active' : ''}`} onClick={() => navigate('/admin/teacher-applications')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="9" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round"/><path d="M23 21v-2a4 4 0 0 0-3-3.87" strokeLinecap="round" strokeLinejoin="round"/><path d="M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Teacher Applications
            {appCount > 0 && <span className="nav-badge">{appCount}</span>}
          </button>
        </div>
        <div className="nav-divider"></div>
        <div className="nav-section">
          <div className="nav-section-label">SYSTEM &amp; DATA</div>
          <button className="nav-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="5" rx="9" ry="3" strokeLinecap="round" strokeLinejoin="round"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" strokeLinecap="round" strokeLinejoin="round"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Master Data
          </button>
          <button className="nav-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Audit Log
          </button>
          <button className="nav-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" strokeLinecap="round" strokeLinejoin="round"/></svg>
            System Settings
          </button>
        </div>
      </nav>
      <div className="sidebar-footer">
        <div className="sidebar-user" onClick={() => setMenuOpen(!menuOpen)} style={{cursor: 'pointer'}}>
          <div className="sidebar-user-avatar">{getInitials(user?.full_name)}</div>
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{user?.full_name || 'Admin'}</span>
            <span className="sidebar-user-role">Super Admin</span>
          </div>
        </div>
        {menuOpen && (
          <div className="sidebar-dropdown">
            <button className="sidebar-dropdown-item" onClick={() => { setMenuOpen(false); navigate('/'); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Student Panel
            </button>
            <button className="sidebar-dropdown-item logout" onClick={handleLogout}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" strokeLinecap="round" strokeLinejoin="round"/><polyline points="16 17 21 12 16 7" strokeLinecap="round" strokeLinejoin="round"/><line x1="21" y1="12" x2="9" y2="12" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Log out
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};

export default AdminSidebar;
