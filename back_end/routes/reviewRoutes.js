const express = require('express');
const router = express.Router();
const db = require('../db');

// 1. Submit a review
router.post('/', async (req, res) => {
  const { reviewer_id, reviewee_id, post_id, rating, comment } = req.body;

  if (!reviewer_id || !reviewee_id || !post_id || !rating) {
    return res.status(400).json({ message: 'reviewer_id, reviewee_id, post_id, and rating are required.' });
  }

  if (rating < 0.5 || rating > 5) {
    return res.status(400).json({ message: 'Rating must be between 0.5 and 5.' });
  }

  try {
    // Verify the post is completed
    const [app] = await db.query(
      `SELECT pa.status, pa.application_id FROM Post_Applications pa
       WHERE pa.post_id = ? AND pa.user_id = ? AND pa.status = 'completed'`,
      [post_id, reviewee_id]
    );
    // Also allow if reviewer is the tutor (reviewing poster)
    const [appAsTutor] = await db.query(
      `SELECT pa.status FROM Post_Applications pa
       WHERE pa.post_id = ? AND pa.user_id = ? AND pa.status = 'completed'`,
      [post_id, reviewer_id]
    );
    if (app.length === 0 && appAsTutor.length === 0) {
      return res.status(400).json({ message: 'This session is not completed yet.' });
    }

    // Check duplicate
    const [existing] = await db.query(
      'SELECT review_id FROM Reviews WHERE reviewer_id = ? AND post_id = ?',
      [reviewer_id, post_id]
    );
    if (existing.length > 0) {
      return res.status(409).json({ message: 'You have already reviewed this session.' });
    }

    const [result] = await db.query(
      'INSERT INTO Reviews (reviewer_id, reviewee_id, post_id, rating, comment) VALUES (?, ?, ?, ?, ?)',
      [reviewer_id, reviewee_id, post_id, rating, comment || '']
    );

    res.status(201).json({ message: 'Review submitted!', reviewId: result.insertId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Get reviews for a user (profile page)
router.get('/user/:userId', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT r.*, u.full_name AS reviewer_name
       FROM Reviews r
       JOIN Users u ON r.reviewer_id = u.user_id
       WHERE r.reviewee_id = ?
       ORDER BY r.created_at DESC`,
      [req.params.userId]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Check if review exists for a post by a reviewer
router.get('/check/:postId/:reviewerId', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT review_id FROM Reviews WHERE post_id = ? AND reviewer_id = ?',
      [req.params.postId, req.params.reviewerId]
    );
    res.json({ exists: rows.length > 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Get average rating for a user
router.get('/rating/:userId', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT ROUND(AVG(rating), 1) AS avg_rating, COUNT(*) AS review_count FROM Reviews WHERE reviewee_id = ?',
      [req.params.userId]
    );
    res.json(rows[0] || { avg_rating: 0, review_count: 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
