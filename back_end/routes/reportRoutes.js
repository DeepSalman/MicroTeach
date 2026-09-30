const express = require('express');
const router = express.Router();
const db = require('../db');

// Ensure extra columns on startup
(async function ensureReportColumns() {
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

// 5. Moderation Takedown: Unpublish post & resolve report
router.post('/:reportId/takedown', async (req, res) => {
  const { admin_notes, reviewed_by } = req.body;

  try {
    const [reports] = await db.query(
      `SELECT r.*, p.bounty, p.user_id AS post_author_id, p.status AS post_status
       FROM Reports r
       JOIN Posts p ON r.post_id = p.post_id
       WHERE r.report_id = ?`,
      [req.params.reportId]
    );

    if (reports.length === 0) {
      return res.status(404).json({ message: 'Report or post not found.' });
    }

    const report = reports[0];
    const postId = report.post_id;
    const authorId = report.post_author_id;
    const bounty = parseFloat(report.bounty) || 0;

    // Check if any application is completed
    const [apps] = await db.query('SELECT status FROM Post_Applications WHERE post_id = ?', [postId]);
    const hasCompleted = apps.some(a => a.status === 'completed');

    // 1. Close post
    await db.query("UPDATE Posts SET status = 'closed' WHERE post_id = ?", [postId]);

    // 2. Refund held bounty to post author if not already completed/refunded
    let refunded = false;
    if (bounty > 0 && !hasCompleted) {
      const [existingRefund] = await db.query(
        "SELECT transaction_id FROM Transactions WHERE user_id = ? AND reference_id = ? AND type = 'refund'",
        [authorId, postId]
      );
      if (existingRefund.length === 0) {
        const [heldTx] = await db.query(
          "SELECT transaction_id FROM Transactions WHERE user_id = ? AND type = 'bounty_held' AND (reference_id = ? OR (reference_id IS NULL AND amount = ?)) LIMIT 1",
          [authorId, postId, bounty]
        );
        if (heldTx.length > 0) {
          const [userRows] = await db.query('SELECT wallet_balance FROM Users WHERE user_id = ?', [authorId]);
          const currentBalance = parseFloat(userRows[0]?.wallet_balance || 0);
          const newBalance = currentBalance + bounty;
          await db.query('UPDATE Users SET wallet_balance = ? WHERE user_id = ?', [newBalance, authorId]);
          await db.query(
            'INSERT INTO Transactions (user_id, type, amount, balance_after, reference_id, description) VALUES (?, ?, ?, ?, ?, ?)',
            [authorId, 'refund', bounty, newBalance, postId, `Admin Moderation Refund: ৳${bounty} refunded for taken-down post #${postId}`]
          );
          refunded = true;
        }
      }
    }

    // 3. Mark report as reviewed with action_taken = 'post_takedown'
    await db.query(
      `UPDATE Reports
       SET status = 'reviewed',
           action_taken = 'post_takedown',
           admin_notes = ?,
           reviewed_by = ?,
           reviewed_at = NOW()
       WHERE report_id = ?`,
      [admin_notes || 'Post removed by administrator following moderation review.', reviewed_by || null, req.params.reportId]
    );

    res.json({
      message: `Post #${postId} taken down successfully.${refunded ? ' Bounty refunded to author wallet.' : ''}`,
      refunded
    });
  } catch (error) {
    console.error('Error during post takedown:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
