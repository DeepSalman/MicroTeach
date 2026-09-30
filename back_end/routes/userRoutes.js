const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { randomAvatarColor } = require('../avatarColors');

// 1. Get all users
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT
        user_id,
        full_name,
        email,
        role,
        is_verified,
        department,
        student_id,
        wallet_balance,
        is_admin,
        avatar_color,
        created_at
      FROM Users
    `;
    const [rows] = await db.query(query);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Register a new user
router.post('/register', async (req, res) => {
  const { full_name, email, password, role, department } = req.body;

  if (!full_name || !email || !password) {
    return res.status(400).json({ message: 'Full name, email, and password are required.' });
  }

  try {
    // Hash the password before storing
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const query = `
      INSERT INTO Users
        (full_name, email, password, role, department, avatar_color)
      VALUES
        (?, ?, ?, ?, ?, ?)
    `;
    const [result] = await db.query(query, [
      full_name,
      email,
      hashedPassword,
      role || 'student',
      department || null,
      randomAvatarColor()
    ]);
    res.status(201).json({ message: 'User registered successfully!', userId: result.insertId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Get user profile with posts
router.get('/profile/:userId', async (req, res) => {
  try {
    const userQuery = `
      SELECT
        user_id,
        full_name,
        email,
        role,
        is_verified,
        wallet_balance,
        department,
        bio,
        phone,
        student_id,
        is_admin,
        avatar_color,
        created_at
      FROM Users
      WHERE user_id = ?
    `;
    const [userRows] = await db.query(userQuery, [req.params.userId]);

    if (userRows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const user = userRows[0];

    const postsQuery = `
      SELECT
        p.post_id,
        p.category,
        p.course_code,
        p.title,
        p.description,
        p.delivery_format,
        p.bounty,
        p.deadline,
        p.is_urgent,
        p.status,
        p.created_at,
        EXISTS(
          SELECT 1 FROM Post_Applications pa 
          WHERE pa.post_id = p.post_id AND pa.status = 'completed'
        ) AS is_completed
      FROM Posts p
      WHERE p.user_id = ? AND p.status != 'closed'
      ORDER BY p.created_at DESC
    `;
    const [posts] = await db.query(postsQuery, [req.params.userId]);

    res.json({ user, posts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Update user profile
router.put('/profile/:userId', async (req, res) => {
  const { full_name, department, bio, phone, student_id } = req.body;

  if (!full_name) {
    return res.status(400).json({ message: 'Full name is required.' });
  }

  try {
    const query = `
      UPDATE Users
      SET full_name = ?, department = ?, bio = ?, phone = ?, student_id = ?
      WHERE user_id = ?
    `;
    await db.query(query, [full_name, department || null, bio || null, phone || null, student_id || null, req.params.userId]);

    const updatedQuery = `
      SELECT user_id, full_name, email, role, is_verified, department, bio, phone, student_id, wallet_balance, is_admin, avatar_color, created_at
      FROM Users WHERE user_id = ?
    `;
    const [rows] = await db.query(updatedQuery, [req.params.userId]);

    res.json({ message: 'Profile updated successfully!', user: rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Login user
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    const query = `
      SELECT
        user_id,
        full_name,
        email,
        role,
        is_verified,
        department,
        bio,
        phone,
        student_id,
        wallet_balance,
        is_admin,
        avatar_color,
        password
      FROM Users
      WHERE email = ?
    `;
    const [rows] = await db.query(query, [email]);

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const user = rows[0];

    // Compare password with hashed password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const { password: _, ...userData } = user;
    res.status(200).json({ message: 'Login successful!', user: userData });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Admin toggle verification
router.patch('/:userId/verify', async (req, res) => {
  const { is_verified } = req.body;
  try {
    await db.query('UPDATE Users SET is_verified = ? WHERE user_id = ?', [is_verified ? 1 : 0, req.params.userId]);
    res.json({ message: `User verification updated to ${is_verified ? 'verified' : 'unverified'}.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 7. Admin update role
router.patch('/:userId/role', async (req, res) => {
  const { role } = req.body;
  const validRoles = ['student', 'tutor', 'both'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ message: 'Invalid role.' });
  }
  try {
    await db.query('UPDATE Users SET role = ? WHERE user_id = ?', [role, req.params.userId]);
    res.json({ message: `User role updated to ${role}.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ALWAYS EXPORT AT THE VERY BOTTOM
module.exports = router;
