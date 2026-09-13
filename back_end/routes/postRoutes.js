const express = require('express');
const router = express.Router();
const db = require('../db');

// 1. Get all posts with user info
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT
        p.post_id,
        p.user_id,
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
        u.full_name AS author_name,
        u.department AS author_department
      FROM Posts p
      JOIN Users u ON p.user_id = u.user_id
      ORDER BY p.created_at DESC
    `;
    const [rows] = await db.query(query);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Get posts by user
router.get('/user/:userId', async (req, res) => {
  try {
    const query = `
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
        p.created_at
      FROM Posts p
      WHERE p.user_id = ?
      ORDER BY p.created_at DESC
    `;
    const [rows] = await db.query(query, [req.params.userId]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Create a new post
router.post('/', async (req, res) => {
  const { user_id, category, course_code, title, description, delivery_format, bounty, deadline, is_urgent } = req.body;

  if (!user_id || !category || !course_code || !title) {
    return res.status(400).json({ message: 'User ID, category, course code, and title are required.' });
  }

  try {
    const query = `
      INSERT INTO Posts
        (user_id, category, course_code, title, description, delivery_format, bounty, deadline, is_urgent)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const [result] = await db.query(query, [
      user_id,
      category,
      course_code,
      title,
      description || '',
      delivery_format || 'live_call',
      bounty || 0,
      deadline || null,
      is_urgent || false
    ]);
    res.status(201).json({ message: 'Post created successfully!', postId: result.insertId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Update post status
router.patch('/:postId/status', async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['active', 'pending', 'resolved', 'closed'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ message: 'Invalid status.' });
  }

  try {
    const query = `
      UPDATE Posts
      SET status = ?
      WHERE post_id = ?
    `;
    await db.query(query, [status, req.params.postId]);
    res.json({ message: 'Post status updated!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
