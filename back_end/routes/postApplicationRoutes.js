const express = require('express');
const router = express.Router();
const db = require('../db');

// 1. Get all applications for a post (with applicant info + avg rating)
router.get('/post/:postId', async (req, res) => {
  try {
    const query = `
      SELECT
        pa.application_id,
        pa.post_id,
        pa.user_id,
        pa.message,
        pa.status,
        pa.completion_requested_by,
        pa.created_at,
        u.full_name AS applicant_name,
        u.department AS applicant_department,
        u.email AS applicant_email,
        u.role AS applicant_role,
        COALESCE(r.avg_rating, 0) AS avg_rating,
        COALESCE(r.review_count, 0) AS review_count
      FROM Post_Applications pa
      JOIN Users u ON pa.user_id = u.user_id
      LEFT JOIN (
        SELECT reviewee_id, ROUND(AVG(rating), 1) AS avg_rating, COUNT(*) AS review_count
        FROM Reviews
        GROUP BY reviewee_id
      ) r ON r.reviewee_id = pa.user_id
      WHERE pa.post_id = ?
      ORDER BY pa.created_at DESC
    `;
    const [rows] = await db.query(query, [req.params.postId]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Get all applications by a user (with post info)
router.get('/user/:userId', async (req, res) => {
  try {
    const query = `
      SELECT
        pa.application_id,
        pa.post_id,
        pa.user_id,
        pa.message,
        pa.status,
        pa.completion_requested_by,
        pa.created_at,
        p.title AS post_title,
        p.course_code,
        p.category,
        p.bounty,
        p.deadline,
        p.status AS post_status,
        p.user_id AS post_author_id,
        u.full_name AS post_author
      FROM Post_Applications pa
      JOIN Posts p ON pa.post_id = p.post_id
      JOIN Users u ON p.user_id = u.user_id
      WHERE pa.user_id = ?
      ORDER BY pa.created_at DESC
    `;
    const [rows] = await db.query(query, [req.params.userId]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Apply to a post
router.post('/', async (req, res) => {
  const { post_id, user_id, message } = req.body;

  if (!post_id || !user_id) {
    return res.status(400).json({ message: 'Post ID and User ID are required.' });
  }

  try {
    // Check if already applied
    const [existing] = await db.query(
      'SELECT application_id FROM Post_Applications WHERE post_id = ? AND user_id = ?',
      [post_id, user_id]
    );
    if (existing.length > 0) {
      return res.status(409).json({ message: 'You have already applied to this post.' });
    }

    // Check if user is trying to apply to their own post
    const [post] = await db.query('SELECT user_id FROM Posts WHERE post_id = ?', [post_id]);
    if (post.length > 0 && String(post[0].user_id) === String(user_id)) {
      return res.status(400).json({ message: 'You cannot apply to your own post.' });
    }

    const query = `
      INSERT INTO Post_Applications (post_id, user_id, message)
      VALUES (?, ?, ?)
    `;
    const [result] = await db.query(query, [post_id, user_id, message || '']);
    res.status(201).json({ message: 'Application submitted successfully!', applicationId: result.insertId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Withdraw application
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM Post_Applications WHERE application_id = ?', [req.params.id]);
    res.json({ message: 'Application withdrawn.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Update application status (post owner only)
router.patch('/:id/status', async (req, res) => {
  const { status, owner_id, requested_by } = req.body;
  const validStatuses = ['pending', 'accepted', 'rejected', 'cancellation_requested', 'cancelled', 'completion_requested', 'completed'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ message: 'Invalid status.' });
  }

  try {
    // Verify owner
    const [app] = await db.query(
      `SELECT pa.post_id, p.user_id FROM Post_Applications pa
       JOIN Posts p ON pa.post_id = p.post_id
       WHERE pa.application_id = ?`,
      [req.params.id]
    );
    if (app.length === 0) {
      return res.status(404).json({ message: 'Application not found.' });
    }
    if (owner_id && String(app[0].user_id) !== String(owner_id)) {
      return res.status(403).json({ message: 'Only the post owner can update application status.' });
    }

    if (status === 'completion_requested') {
      await db.query('UPDATE Post_Applications SET status = ?, completion_requested_by = ? WHERE application_id = ?', [status, requested_by || null, req.params.id]);
    } else if (status === 'completed' || status === 'accepted') {
      await db.query('UPDATE Post_Applications SET status = ?, completion_requested_by = NULL WHERE application_id = ?', [status, req.params.id]);
    } else {
      await db.query('UPDATE Post_Applications SET status = ?, completion_requested_by = NULL WHERE application_id = ?', [status, req.params.id]);
    }
    res.json({ message: 'Application status updated!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Get application count for a post
router.get('/post/:postId/count', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT COUNT(*) as count FROM Post_Applications WHERE post_id = ?',
      [req.params.postId]
    );
    res.json({ count: rows[0].count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
