const express = require('express');
const router = express.Router();
const db = require('../db');
const { EscrowError, toCents, inTransaction, lockPost, settleEscrow } = require('../escrow');

// Ensure extra columns on startup
(async function ensureReportColumns() {
  if (db.isPostgres) return;
  try {
    const [cols] = await db.query('SHOW COLUMNS FROM Reports');
    const colNames = cols.map(c => c.Field);
    if (!colNames.includes('admin_notes')) {
      await db.query('ALTER TABLE Reports ADD COLUMN admin_notes TEXT NULL');
    }
    if (!colNames.includes('action_taken')) {
      await db.query('ALTER TABLE Reports ADD COLUMN action_taken VARCHAR(50) NULL');
    }
    if (!colNames.includes('reviewed_at')) {
      await db.query('ALTER TABLE Reports ADD COLUMN reviewed_at TIMESTAMP NULL');
    }
    if (!colNames.includes('reviewed_by')) {
      await db.query('ALTER TABLE Reports ADD COLUMN reviewed_by INT NULL');
    }
    console.log('[reportRoutes] Report columns verified');
  } catch (err) {
    console.warn('[reportRoutes] Column check warning:', err.message);
  }
})();

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
        r.admin_notes,
        r.action_taken,
        r.reviewed_at,
        r.reviewed_by,
        p.title AS post_title,
        p.description AS post_description,
        p.course_code,
        p.category,
        p.bounty,
        p.delivery_format,
        p.deadline,
        p.is_urgent,
        p.status AS post_status,
        p.user_id AS post_author_id,
        u.full_name AS reporter_name,
        u.email AS reporter_email,
        u.department AS reporter_department,
        u.student_id AS reporter_student_id,
        author.full_name AS post_author_name,
        author.email AS post_author_email,
        author.department AS post_author_department,
        author.student_id AS post_author_student_id
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

// 3. Batch status update (bulk review or dismiss)
router.patch('/batch-status', async (req, res) => {
  const { report_ids, status, admin_notes, reviewed_by } = req.body;
  const validStatuses = ['pending', 'reviewed', 'dismissed'];

  if (!Array.isArray(report_ids) || report_ids.length === 0) {
    return res.status(400).json({ message: 'report_ids array is required.' });
  }
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ message: 'Invalid status. Must be pending, reviewed, or dismissed.' });
  }

  try {
    const isPending = status === 'pending';
    const query = `
      UPDATE Reports
      SET status = ?,
          admin_notes = COALESCE(?, admin_notes),
          action_taken = ?,
          reviewed_by = ?,
          reviewed_at = ${isPending ? 'NULL' : 'NOW()'}
      WHERE report_id IN (?)
    `;
    await db.query(query, [status, admin_notes || null, status === 'dismissed' ? 'dismiss' : 'review', reviewed_by || null, report_ids]);
    res.json({ message: `Updated ${report_ids.length} reports to ${status}.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Update individual report status (review/dismiss/notes)
router.patch('/:reportId/status', async (req, res) => {
  const { status, admin_notes, action_taken, reviewed_by } = req.body;
  const validStatuses = ['pending', 'reviewed', 'dismissed'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ message: 'Invalid status. Must be pending, reviewed, or dismissed.' });
  }

  try {
    const isPending = status === 'pending';
    const query = `
      UPDATE Reports
      SET status = ?,
          admin_notes = COALESCE(?, admin_notes),
          action_taken = COALESCE(?, action_taken),
          reviewed_by = COALESCE(?, reviewed_by),
          reviewed_at = ${isPending ? 'NULL' : 'NOW()'}
      WHERE report_id = ?
    `;
    await db.query(query, [status, admin_notes || null, action_taken || (status === 'dismissed' ? 'dismissed' : 'reviewed'), reviewed_by || null, req.params.reportId]);
    res.json({ message: 'Report status updated.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Moderation takedown shares the escrow lock with completion and refunds.
router.post('/:reportId/takedown', async (req, res) => {
  try {
    const [references] = await db.query('SELECT post_id FROM Reports WHERE report_id = ?', [req.params.reportId]);
    if (!references.length) return res.status(404).json({ message: 'Report not found.' });
    const result = await inTransaction(async (conn) => {
      const post = await lockPost(conn, references[0].post_id);
      const [reports] = await conn.query('SELECT report_id FROM Reports WHERE report_id = ? FOR UPDATE', [req.params.reportId]);
      if (!reports.length) throw new EscrowError(404, 'Report not found.');
      const [apps] = await conn.query('SELECT status FROM Post_Applications WHERE post_id = ?', [post.post_id]);
      let refunded = false;
      if (toCents(post.bounty) > 0 && !apps.some((app) => app.status === 'completed')) {
        const settlement = await settleEscrow(conn, post, [{
          userId: post.user_id, type: 'refund', cents: toCents(post.bounty),
          description: `Admin moderation refund for post #${post.post_id}`
        }]);
        refunded = settlement.released;
      }
      await conn.query("UPDATE Posts SET status = 'closed' WHERE post_id = ?", [post.post_id]);
      await conn.query(
        `UPDATE Reports SET status = 'reviewed', action_taken = 'post_takedown',
           admin_notes = ?, reviewed_by = ?, reviewed_at = NOW() WHERE report_id = ?`,
        [req.body.admin_notes || 'Post removed by administrator following moderation review.',
          req.auth.user_id, req.params.reportId]
      );
      return { postId: post.post_id, refunded };
    });
    res.json({
      message: `Post #${result.postId} taken down successfully.${result.refunded ? ' Bounty refunded to author wallet.' : ''}`,
      refunded: result.refunded
    });
  } catch (error) {
    res.status(error instanceof EscrowError ? error.status : 500).json({ message: error.message });
  }
});

module.exports = router;
