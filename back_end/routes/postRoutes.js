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
        p.created_at
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

// 3. Create a new post (deducts bounty from wallet)
router.post('/', async (req, res) => {
  const { user_id, category, course_code, title, description, delivery_format, bounty, deadline, is_urgent } = req.body;

  if (!user_id || !category || !course_code || !title) {
    return res.status(400).json({ message: 'User ID, category, course code, and title are required.' });
  }

  const bountyAmount = parseFloat(bounty) || 0;

  try {
    // Check wallet balance before creating post
    if (bountyAmount > 0) {
      const [userRows] = await db.query('SELECT wallet_balance FROM Users WHERE user_id = ?', [user_id]);
      if (userRows.length === 0) {
        return res.status(404).json({ message: 'User not found.' });
      }
      const currentBalance = parseFloat(userRows[0].wallet_balance) || 0;
      if (currentBalance < bountyAmount) {
        return res.status(400).json({ message: `Insufficient balance. Your balance is ৳${currentBalance.toFixed(2)}, but the bounty is ৳${bountyAmount.toFixed(2)}. Please top up your wallet.` });
      }
    }

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

    // Record bounty_held transaction AFTER post is created (need post_id as reference)
    if (bountyAmount > 0) {
      const [userRows] = await db.query('SELECT wallet_balance FROM Users WHERE user_id = ?', [user_id]);
      const currentBalance = parseFloat(userRows[0].wallet_balance) || 0;
      const newBalance = currentBalance - bountyAmount;
      await db.query('UPDATE Users SET wallet_balance = ? WHERE user_id = ?', [newBalance, user_id]);
      await db.query(
        'INSERT INTO Transactions (user_id, type, amount, balance_after, reference_id, description) VALUES (?, ?, ?, ?, ?, ?)',
        [user_id, 'bounty_held', bountyAmount, newBalance, result.insertId, `Held ৳${bountyAmount} bounty for post: ${title}`]
      );
    }

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

// 5. Close post (with validation + bounty refund)
router.post('/:postId/close', async (req, res) => {
  const { user_id } = req.body;

  try {
    // Verify post exists and belongs to user
    const [posts] = await db.query('SELECT * FROM Posts WHERE post_id = ?', [req.params.postId]);
    if (posts.length === 0) {
      return res.status(404).json({ message: 'Post not found.' });
    }
    if (String(posts[0].user_id) !== String(user_id)) {
      return res.status(403).json({ message: 'Only the post owner can close this post.' });
    }
    if (posts[0].status === 'closed') {
      return res.status(400).json({ message: 'Post is already closed.' });
    }

    // Check if any application is accepted or completion_requested (active sessions block closing)
    const [apps] = await db.query(
      'SELECT status FROM Post_Applications WHERE post_id = ?',
      [req.params.postId]
    );
    const hasActive = apps.some(a => a.status === 'accepted' || a.status === 'completion_requested');
    if (hasActive) {
      return res.status(400).json({ message: 'Cannot close post. There is an active tutoring session. Please wait for it to finish or cancel it first.' });
    }

    const hasCompleted = apps.some(a => a.status === 'completed');

    // Close the post
    await db.query('UPDATE Posts SET status = ? WHERE post_id = ?', ['closed', req.params.postId]);

    // Refund bounty only if no session was completed (bounty still held in escrow)
    let refundMessage = '';
    const bounty = parseFloat(posts[0].bounty) || 0;
    if (bounty > 0 && !hasCompleted) {
      const [existingRefund] = await db.query(
        "SELECT transaction_id FROM Transactions WHERE user_id = ? AND reference_id = ? AND type = 'refund'",
        [user_id, req.params.postId]
      );
      if (existingRefund.length === 0) {
        const [heldTx] = await db.query(
          "SELECT transaction_id FROM Transactions WHERE user_id = ? AND type = 'bounty_held' AND (reference_id = ? OR (reference_id IS NULL AND amount = ?)) LIMIT 1",
          [user_id, req.params.postId, bounty]
        );
        if (heldTx.length > 0) {
          const [userRows] = await db.query('SELECT wallet_balance FROM Users WHERE user_id = ?', [user_id]);
          const currentBalance = parseFloat(userRows[0].wallet_balance) || 0;
          const newBalance = currentBalance + bounty;
          await db.query('UPDATE Users SET wallet_balance = ? WHERE user_id = ?', [newBalance, user_id]);
          await db.query(
            'INSERT INTO Transactions (user_id, type, amount, balance_after, reference_id, description) VALUES (?, ?, ?, ?, ?, ?)',
            [user_id, 'refund', bounty, newBalance, req.params.postId, `Refunded ৳${bounty} bounty for closed post #${req.params.postId}`]
          );
          refundMessage = ' Bounty refunded to your wallet.';
        }
      }
    }

    res.json({ message: `Post closed.${refundMessage}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
