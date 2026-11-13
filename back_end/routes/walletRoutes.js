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

// 2. Get transaction history
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

module.exports = router;
