import React from 'react';
import { Outlet } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';

const AdminLayout = ({ user, onLogout }) => {
  return (
    <div className="admin-page">
      <AdminSidebar user={user} onLogout={onLogout} />
      <div className="admin-main">
        <Outlet />
      </div>
    </div>
  );
};

export default AdminLayout;
