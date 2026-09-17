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

  const bountyAmount = Number(bounty);
  if (!Number.isInteger(bountyAmount) || bountyAmount < 50 || bountyAmount > 2000) {
    return res.status(400).json({ message: 'Bounty must be a whole amount between 50 and 2000.' });
  }

  if (deadline && (!Number.isFinite(Date.parse(deadline)) || Date.parse(deadline) <= Date.now())) {
    return res.status(400).json({ message: 'The deadline must be a valid date and time in the future.' });
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
      bountyAmount,
      deadline || null,
      is_urgent || false
    ]);
    res.status(201).json({ message: 'Post created successfully!', postId: result.insertId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a post only when the requesting user owns it.
router.delete('/:postId', async (req, res) => {
  const userId = req.body.user_id;

  if (!userId) {
    return res.status(400).json({ message: 'User ID is required.' });
  }

  try {
    const [result] = await db.query(
      'DELETE FROM Posts WHERE post_id = ? AND user_id = ?',
      [req.params.postId, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Post not found or you do not own this post.' });
    }

    res.json({ message: 'Post deleted successfully.' });
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
