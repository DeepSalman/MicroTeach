const express = require('express');
const router = express.Router();
const db = require('../db');

// 1. Get all posts with user info
router.get('/', async (req, res) => {
  try {
    const viewerId = Number(req.query.user_id) || 0;
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
        u.department AS author_department,
        COUNT(DISTINCT a.application_id) AS application_count,
        MAX(CASE WHEN a.applicant_id = ? THEN 1 ELSE 0 END) AS has_applied
      FROM Posts p
      JOIN Users u ON p.user_id = u.user_id
      LEFT JOIN Applications a ON p.post_id = a.post_id
      GROUP BY p.post_id
      ORDER BY p.created_at DESC
    `;
    const [rows] = await db.query(query, [viewerId]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get one post with its comments and the current user's application state.
router.get('/:postId', async (req, res) => {
  try {
    const viewerId = Number(req.query.user_id) || 0;
    const [posts] = await db.query(`
      SELECT p.*, u.full_name AS author_name, u.department AS author_department,
        COUNT(DISTINCT a.application_id) AS application_count,
        MAX(CASE WHEN a.applicant_id = ? THEN 1 ELSE 0 END) AS has_applied
      FROM Posts p
      JOIN Users u ON p.user_id = u.user_id
      LEFT JOIN Applications a ON p.post_id = a.post_id
      WHERE p.post_id = ?
      GROUP BY p.post_id
    `, [viewerId, req.params.postId]);

    if (posts.length === 0) return res.status(404).json({ message: 'Post not found.' });

    const [comments] = await db.query(`
      SELECT c.comment_id, c.parent_comment_id, c.comment_text, c.created_at, c.user_id, u.full_name AS author_name
      FROM Post_Comments c JOIN Users u ON c.user_id = u.user_id
      WHERE c.post_id = ? ORDER BY c.created_at ASC
    `, [req.params.postId]);

    const [applicants] = await db.query(`
      SELECT a.application_id, a.applicant_id, a.status, a.created_at,
        u.full_name, u.email, u.department, u.bio, u.expertise, u.student_id
      FROM Applications a
      JOIN Users u ON a.applicant_id = u.user_id
      WHERE a.post_id = ?
      ORDER BY a.created_at ASC
    `, [req.params.postId]);

    res.json({ ...posts[0], comments, applicants });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:postId/applications', async (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ message: 'User ID is required.' });

  try {
    await db.query(
      'INSERT INTO Applications (post_id, applicant_id) VALUES (?, ?)',
      [req.params.postId, user_id]
    );
    const [[{ application_count }]] = await db.query(
      'SELECT COUNT(*) AS application_count FROM Applications WHERE post_id = ?',
      [req.params.postId]
    );
    res.status(201).json({ application_count });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'You have already applied to this post.' });
    }
    res.status(500).json({ error: error.message });
  }
});

router.post('/:postId/comments', async (req, res) => {
  const { user_id, comment_text, parent_comment_id } = req.body;
  if (!user_id || !comment_text?.trim()) {
    return res.status(400).json({ message: 'User ID and comment are required.' });
  }

  try {
    const [result] = await db.query(
      'INSERT INTO Post_Comments (post_id, user_id, parent_comment_id, comment_text) VALUES (?, ?, ?, ?)',
      [req.params.postId, user_id, parent_comment_id || null, comment_text.trim()]
    );
    const [[comment]] = await db.query(`
      SELECT c.comment_id, c.parent_comment_id, c.comment_text, c.created_at, c.user_id, u.full_name AS author_name
      FROM Post_Comments c JOIN Users u ON c.user_id = u.user_id
      WHERE c.comment_id = ?
    `, [result.insertId]);
    res.status(201).json(comment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Accept an applicant for a post owned by the requesting student.
router.patch('/:postId/applications/:applicationId/accept', async (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ message: 'User ID is required.' });

  try {
    const [result] = await db.query(`
      UPDATE Applications a
      JOIN Posts p ON p.post_id = a.post_id
      SET a.status = 'accepted'
      WHERE a.application_id = ? AND a.post_id = ? AND p.user_id = ?
    `, [req.params.applicationId, req.params.postId, user_id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Application not found or you do not own this post.' });
    }

    await db.query(
      "UPDATE Applications SET status = 'rejected' WHERE post_id = ? AND application_id <> ? AND status = 'pending'",
      [req.params.postId, req.params.applicationId]
    );
    await db.query("UPDATE Posts SET status = 'pending' WHERE post_id = ? AND user_id = ?", [req.params.postId, user_id]);

    const [[application]] = await db.query(`
      SELECT a.application_id, a.applicant_id, a.status, a.created_at,
        u.full_name, u.email, u.department, u.bio, u.expertise, u.student_id
      FROM Applications a JOIN Users u ON a.applicant_id = u.user_id
      WHERE a.application_id = ?
    `, [req.params.applicationId]);
    res.json({ application });
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
