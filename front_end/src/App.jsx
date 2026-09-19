import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Home from './Home';
import Login from './Login';
import Register from './Register';
import CreatePost from './CreatePost';
import UserList from './UserList';
import Skills from './Skills';
import Profile from './Profile';
import EditProfile from './EditProfile';
import AdminPanel from './AdminPanel';
import UserManagement from './UserManagement';
import ContentModeration from './ContentModeration';
import ReportQueue from './ReportQueue';
import DisputesEscrow from './DisputesEscrow';
import TeacherApplications from './TeacherApplications';

// Dashboard - shown after login
const Dashboard = ({ user, onLogout }) => {
  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '10px', borderBottom: '1px solid #ddd' }}>
        <h2>Microteach Dashboard</h2>
        <div>
          <span style={{ marginRight: '15px' }}>Logged in as: <strong>{user?.email}</strong></span>
          <button onClick={onLogout} style={{ padding: '6px 12px', cursor: 'pointer' }}>Logout</button>
        </div>
      </header>

      <UserList />
      <Skills />
    </div>
  );
};

function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('microteach_user');
    return saved ? JSON.parse(saved) : null;
  });

  const handleLogin = (userData) => {
    localStorage.setItem('microteach_user', JSON.stringify(userData));
    setCurrentUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('microteach_user');
    setCurrentUser(null);
  };

  const handleProfileUpdate = (updatedUser) => {
    localStorage.setItem('microteach_user', JSON.stringify(updatedUser));
    setCurrentUser(updatedUser);
  };

  return (
    <Router>
      <Routes>
        {/* Landing page - marketplace home, passes user state */}
        <Route 
          path="/" 
          element={<Home user={currentUser} onLogout={handleLogout} />} 
        />

        {/* Login page */}
        <Route 
          path="/login" 
          element={
            currentUser ? (
              <Navigate to="/" />
            ) : (
              <Login onLogin={handleLogin} />
            )
          } 
        />

        {/* Register page */}
        <Route 
          path="/register" 
          element={
            currentUser ? (
              <Navigate to="/" />
            ) : (
              <Register />
            )
          } 
        />

        {/* Create Post page - protected */}
        <Route 
          path="/create-post" 
          element={
            currentUser ? (
              <CreatePost user={currentUser} />
            ) : (
              <Navigate to="/login" />
            )
          } 
        />

        {/* Dashboard - protected route */}
        <Route 
          path="/dashboard" 
          element={
            currentUser ? (
              <Dashboard user={currentUser} onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" />
            )
          } 
        />

        {/* Profile page - protected route */}
        <Route 
          path="/profile" 
          element={
            currentUser ? (
              <Profile user={currentUser} onLogout={handleLogout} onProfileUpdate={handleProfileUpdate} />
            ) : (
              <Navigate to="/login" />
            )
          } 
        />

        {/* Edit Profile page - protected route */}
        <Route 
          path="/edit-profile" 
          element={
            currentUser ? (
              <EditProfile user={currentUser} onProfileUpdate={handleProfileUpdate} />
            ) : (
              <Navigate to="/login" />
            )
          } 
        />

        {/* Admin Panel - protected route, only for admins */}
        <Route 
          path="/admin" 
          element={
            currentUser && currentUser.is_admin === 1 ? (
              <AdminPanel user={currentUser} />
            ) : (
              <Navigate to="/" />
            )
          } 
        />

        {/* User Management - protected route, only for admins */}
        <Route 
          path="/admin/users" 
          element={
            currentUser && currentUser.is_admin === 1 ? (
              <UserManagement user={currentUser} />
            ) : (
              <Navigate to="/" />
            )
          } 
        />

        {/* Content Moderation - protected route, only for admins */}
        <Route 
          path="/admin/moderation" 
          element={
            currentUser && currentUser.is_admin === 1 ? (
              <ContentModeration user={currentUser} />
            ) : (
              <Navigate to="/" />
            )
          } 
        />

        {/* Report Queue - protected route, only for admins */}
        <Route 
          path="/admin/reports" 
          element={
            currentUser && currentUser.is_admin === 1 ? (
              <ReportQueue user={currentUser} />
            ) : (
              <Navigate to="/" />
            )
          } 
        />

        {/* Disputes & Escrow - protected route, only for admins */}
        <Route 
          path="/admin/disputes" 
          element={
            currentUser && currentUser.is_admin === 1 ? (
              <DisputesEscrow user={currentUser} />
            ) : (
              <Navigate to="/" />
            )
          } 
        />

        {/* Teacher Applications - protected route, only for admins */}
        <Route 
          path="/admin/teacher-applications" 
          element={
            currentUser && currentUser.is_admin === 1 ? (
              <TeacherApplications user={currentUser} />
            ) : (
              <Navigate to="/" />
            )
          } 
        />
      </Routes>
    </Router>
  );
}

export default App;
