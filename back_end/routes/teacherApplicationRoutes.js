const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all teacher applications
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        ta.application_id,
        ta.user_id,
        ta.reason,
        ta.expertise,
        ta.status,
        ta.created_at,
        ta.reviewed_at,
        u.full_name,
        u.email,
        u.student_id,
        u.department,
        u.role
      FROM Teacher_Applications ta
      JOIN Users u ON ta.user_id = u.user_id
      ORDER BY ta.created_at DESC
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get applications for a specific user
router.get('/user/:userId', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT * FROM Teacher_Applications 
      WHERE user_id = ? 
      ORDER BY created_at DESC
    `, [req.params.userId]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Submit a new teacher application
router.post('/', async (req, res) => {
  const { user_id, reason, expertise } = req.body;

  if (!user_id || !reason) {
    return res.status(400).json({ message: 'User ID and reason are required.' });
  }

  try {
    // Check if user is already a tutor or has pending application
    const [user] = await db.query('SELECT role FROM Users WHERE user_id = ?', [user_id]);
    if (user.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (user[0].role === 'tutor' || user[0].role === 'both') {
      return res.status(400).json({ message: 'User is already a tutor.' });
    }

    const [existing] = await db.query(
      'SELECT * FROM Teacher_Applications WHERE user_id = ? AND status = ?',
      [user_id, 'pending']
    );
    if (existing.length > 0) {
      return res.status(400).json({ message: 'You already have a pending application.' });
    }

    const [result] = await db.query(
      'INSERT INTO Teacher_Applications (user_id, reason, expertise) VALUES (?, ?, ?)',
      [user_id, reason, expertise || '']
    );

    res.status(201).json({ 
      message: 'Application submitted successfully.',
      application_id: result.insertId 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Review an application (approve/reject)
router.put('/:id/review', async (req, res) => {
  const { status, reviewed_by } = req.body;

  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ message: 'Status must be approved or rejected.' });
  }

  try {
    const [application] = await db.query(
      'SELECT * FROM Teacher_Applications WHERE application_id = ?',
      [req.params.id]
    );

    if (application.length === 0) {
      return res.status(404).json({ message: 'Application not found.' });
    }

    // Update application status
    await db.query(
      'UPDATE Teacher_Applications SET status = ?, reviewed_by = ?, reviewed_at = NOW() WHERE application_id = ?',
      [status, reviewed_by, req.params.id]
    );

    // If approved, update user role to 'both'
    if (status === 'approved') {
      await db.query(
        "UPDATE Users SET role = 'both' WHERE user_id = ?",
        [application[0].user_id]
      );
    }

    res.json({ message: `Application ${status} successfully.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
