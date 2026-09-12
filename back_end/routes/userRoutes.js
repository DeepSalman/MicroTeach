const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db');

// 1. Get all users
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT
        user_id,
        full_name,
        email,
        role,
        wallet_balance,
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
        (full_name, email, password, role, department)
      VALUES
        (?, ?, ?, ?, ?)
    `;
    const [result] = await db.query(query, [
      full_name,
      email,
      hashedPassword,
      role || 'student',
      department || null
    ]);
    res.status(201).json({ message: 'User registered successfully!', userId: result.insertId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Login user
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

// ALWAYS EXPORT AT THE VERY BOTTOM
module.exports = router;
