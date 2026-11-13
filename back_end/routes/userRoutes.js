const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { randomAvatarColor } = require('../avatarColors');
const { createSession, endSession } = require('../auth');
const { hasApprovedTutorApplication } = require('../tutorEligibility');
const { normalizeUsername, usernameError } = require('../username');

router.get('/username-availability', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const username = normalizeUsername(req.query.username);
  const validationError = usernameError(username);
  if (validationError) return res.status(400).json({ available: false, message: validationError });

  try {
    const lookup = db.isPostgres ? 'LOWER(username)' : 'username';
    const [rows] = await db.query(`SELECT user_id FROM Users WHERE ${lookup} = ? LIMIT 1`, [username]);
    res.json({ available: rows.length === 0 });
  } catch (error) {
    res.status(500).json({ message: 'Could not check username availability.' });
  }
});

router.get('/me', (req, res) => {
  res.json({ user: req.auth });
});

router.post('/logout', async (req, res) => {
  try {
    await endSession(req, res);
    res.json({ message: 'Signed out.' });
  } catch (error) {
    res.status(500).json({ message: 'Could not sign out.' });
  }
});

// 1. Get all users
router.get('/', async (req, res) => {
  if (Number(req.auth?.is_admin) !== 1) return res.status(403).json({ message: 'Access denied.' });
  try {
    const query = `
      SELECT
        user_id,
        full_name,
        username,
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
  const { full_name, email, password, department, username: requestedUsername } = req.body || {};
  const username = normalizeUsername(requestedUsername);

  if (!full_name || !email || !password || !username) {
    return res.status(400).json({ message: 'Full name, username, email, and password are required.' });
  }
  const validationError = usernameError(username);
  if (validationError) return res.status(400).json({ message: validationError });
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters long.' });
  }

  try {
    // Hash the password before storing
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const query = `
      INSERT INTO Users
        (full_name, username, email, password, role, department, avatar_color)
      VALUES
        (?, ?, ?, ?, ?, ?, ?)
    `;
    const [result] = await db.query(query, [
      full_name,
      username,
      email,
      hashedPassword,
      'student',
      department || null,
      randomAvatarColor()
    ]);
    res.status(201).json({ message: 'User registered successfully!', userId: result.insertId });
  } catch (error) {
    if (error.code === '23505' || error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
      const constraint = `${error.constraint || ''} ${error.sqlMessage || ''}`;
      if (constraint.includes('users_username_unique')) {
        return res.status(409).json({ message: 'That username is already taken.' });
      }
      return res.status(409).json({ message: 'Account details are already in use.' });
    }
    res.status(500).json({ message: 'Could not create account.' });
  }
});

// 3. Get user profile with posts
router.get('/profile/:userId', async (req, res) => {
  try {
    const isOwner = req.auth && String(req.auth.user_id) === String(req.params.userId);
    const isAdmin = req.auth && Number(req.auth.is_admin) === 1;
    const privateFields = isOwner || isAdmin;
    const userQuery = privateFields ? `
      SELECT
        user_id,
        full_name,
        username,
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
    ` : `
      SELECT user_id, full_name, username, role, is_verified, department, bio, avatar_color, created_at
      FROM Users WHERE user_id = ?
    `;
    const [userRows] = await db.query(userQuery, [req.params.userId]);

    if (userRows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const visibleUser = userRows[0];

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

    res.json({ user: visibleUser, posts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Update user profile
router.put('/profile/:userId', async (req, res) => {
  if (!req.auth || (Number(req.auth.is_admin) !== 1 &&
      String(req.auth.user_id) !== String(req.params.userId))) {
    return res.status(403).json({ message: 'Access denied.' });
  }
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
      SELECT user_id, full_name, username, email, role, is_verified, department, bio, phone, student_id, wallet_balance, is_admin, avatar_color, created_at
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
  const { email, password, remember_me } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    const query = `
      SELECT
        user_id,
        full_name,
        username,
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
    await createSession(res, user.user_id, remember_me === true);
    res.status(200).json({ message: 'Login successful!', user: userData });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Admin toggle verification
router.patch('/:userId/verify', async (req, res) => {
  if (Number(req.auth?.is_admin) !== 1) return res.status(403).json({ message: 'Access denied.' });
  const { is_verified } = req.body;
  if (![true, false, 0, 1].includes(is_verified)) {
    return res.status(400).json({ message: 'is_verified must be a boolean.' });
  }
  const enableVerification = is_verified === true || is_verified === 1;
  try {
    if (enableVerification) {
      const [users] = await db.query('SELECT role FROM Users WHERE user_id = ?', [req.params.userId]);
      if (!users.length) return res.status(404).json({ message: 'User not found.' });
      if (['tutor', 'both'].includes(users[0].role) &&
          !(await hasApprovedTutorApplication(db, req.params.userId))) {
        return res.status(409).json({ message: 'Tutor approval is required before verification.' });
      }
    }
    await db.query('UPDATE Users SET is_verified = ? WHERE user_id = ?', [enableVerification ? 1 : 0, req.params.userId]);
    res.json({ message: `User verification updated to ${enableVerification ? 'verified' : 'unverified'}.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 7. Admin update role
router.patch('/:userId/role', async (req, res) => {
  if (Number(req.auth?.is_admin) !== 1) return res.status(403).json({ message: 'Access denied.' });
  const { role } = req.body;
  const validRoles = ['student', 'tutor', 'both'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ message: 'Invalid role.' });
  }
  try {
    if (['tutor', 'both'].includes(role) &&
        !(await hasApprovedTutorApplication(db, req.params.userId))) {
      return res.status(409).json({ message: 'Tutor approval is required before granting this role.' });
    }
    await db.query('UPDATE Users SET role = ? WHERE user_id = ?', [role, req.params.userId]);
    res.json({ message: `User role updated to ${role}.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ALWAYS EXPORT AT THE VERY BOTTOM
module.exports = router;
