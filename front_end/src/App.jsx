import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Home from './Home';
import Login from './Login';
import Register from './Register';
import CreatePost from './CreatePost';
import UserList from './UserList';
import Skills from './Skills';

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
  const [currentUser, setCurrentUser] = useState(null);

  const handleLogin = (userData) => {
    setCurrentUser(userData);
  };

  const handleLogout = () => {
    setCurrentUser(null);
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
      </Routes>
    </Router>
  );
}

export default App;
