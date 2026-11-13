const express = require('express');
const router = express.Router();
const db = require('../db');
const { EscrowError, toCents, inTransaction, lockPost, settleEscrow } = require('../escrow');
const { statusChangeAllowed } = require('../applicationStatus');
const { isEligibleTutor } = require('../tutorEligibility');

// 1. Get all applications for a post (with applicant info + avg rating)
router.get('/post/:postId', async (req, res) => {
  try {
    const [posts] = await db.query('SELECT user_id FROM Posts WHERE post_id = ?', [req.params.postId]);
    if (posts.length === 0) return res.status(404).json({ message: 'Post not found.' });
    const canReviewAll = Number(req.auth.is_admin) === 1 ||
      String(posts[0].user_id) === String(req.auth.user_id);
    const query = `
      SELECT
        pa.application_id,
        pa.post_id,
        pa.user_id,
        pa.message,
        pa.status,
        pa.completion_requested_by,
        pa.created_at,
        p.user_id AS post_owner_id,
        u.full_name AS applicant_name,
        u.department AS applicant_department,
        u.role AS applicant_role,
        u.avatar_color AS applicant_avatar_color,
        COALESCE(r.avg_rating, 0) AS avg_rating,
        COALESCE(r.review_count, 0) AS review_count
      FROM Post_Applications pa
      JOIN Posts p ON pa.post_id = p.post_id
      JOIN Users u ON pa.user_id = u.user_id
      LEFT JOIN (
        SELECT reviewee_id, ROUND(AVG(rating), 1) AS avg_rating, COUNT(*) AS review_count
        FROM Reviews
        GROUP BY reviewee_id
      ) r ON r.reviewee_id = pa.user_id
      WHERE pa.post_id = ?${canReviewAll ? '' : ' AND pa.user_id = ?'}
      ORDER BY pa.created_at DESC
    `;
    const params = canReviewAll ? [req.params.postId] : [req.params.postId, req.auth.user_id];
    const [rows] = await db.query(query, params);
    res.json(rows.map(({ post_owner_id, ...application }) => application));
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
        u.full_name AS post_author,
        u.avatar_color AS post_author_avatar_color,
        EXISTS(
          SELECT 1 FROM Post_Applications pa2
          WHERE pa2.post_id = p.post_id AND pa2.status = 'completed'
        ) AS is_completed
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

// 3. Apply only while the post is open for tutors.
router.post('/', async (req, res) => {
  const { post_id, message } = req.body;
  const user_id = req.auth?.user_id;
  if (!post_id || !user_id) return res.status(400).json({ message: 'Post ID and User ID are required.' });
  try {
    const applicationId = await inTransaction(async (conn) => {
      const post = await lockPost(conn, post_id);
      if (['closed', 'completed', 'resolved'].includes(post.status)) {
        throw new EscrowError(409, 'This post is no longer accepting applications.');
      }
      if (String(post.user_id) === String(user_id)) {
        throw new EscrowError(400, 'You cannot apply to your own post.');
      }
      if (!(await isEligibleTutor(conn, user_id, true))) {
        throw new EscrowError(403, 'An approved and verified tutor account is required.');
      }
      const [existing] = await conn.query(
        'SELECT application_id FROM Post_Applications WHERE post_id = ? AND user_id = ?', [post_id, user_id]
      );
      if (existing.length) throw new EscrowError(409, 'You have already applied to this post.');
      const [result] = await conn.query(
        'INSERT INTO Post_Applications (post_id, user_id, message) VALUES (?, ?, ?)',
        [post_id, user_id, message || '']
      );
      return result.insertId;
    });
    res.status(201).json({ message: 'Application submitted successfully!', applicationId });
  } catch (error) {
    res.status(error instanceof EscrowError ? error.status : 500).json({ message: error.message });
  }
});

// 4. Withdraw application
router.delete('/:id', async (req, res) => {
  try {
    await inTransaction(async (conn) => {
      const [references] = await conn.query('SELECT post_id FROM Post_Applications WHERE application_id = ?', [req.params.id]);
      if (!references.length) throw new EscrowError(404, 'Application not found.');
      await lockPost(conn, references[0].post_id);
      const [apps] = await conn.query(
        'SELECT user_id, status FROM Post_Applications WHERE application_id = ? FOR UPDATE', [req.params.id]
      );
      if (!apps.length) throw new EscrowError(404, 'Application not found.');
      if (String(apps[0].user_id) !== String(req.auth.user_id) ||
          !['pending', 'rejected'].includes(apps[0].status)) {
        throw new EscrowError(409, 'This application can no longer be withdrawn.');
      }
      await conn.query('DELETE FROM Post_Applications WHERE application_id = ?', [req.params.id]);
    });
    res.json({ message: 'Application withdrawn.' });
  } catch (error) {
    res.status(error instanceof EscrowError ? error.status : 500).json({ message: error.message });
  }
});

// 5. Change status under the same post lock used for every escrow settlement.
router.patch('/:id/status', async (req, res) => {
  const nextStatus = req.body.status;
  try {
    await inTransaction(async (conn) => {
      const [references] = await conn.query(
        'SELECT post_id FROM Post_Applications WHERE application_id = ?', [req.params.id]
      );
      if (!references.length) throw new EscrowError(404, 'Application not found.');
      const post = await lockPost(conn, references[0].post_id);
      const [rows] = await conn.query(
        'SELECT application_id, user_id AS applicant_id, status, completion_requested_by FROM Post_Applications WHERE application_id = ? FOR UPDATE',
        [req.params.id]
      );
      if (!rows.length) throw new EscrowError(404, 'Application not found.');
      const app = { ...rows[0], owner_id: post.user_id };
      if (['closed', 'completed', 'resolved'].includes(post.status)) {
        throw new EscrowError(409, 'This post is already closed or settled.');
      }
      if (!statusChangeAllowed(app, req.auth.user_id, nextStatus)) {
        throw new EscrowError(409, 'Application status changed or this transition is not allowed.');
      }

      if (nextStatus === 'accepted' && app.status === 'pending') {
        if (!(await isEligibleTutor(conn, app.applicant_id, true))) {
          throw new EscrowError(403, 'This tutor is no longer approved and verified.');
        }
        const [active] = await conn.query(
          "SELECT application_id FROM Post_Applications WHERE post_id = ? AND application_id <> ? AND status IN ('accepted', 'completion_requested', 'cancellation_requested', 'completed') LIMIT 1 FOR UPDATE",
          [post.post_id, app.application_id]
        );
        if (active.length) throw new EscrowError(409, 'Another tutor is already active for this post.');
      }

      if (nextStatus === 'completed') {
        const settlement = await settleEscrow(conn, post, [{
          userId: app.applicant_id, type: 'bounty_received', cents: toCents(post.bounty),
          description: `Received bounty for post #${post.post_id}`
        }]);
        if (settlement.alreadySettled) throw new EscrowError(409, 'Escrow has already been settled.');
        await conn.query(
          "UPDATE Post_Applications SET status = 'completed', completion_requested_by = NULL WHERE application_id = ?",
          [app.application_id]
        );
        await conn.query("UPDATE Posts SET status = 'completed' WHERE post_id = ?", [post.post_id]);
      } else if (nextStatus === 'cancelled') {
        const settlement = await settleEscrow(conn, post, [{
          userId: post.user_id, type: 'refund', cents: toCents(post.bounty),
          description: `Refunded bounty for cancelled post #${post.post_id}`
        }]);
        if (settlement.alreadySettled) throw new EscrowError(409, 'Escrow has already been settled.');
        await conn.query(
          "UPDATE Post_Applications SET status = 'cancelled', completion_requested_by = NULL WHERE application_id = ?",
          [app.application_id]
        );
        await conn.query("UPDATE Posts SET status = 'closed' WHERE post_id = ?", [post.post_id]);
      } else {
        await conn.query(
          'UPDATE Post_Applications SET status = ?, completion_requested_by = ? WHERE application_id = ?',
          [nextStatus, nextStatus === 'completion_requested' ? req.auth.user_id : null, app.application_id]
        );
      }
    });
    res.json({ message: 'Application status updated!' });
  } catch (error) {
    res.status(error instanceof EscrowError ? error.status : 500).json({ message: error.message });
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
