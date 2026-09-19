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
        s.scheduled_time,
        s.duration_minutes,
        u1.full_name AS student_name,
        u1.user_id AS student_id,
        u2.full_name AS tutor_name,
        u2.user_id AS tutor_id,
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
  const { student_id, tutor_id, skill_id, scheduled_time, duration_minutes } = req.body;

  if (!student_id || !tutor_id || !skill_id || !scheduled_time) {
    return res.status(400).json({ message: 'Missing required session parameters.' });
  }

  try {
    const query = `
      INSERT INTO Sessions
        (student_id, tutor_id, skill_id, scheduled_time, duration_minutes)
      VALUES
        (?, ?, ?, ?, ?)
    `;
    const [result] = await db.query(query, [
      student_id,
      tutor_id,
      skill_id,
      scheduled_time,
      duration_minutes || 60
    ]);
    res.status(201).json({ message: 'Session created successfully!', sessionId: result.insertId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
