const express = require('express');
const router = express.Router();
const db = require('../db');

// 1. Get all sessions with student, tutor, and skill details
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT
        s.session_id,
        s.status,
        s.rate,
        s.scheduled_at,
        s.meeting_link,
        u1.full_name AS student_name,
        u2.full_name AS tutor_name,
        sk.skill_name
      FROM Sessions s
      JOIN Users u1 ON s.student_id = u1.user_id
      JOIN Users u2 ON s.tutor_id = u2.user_id
      JOIN Skills sk ON s.skill_id = sk.skill_id
    `;
    const [rows] = await db.query(query);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Create a new session booking
router.post('/', async (req, res) => {
  const { student_id, tutor_id, skill_id, rate, scheduled_at, meeting_link } = req.body;

  if (!student_id || !tutor_id || !skill_id || !rate || !scheduled_at) {
    return res.status(400).json({ message: 'Missing required session parameters.' });
  }

  try {
    const query = `
      INSERT INTO Sessions
        (student_id, tutor_id, skill_id, rate, scheduled_at, meeting_link)
      VALUES
        (?, ?, ?, ?, ?, ?)
    `;
    const [result] = await db.query(query, [
      student_id,
      tutor_id,
      skill_id,
      rate,
      scheduled_at,
      meeting_link || null
    ]);
    res.status(201).json({ message: 'Session created successfully!', sessionId: result.insertId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
