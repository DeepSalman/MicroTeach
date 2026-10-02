import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';

const AdminLayout = ({ user, onLogout }) => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="admin-page">
      {/* Mobile Top App Bar */}
      <header className="admin-mobile-topbar">
        <button
          type="button"
          className="admin-hamburger-btn"
          onClick={() => setMobileSidebarOpen(true)}
          aria-label="Open Navigation Menu"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
        <div className="admin-mobile-brand">
          <img src="/logo.png" alt="MicroTeach" className="admin-mobile-logo" />
          <div className="admin-mobile-text">
            <span className="admin-mobile-title">MicroTeach</span>
            <span className="admin-mobile-sub">Admin Portal</span>
          </div>
        </div>
      </header>

      {/* Backdrop for mobile drawer */}
      {mobileSidebarOpen && (
        <div
          className="admin-sidebar-backdrop"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      <AdminSidebar
        user={user}
        onLogout={onLogout}
        isOpen={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
      />
      <div className="admin-main">
        <Outlet />
      </div>
    </div>
  );
};

export default AdminLayout;
