const express = require('express');
const router = express.Router();
const db = require('../db');
const { EscrowError, toCents, money, inTransaction, lockPost, settleEscrow } = require('../escrow');

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
        u.department AS author_department,
        u.avatar_color AS author_avatar_color
      FROM Posts p
      JOIN Users u ON p.user_id = u.user_id
      WHERE p.status != 'closed'
      AND NOT EXISTS (
        SELECT 1 FROM Post_Applications pa
        WHERE pa.post_id = p.post_id AND pa.status = 'completed'
      )
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
        p.created_at,
        EXISTS(
          SELECT 1 FROM Post_Applications pa
          WHERE pa.post_id = p.post_id AND pa.status = 'completed'
        ) AS is_completed
      FROM Posts p
      WHERE p.user_id = ? AND p.status != 'closed'
      ORDER BY p.created_at DESC
    `;
    const [rows] = await db.query(query, [req.params.userId]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Create a post and reserve its bounty in one transaction.
router.post('/', async (req, res) => {
  const { user_id, category, course_code, title, description, delivery_format, bounty, deadline, is_urgent } = req.body;
  if (!user_id || !category || !title) {
    return res.status(400).json({ message: 'User ID, category, and title are required.' });
  }
  if (deadline && typeof deadline === 'string' && deadline.trim()) {
    const deadlineTimestamp = Date.parse(deadline.trim());
    if (isNaN(deadlineTimestamp)) return res.status(400).json({ message: 'Invalid deadline format.' });
    if (deadlineTimestamp < Date.now() - 60000) {
      return res.status(400).json({ message: 'The deadline cannot be in the past.' });
    }
  }

  try {
    const bountyCents = toCents(bounty ?? 0);
    const postId = await inTransaction(async (conn) => {
      let newBalance;
      if (bountyCents > 0) {
        const [users] = await conn.query('SELECT wallet_balance FROM Users WHERE user_id = ? FOR UPDATE', [user_id]);
        if (!users.length) throw new EscrowError(404, 'User not found.');
        const balanceCents = toCents(users[0].wallet_balance);
        if (balanceCents < bountyCents) {
          throw new EscrowError(400, `Insufficient balance. Your balance is ৳${money(balanceCents)}, but the bounty is ৳${money(bountyCents)}.`);
        }
        newBalance = money(balanceCents - bountyCents);
      }

      const isUrgentVal = (is_urgent === true || is_urgent === 1 || is_urgent === '1' || is_urgent === 'true') ? 1 : 0;
      const [result] = await conn.query(
        `INSERT INTO Posts (user_id, category, course_code, title, description, delivery_format, bounty, deadline, is_urgent)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [user_id, category, course_code || '', title, description || '', delivery_format || 'live_call',
          money(bountyCents), deadline || null, isUrgentVal]
      );
      if (bountyCents > 0) {
        await conn.query('UPDATE Users SET wallet_balance = ? WHERE user_id = ?', [newBalance, user_id]);
        await conn.query(
          'INSERT INTO Transactions (user_id, type, amount, balance_after, reference_id, description) VALUES (?, ?, ?, ?, ?, ?)',
          [user_id, 'bounty_held', money(bountyCents), newBalance, result.insertId, `Held ৳${money(bountyCents)} bounty for post: ${title}`]
        );
      }
      return result.insertId;
    });
    res.status(201).json({ message: 'Post created successfully!', postId });
  } catch (error) {
    res.status(error instanceof EscrowError ? error.status : 500).json({ message: error.message });
  }
});

// 5. Close a post and refund any unsettled bounty atomically.
router.post('/:postId/close', async (req, res) => {
  try {
    const refunded = await inTransaction(async (conn) => {
      const post = await lockPost(conn, req.params.postId);
      if (String(post.user_id) !== String(req.auth.user_id)) {
        throw new EscrowError(403, 'Only the post owner can close this post.');
      }
      if (post.status === 'closed') throw new EscrowError(409, 'Post is already closed.');
      const [apps] = await conn.query('SELECT status FROM Post_Applications WHERE post_id = ?', [post.post_id]);
      if (apps.some((app) => ['accepted', 'completion_requested', 'cancellation_requested'].includes(app.status))) {
        throw new EscrowError(409, 'An active tutoring session must be completed or cancelled first.');
      }
      let released = false;
      if (!apps.some((app) => app.status === 'completed') && toCents(post.bounty) > 0) {
        const settlement = await settleEscrow(conn, post, [{
          userId: post.user_id, type: 'refund', cents: toCents(post.bounty),
          description: `Refunded bounty for closed post #${post.post_id}`
        }]);
        released = settlement.released;
      }
      await conn.query("UPDATE Posts SET status = 'closed' WHERE post_id = ?", [post.post_id]);
      return released;
    });
    res.json({ message: `Post closed.${refunded ? ' Bounty refunded to your wallet.' : ''}` });
  } catch (error) {
    res.status(error instanceof EscrowError ? error.status : 500).json({ message: error.message });
  }
});

// 6. Remove a post and refund its unsettled bounty atomically.
router.delete('/:postId', async (req, res) => {
  try {
    await inTransaction(async (conn) => {
      const post = await lockPost(conn, req.params.postId);
      const [apps] = await conn.query('SELECT status FROM Post_Applications WHERE post_id = ?', [post.post_id]);
      if (toCents(post.bounty) > 0 && !apps.some((app) => app.status === 'completed') && post.status !== 'closed') {
        await settleEscrow(conn, post, [{
          userId: post.user_id, type: 'refund', cents: toCents(post.bounty),
          description: `Refunded bounty for removed post #${post.post_id}`
        }]);
      }
      await conn.query('DELETE FROM Posts WHERE post_id = ?', [post.post_id]);
    });
    res.json({ message: 'Post removed successfully.' });
  } catch (error) {
    res.status(error instanceof EscrowError ? error.status : 500).json({ message: error.message });
  }
});

module.exports = router;

