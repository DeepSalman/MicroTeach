const express = require('express');
const router = express.Router();
const db = require('../db');

// 1. Get wallet balance
router.get('/balance/:userId', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT wallet_balance FROM Users WHERE user_id = ?', [req.params.userId]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }
    res.json({ balance: rows[0].wallet_balance });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Top up wallet
router.post('/topup', async (req, res) => {
  const { user_id, amount } = req.body;

  if (!user_id || !amount || amount <= 0) {
    return res.status(400).json({ message: 'user_id and a positive amount are required.' });
  }

  try {
    // Get current balance
    const [rows] = await db.query('SELECT wallet_balance FROM Users WHERE user_id = ?', [user_id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const currentBalance = parseFloat(rows[0].wallet_balance) || 0;
    const newBalance = currentBalance + parseFloat(amount);

    // Update balance
    await db.query('UPDATE Users SET wallet_balance = ? WHERE user_id = ?', [newBalance, user_id]);

    // Record transaction
    await db.query(
      'INSERT INTO Transactions (user_id, type, amount, balance_after, description) VALUES (?, ?, ?, ?, ?)',
      [user_id, 'top_up', amount, newBalance, `Topped up ৳${amount}`]
    );

    res.json({ balance: newBalance, message: `৳${amount} added to wallet.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Get transaction history
router.get('/transactions/:userId', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM Transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      [req.params.userId]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Process bounty payment (called when a post is marked completed)
router.post('/pay-bounty', async (req, res) => {
  const { post_id, poster_id, tutor_id } = req.body;

  if (!post_id || !poster_id || !tutor_id) {
    return res.status(400).json({ message: 'post_id, poster_id, and tutor_id are required.' });
  }

  try {
    // Get bounty amount from post
    const [posts] = await db.query('SELECT bounty FROM Posts WHERE post_id = ?', [post_id]);
    if (posts.length === 0) {
      return res.status(404).json({ message: 'Post not found.' });
    }

    const bounty = parseFloat(posts[0].bounty);

    // Get poster balance
    const [posterRows] = await db.query('SELECT wallet_balance FROM Users WHERE user_id = ?', [poster_id]);
    const posterBalance = parseFloat(posterRows[0].wallet_balance) || 0;

    if (posterBalance < bounty) {
      return res.status(400).json({ message: 'Insufficient balance in poster wallet.' });
    }

    // Get tutor balance
    const [tutorRows] = await db.query('SELECT wallet_balance FROM Users WHERE user_id = ?', [tutor_id]);
    const tutorBalance = parseFloat(tutorRows[0].wallet_balance) || 0;

    // Deduct from poster
    const newPosterBalance = posterBalance - bounty;
    await db.query('UPDATE Users SET wallet_balance = ? WHERE user_id = ?', [newPosterBalance, poster_id]);

    // Add to tutor
    const newTutorBalance = tutorBalance + bounty;
    await db.query('UPDATE Users SET wallet_balance = ? WHERE user_id = ?', [newTutorBalance, tutor_id]);

    // Record transactions
    await db.query(
      'INSERT INTO Transactions (user_id, type, amount, balance_after, reference_id, description) VALUES (?, ?, ?, ?, ?, ?)',
      [poster_id, 'bounty_payment', bounty, newPosterBalance, post_id, `Paid ৳${bounty} bounty for post #${post_id}`]
    );

    await db.query(
      'INSERT INTO Transactions (user_id, type, amount, balance_after, reference_id, description) VALUES (?, ?, ?, ?, ?, ?)',
      [tutor_id, 'bounty_received', bounty, newTutorBalance, post_id, `Received ৳${bounty} bounty for post #${post_id}`]
    );

    res.json({ message: `৳${bounty} transferred from poster to tutor.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
