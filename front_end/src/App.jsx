import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Home from './Home';
import Login from './Login';
import Register from './Register';
import CreatePost from './CreatePost';
import UserList from './UserList';
import Skills from './Skills';
import Profile from './Profile';
import EditProfile from './EditProfile';
import AdminLayout from './AdminLayout';
import AdminPanel from './AdminPanel';
import UserManagement from './UserManagement';
import ContentModeration from './ContentModeration';
import ReportQueue from './ReportQueue';
import DisputesEscrow from './DisputesEscrow';
import TeacherApplications from './TeacherApplications';
import MasterData from './MasterData';
import ErrorBoundary from './ErrorBoundary';

// Shared page-load transition: remounts the page shell on every path change
// so the entrance animation replays on each navigation.
const PageEnter = ({ children, replay = true }) => {
  const { pathname } = useLocation();
  return (
    <div className="page-enter" key={replay ? pathname : 'page'}>
      {children}
    </div>
  );
};

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

// Dashboard - shown after login
const Dashboard = ({ user, onLogout }) => {
  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '10px', borderBottom: '1px solid var(--color-border)' }}>
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

const RequireAdmin = ({ currentUser, children }) => {
  if (!currentUser || currentUser.is_admin !== 1) {
    return <Navigate to="/" />;
  }
  return children;
};

function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('microteach_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      localStorage.removeItem('microteach_user');
      return null;
    }
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
      <ScrollToTop />
      <ErrorBoundary>
      <Routes>
        {/* Landing page - marketplace home, passes user state */}
        <Route 
          path="/" 
          element={<PageEnter><Home user={currentUser} onLogout={handleLogout} onProfileUpdate={handleProfileUpdate} /></PageEnter>} 
        />

        {/* Login page */}
        <Route 
          path="/login" 
          element={
            currentUser ? (
              <Navigate to="/" />
            ) : (
              <PageEnter><Login onLogin={handleLogin} /></PageEnter>
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
              <PageEnter><Register /></PageEnter>
            )
          } 
        />

        {/* Create Post page - protected */}
        <Route 
          path="/create-post" 
          element={
            currentUser ? (
              <PageEnter><CreatePost user={currentUser} /></PageEnter>
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
              <PageEnter><Dashboard user={currentUser} onLogout={handleLogout} /></PageEnter>
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
              <PageEnter><Profile user={currentUser} onLogout={handleLogout} onProfileUpdate={handleProfileUpdate} /></PageEnter>
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
              <PageEnter><EditProfile user={currentUser} onProfileUpdate={handleProfileUpdate} /></PageEnter>
            ) : (
              <Navigate to="/login" />
            )
          } 
        />

        {/* Admin routes - sidebar renders once via AdminLayout */}
        <Route
          path="/admin"
          element={
            <RequireAdmin currentUser={currentUser}>
              <PageEnter replay={false}><AdminLayout user={currentUser} onLogout={handleLogout} /></PageEnter>
            </RequireAdmin>
          }
        >
          <Route index element={<PageEnter><AdminPanel user={currentUser} /></PageEnter>} />
          <Route path="users" element={<PageEnter><UserManagement user={currentUser} /></PageEnter>} />
          <Route path="moderation" element={<PageEnter><ContentModeration user={currentUser} /></PageEnter>} />
          <Route path="reports" element={<PageEnter><ReportQueue user={currentUser} /></PageEnter>} />
          <Route path="disputes" element={<PageEnter><DisputesEscrow user={currentUser} /></PageEnter>} />
          <Route path="teacher-applications" element={<PageEnter><TeacherApplications user={currentUser} /></PageEnter>} />
          <Route path="master-data" element={<PageEnter><MasterData user={currentUser} /></PageEnter>} />
        </Route>

        {/* Fallback wildcard route to avoid blank screens on unmatched URLs */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </ErrorBoundary>
    </Router>
  );
}

export default App;
