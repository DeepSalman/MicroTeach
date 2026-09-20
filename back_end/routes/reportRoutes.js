const express = require('express');
const router = express.Router();
const db = require('../db');

// 1. Submit a report (from student panel)
router.post('/', async (req, res) => {
  const { post_id, user_id, reason, description } = req.body;

  if (!post_id || !user_id || !reason) {
    return res.status(400).json({ message: 'post_id, user_id, and reason are required.' });
  }

  try {
    await db.query(
      `INSERT INTO Reports (post_id, user_id, reason, description) VALUES (?, ?, ?, ?)`,
      [post_id, user_id, reason, description || null]
    );
    res.status(201).json({ message: 'Report submitted successfully.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Get all reports (admin report queue)
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT
        r.report_id,
        r.post_id,
        r.user_id AS reporter_id,
        r.reason,
        r.description,
        r.status,
        r.created_at,
        p.title AS post_title,
        p.course_code,
        p.category,
        p.bounty,
        p.status AS post_status,
        u.full_name AS reporter_name,
        u.department AS reporter_department,
        u.student_id AS reporter_student_id,
        author.full_name AS post_author_name,
        author.department AS post_author_department
      FROM Reports r
      JOIN Posts p ON r.post_id = p.post_id
      JOIN Users u ON r.user_id = u.user_id
      JOIN Users author ON p.user_id = author.user_id
      ORDER BY r.created_at DESC
    `;
    const [rows] = await db.query(query);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Update report status (review/dismiss)
router.patch('/:reportId/status', async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['pending', 'reviewed', 'dismissed'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ message: 'Invalid status. Must be pending, reviewed, or dismissed.' });
  }

  try {
    await db.query(`UPDATE Reports SET status = ? WHERE report_id = ?`, [status, req.params.reportId]);
    res.json({ message: 'Report status updated.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
