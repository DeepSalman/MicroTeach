import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './Login';
import Register from './Register';
import UserList from './UserList';
import Skills from './Skills';

// Home Dashboard containing current active components
const Home = ({ user, onLogout }) => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '10px', borderBottom: '1px solid #ddd' }}>
        <h2>Microteach Dashboard</h2>
        <div>
          <span style={{ marginRight: '15px' }}>Logged in as: <strong>{user?.email}</strong></span>
          <button onClick={onLogout} style={{ padding: '6px 12px', cursor: 'pointer' }}>Logout</button>
        </div>
      </header>

      <UserList refreshSignal={refreshTrigger} />
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
        <Route 
          path="/" 
          element={currentUser ? <Navigate to="/home" /> : <Navigate to="/login" />} 
        />

        <Route 
          path="/login" 
          element={<Login onLogin={handleLogin} />} 
        />

        <Route 
          path="/register" 
          element={<Register />} 
        />

        <Route 
          path="/home" 
          element={
            currentUser ? (
              <Home user={currentUser} onLogout={handleLogout} />
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