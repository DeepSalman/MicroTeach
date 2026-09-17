import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Home from './Home';
import Login from './Login';
import Register from './Register';
import CreatePost from './CreatePost';
import UserList from './UserList';
import Skills from './Skills';
import Profile from './Profile';
import EditProfile from './EditProfile';
import BecomeTeacher from './BecomeTeacher';

const CURRENT_USER_KEY = 'microteach_current_user';
const ACTIVE_MODE_KEY = 'microteach_active_mode';

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
    const storedUser = localStorage.getItem(CURRENT_USER_KEY);

    if (!storedUser) return null;

    try {
      return JSON.parse(storedUser);
    } catch {
      localStorage.removeItem(CURRENT_USER_KEY);
      return null;
    }
  });
  const [activeMode, setActiveMode] = useState(() => {
    const savedMode = localStorage.getItem(ACTIVE_MODE_KEY);
    if (savedMode) return savedMode;
    return currentUser?.role === 'tutor' ? 'teacher' : 'student';
  });

  const handleLogin = (userData) => {
    setCurrentUser(userData);
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(userData));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem(CURRENT_USER_KEY);
    localStorage.removeItem(ACTIVE_MODE_KEY);
  };

  const handleProfileUpdate = (updatedUser) => {
    setCurrentUser(updatedUser);
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updatedUser));
  };

  const handleModeChange = (mode) => {
    setActiveMode(mode);
    localStorage.setItem(ACTIVE_MODE_KEY, mode);
  };

  const handleUserUpdate = (updatedUser) => {
    setCurrentUser(updatedUser);
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updatedUser));
  };

  return (
    <Router>
      <Routes>
        {/* Home page - protected from unauthenticated visitors */}
        <Route 
          path="/" 
          element={
            currentUser ? (
              <Home user={currentUser} activeMode={activeMode} onModeChange={handleModeChange} onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" replace />
            )
          } 
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
              <Profile user={currentUser} activeMode={activeMode} onModeChange={handleModeChange} />
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

        {/* Teacher onboarding - protected route */}
        <Route
          path="/become-teacher"
          element={
            currentUser ? (
              <BecomeTeacher user={currentUser} onUserUpdate={handleUserUpdate} onModeChange={handleModeChange} />
            ) : (
              <Navigate to="/login" />
            )
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
