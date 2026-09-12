import React, { useEffect, useState } from 'react';
import { fetchUsers } from './api';

const UserList = ({ refreshSignal }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await fetchUsers();
      setUsers(response.data);
      setError('');
    } catch (err) {
      setError(`Failed to load users: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [refreshSignal]);

  if (loading) return <p>Loading users...</p>;
  if (error) return <p style={{ color: 'red' }}>{error}</p>;

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
      <h2>Registered Users</h2>
      {users.length === 0 ? (
        <p>No users registered yet.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #ddd' }}>
              <th style={{ padding: '8px' }}>ID</th>
              <th style={{ padding: '8px' }}>Name</th>
              <th style={{ padding: '8px' }}>Email</th>
              <th style={{ padding: '8px' }}>Role</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.user_id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '8px' }}>{user.user_id}</td>
                <td style={{ padding: '8px' }}>{user.full_name}</td>
                <td style={{ padding: '8px' }}>{user.email}</td>
                <td style={{ padding: '8px' }}>{user.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default UserList;