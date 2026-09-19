import React from 'react';
import { useNavigate } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import './ContentModeration.css';

const ContentModeration = ({ user }) => {
  const navigate = useNavigate();

  return (
    <div className="admin-page">
      <AdminSidebar user={user} />

      <div className="admin-main">
        <div className="admin-content">
          <div className="page-header">
            <div className="page-header-left">
              <div className="breadcrumb">
                <span>Institutional Governance</span>
                <span className="breadcrumb-sep">›</span>
                <span className="breadcrumb-active">Content Moderation</span>
              </div>
              <h1 className="page-title">Reported Posts</h1>
            </div>
          </div>

          <div className="empty-state">
            <p>No reported posts yet.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContentModeration;
