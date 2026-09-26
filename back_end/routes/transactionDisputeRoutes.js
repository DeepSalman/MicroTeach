const express = require('express');
const router = express.Router();
const db = require('../db');

// ── Auto-create Transaction_Disputes table ──
(async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS Transaction_Disputes (
        dispute_id INT AUTO_INCREMENT PRIMARY KEY,
        post_id INT NOT NULL,
        application_id INT NULL,
        reporter_id INT NOT NULL,
        respondent_id INT NULL,
        reporter_role ENUM('student', 'tutor') NOT NULL,
        dispute_type ENUM('full_refund', 'split', 'full_payment') NOT NULL,
        reason VARCHAR(150) NOT NULL,
        split_percentage INT DEFAULT 50,
        proposed_refund_amount DECIMAL(10, 2) DEFAULT 0.00,
        proposed_payout_amount DECIMAL(10, 2) DEFAULT 0.00,
        description TEXT NOT NULL,
        evidence_url VARCHAR(512) NULL,
        status ENUM('pending', 'under_review', 'resolved', 'dismissed') DEFAULT 'pending',
        resolution_type ENUM('full_refund', 'split', 'full_payment', 'dismissed') NULL,
        resolution_notes TEXT NULL,
        resolved_by INT NULL,
        resolved_at DATETIME NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (post_id) REFERENCES Posts(post_id) ON DELETE CASCADE,
        FOREIGN KEY (reporter_id) REFERENCES Users(user_id) ON DELETE CASCADE
      )
    `);
    console.log('[transactionDisputeRoutes] Transaction_Disputes table ensured');
  } catch (err) {
    console.error('[transactionDisputeRoutes] Schema init error:', err.message);
  }
})();

// ── 1. GET all transaction disputes (for Admin portal) ──
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT
        td.dispute_id,
        td.post_id,
        td.application_id,
        td.reporter_id,
        td.respondent_id,
        td.reporter_role,
        td.dispute_type,
        td.reason,
        td.split_percentage,
        td.proposed_refund_amount,
        td.proposed_payout_amount,
        td.description,
        td.evidence_url,
        td.status,
        td.resolution_type,
        td.resolution_notes,
        td.resolved_by,
        td.resolved_at,
        td.created_at,
        p.title AS post_title,
        p.course_code,
        p.category,
        p.bounty,
        p.status AS post_status,
        p.user_id AS poster_id,
        u_rep.full_name AS reporter_name,
        u_rep.email AS reporter_email,
        u_rep.student_id AS reporter_student_id,
        u_rep.department AS reporter_department,
        u_resp.full_name AS respondent_name,
        u_resp.email AS respondent_email,
        u_resp.student_id AS respondent_student_id,
        u_resp.department AS respondent_department
      FROM Transaction_Disputes td
      JOIN Posts p ON td.post_id = p.post_id
      JOIN Users u_rep ON td.reporter_id = u_rep.user_id
      LEFT JOIN Users u_resp ON td.respondent_id = u_resp.user_id
      ORDER BY td.created_at DESC
    `;
    const [rows] = await db.query(query);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── 2. GET check if a user has an active dispute for a post ──
router.get('/check/:postId/:userId', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT * FROM Transaction_Disputes 
       WHERE post_id = ? AND reporter_id = ? AND status IN ('pending', 'under_review')`,
      [req.params.postId, req.params.userId]
    );
    res.json({
      hasDispute: rows.length > 0,
      dispute: rows[0] || null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── 3. POST submit a new transaction dispute ──
router.post('/', async (req, res) => {
  const {
    post_id,
    reporter_id,
    dispute_type,
    reason,
    split_percentage = 50,
    description,
    evidence_url
  } = req.body;

  if (!post_id || !reporter_id || !dispute_type || !reason || !description) {
    return res.status(400).json({
      message: 'post_id, reporter_id, dispute_type, reason, and description are required.'
    });
  }

  if (!['full_refund', 'split', 'full_payment'].includes(dispute_type)) {
    return res.status(400).json({
      message: 'Invalid dispute_type. Must be full_refund, split, or full_payment.'
    });
  }

  try {
    // 1. Fetch post info
    const [posts] = await db.query('SELECT * FROM Posts WHERE post_id = ?', [post_id]);
    if (posts.length === 0) {
      return res.status(404).json({ message: 'Post not found.' });
    }
    const post = posts[0];
    const bounty = parseFloat(post.bounty) || 0;

    // 2. Determine reporter role & respondent
    const isPoster = String(post.user_id) === String(reporter_id);
    let reporter_role = isPoster ? 'student' : 'tutor';
    let respondent_id = null;
    let application_id = null;

    // Find any accepted or active post application
    const [apps] = await db.query(
      `SELECT * FROM Post_Applications 
       WHERE post_id = ? AND status IN ('accepted', 'completion_requested', 'cancellation_requested', 'completed', 'pending')
       ORDER BY (status = 'accepted' OR status = 'completion_requested') DESC, created_at DESC`,
      [post_id]
    );

    if (isPoster) {
      // Reporter is the student/poster -> respondent is the tutor
      if (apps.length > 0) {
        respondent_id = apps[0].user_id;
        application_id = apps[0].application_id;
      }
    } else {
      // Reporter is the tutor -> respondent is the poster
      respondent_id = post.user_id;
      const myApp = apps.find(a => String(a.user_id) === String(reporter_id));
      if (myApp) {
        application_id = myApp.application_id;
      }
    }

    // 3. Check for existing active dispute by this reporter on this post
    const [existing] = await db.query(
      `SELECT dispute_id FROM Transaction_Disputes 
       WHERE post_id = ? AND reporter_id = ? AND status IN ('pending', 'under_review')`,
      [post_id, reporter_id]
    );
    if (existing.length > 0) {
      return res.status(409).json({
        message: 'You already have an active dispute pending review for this transaction.'
      });
    }

    // 4. Calculate proposed amounts based on remedy
    const splitPct = Math.max(10, Math.min(90, parseInt(split_percentage, 10) || 50));
    let proposed_refund_amount = 0;
    let proposed_payout_amount = 0;

    if (dispute_type === 'full_refund') {
      proposed_refund_amount = bounty;
      proposed_payout_amount = 0;
    } else if (dispute_type === 'full_payment') {
      proposed_refund_amount = 0;
      proposed_payout_amount = bounty;
    } else if (dispute_type === 'split') {
      proposed_refund_amount = parseFloat(((bounty * splitPct) / 100).toFixed(2));
      proposed_payout_amount = parseFloat((bounty - proposed_refund_amount).toFixed(2));
    }

    // 5. Insert dispute
    const insertQuery = `
      INSERT INTO Transaction_Disputes (
        post_id, application_id, reporter_id, respondent_id,
        reporter_role, dispute_type, reason, split_percentage,
        proposed_refund_amount, proposed_payout_amount,
        description, evidence_url, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `;

    const [result] = await db.query(insertQuery, [
      post_id,
      application_id,
      reporter_id,
      respondent_id,
      reporter_role,
      dispute_type,
      reason,
      splitPct,
      proposed_refund_amount,
      proposed_payout_amount,
      description.trim(),
      evidence_url ? evidence_url.trim() : null
    ]);

    const caseId = `TX-DISP-${String(result.insertId).padStart(4, '0')}`;

    res.status(201).json({
      message: 'Transaction dispute submitted successfully. Escrow funds are flagged for administrative arbitration.',
      dispute_id: result.insertId,
      case_id: caseId
    });
  } catch (error) {
    console.error('Error submitting dispute:', error);
    res.status(500).json({ error: error.message });
  }
});

// ── 4. POST resolve dispute (Admin execution with atomic wallet transactions) ──
router.post('/:id/resolve', async (req, res) => {
  const { id } = req.params;
  const {
    resolution_type, // 'full_refund', 'split', 'full_payment', 'dismissed'
    resolution_notes,
    admin_id,
    split_percentage = 50
  } = req.body;

  if (!['full_refund', 'split', 'full_payment', 'dismissed'].includes(resolution_type)) {
    return res.status(400).json({
      message: 'Invalid resolution_type. Must be full_refund, split, full_payment, or dismissed.'
    });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Fetch dispute & post details
    const [disputes] = await conn.query(
      `SELECT td.*, p.bounty, p.user_id AS poster_id, p.title AS post_title
       FROM Transaction_Disputes td
       JOIN Posts p ON td.post_id = p.post_id
       WHERE td.dispute_id = ? FOR UPDATE`,
      [id]
    );

    if (disputes.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Dispute record not found.' });
    }

    const dispute = disputes[0];
    if (dispute.status === 'resolved' || dispute.status === 'dismissed') {
      await conn.rollback();
      return res.status(400).json({ message: `Dispute has already been ${dispute.status}.` });
    }

    const bounty = parseFloat(dispute.bounty) || 0;
    const posterId = dispute.poster_id;
    let tutorId = dispute.reporter_role === 'tutor' ? dispute.reporter_id : dispute.respondent_id;

    // If tutorId is still null, look in Post_Applications
    if (!tutorId) {
      const [appRows] = await conn.query(
        `SELECT user_id FROM Post_Applications 
         WHERE post_id = ? AND status IN ('accepted', 'completion_requested', 'completed') LIMIT 1`,
        [dispute.post_id]
      );
      if (appRows.length > 0) tutorId = appRows[0].user_id;
    }

    // 2. Perform monetary settlements if not dismissed
    if (resolution_type === 'full_refund') {
      // 100% of bounty returned to Student (Poster)
      if (bounty > 0) {
        const [posterRows] = await conn.query('SELECT wallet_balance FROM Users WHERE user_id = ? FOR UPDATE', [posterId]);
        const curBal = parseFloat(posterRows[0]?.wallet_balance) || 0;
        const newBal = curBal + bounty;
        await conn.query('UPDATE Users SET wallet_balance = ? WHERE user_id = ?', [newBal, posterId]);

        await conn.query(
          `INSERT INTO Transactions (user_id, type, amount, balance_after, reference_id, description)
           VALUES (?, 'refund', ?, ?, ?, ?)`,
          [posterId, bounty, newBal, dispute.post_id, `Escrow Arbitrated: 100% refund for post #${dispute.post_id} (${dispute.post_title})`]
        );
      }

      // Close post and cancel application
      await conn.query('UPDATE Posts SET status = ? WHERE post_id = ?', ['closed', dispute.post_id]);
      if (dispute.application_id) {
        await conn.query('UPDATE Post_Applications SET status = ? WHERE application_id = ?', ['cancelled', dispute.application_id]);
      }

    } else if (resolution_type === 'full_payment') {
      // 100% of bounty released to Tutor
      if (!tutorId) {
        await conn.rollback();
        return res.status(400).json({ message: 'No tutor found to receive payment for this post.' });
      }

      if (bounty > 0) {
        const [tutorRows] = await conn.query('SELECT wallet_balance FROM Users WHERE user_id = ? FOR UPDATE', [tutorId]);
        const curBal = parseFloat(tutorRows[0]?.wallet_balance) || 0;
        const newBal = curBal + bounty;
        await conn.query('UPDATE Users SET wallet_balance = ? WHERE user_id = ?', [newBal, tutorId]);

        await conn.query(
          `INSERT INTO Transactions (user_id, type, amount, balance_after, reference_id, description)
           VALUES (?, 'bounty_received', ?, ?, ?, ?)`,
          [tutorId, bounty, newBal, dispute.post_id, `Escrow Arbitrated: 100% tutor payout for post #${dispute.post_id} (${dispute.post_title})`]
        );
      }

      // Mark application completed and close post
      await conn.query('UPDATE Posts SET status = ? WHERE post_id = ?', ['closed', dispute.post_id]);
      if (dispute.application_id) {
        await conn.query('UPDATE Post_Applications SET status = ? WHERE application_id = ?', ['completed', dispute.application_id]);
      }

    } else if (resolution_type === 'split') {
      // Compromise split between Student and Tutor
      if (!tutorId) {
        await conn.rollback();
        return res.status(400).json({ message: 'No tutor found to participate in split settlement.' });
      }

      const splitPct = Math.max(5, Math.min(95, parseInt(split_percentage, 10) || 50));
      const studentAmount = parseFloat(((bounty * splitPct) / 100).toFixed(2));
      const tutorAmount = parseFloat((bounty - studentAmount).toFixed(2));

      // Credit student share
      if (studentAmount > 0) {
        const [posterRows] = await conn.query('SELECT wallet_balance FROM Users WHERE user_id = ? FOR UPDATE', [posterId]);
        const curBal = parseFloat(posterRows[0]?.wallet_balance) || 0;
        const newBal = curBal + studentAmount;
        await conn.query('UPDATE Users SET wallet_balance = ? WHERE user_id = ?', [newBal, posterId]);

        await conn.query(
          `INSERT INTO Transactions (user_id, type, amount, balance_after, reference_id, description)
           VALUES (?, 'refund', ?, ?, ?, ?)`,
          [posterId, studentAmount, newBal, dispute.post_id, `Escrow Arbitrated: ${splitPct}% split refund for post #${dispute.post_id}`]
        );
      }

      // Credit tutor share
      if (tutorAmount > 0) {
        const [tutorRows] = await conn.query('SELECT wallet_balance FROM Users WHERE user_id = ? FOR UPDATE', [tutorId]);
        const curBal = parseFloat(tutorRows[0]?.wallet_balance) || 0;
        const newBal = curBal + tutorAmount;
        await conn.query('UPDATE Users SET wallet_balance = ? WHERE user_id = ?', [newBal, tutorId]);

        await conn.query(
          `INSERT INTO Transactions (user_id, type, amount, balance_after, reference_id, description)
           VALUES (?, 'bounty_received', ?, ?, ?, ?)`,
          [tutorId, tutorAmount, newBal, dispute.post_id, `Escrow Arbitrated: ${100 - splitPct}% split payout for post #${dispute.post_id}`]
        );
      }

      // Close post and mark completed
      await conn.query('UPDATE Posts SET status = ? WHERE post_id = ?', ['closed', dispute.post_id]);
      if (dispute.application_id) {
        await conn.query('UPDATE Post_Applications SET status = ? WHERE application_id = ?', ['completed', dispute.application_id]);
      }
    }

    // 3. Update the dispute row
    const newStatus = resolution_type === 'dismissed' ? 'dismissed' : 'resolved';
    await conn.query(
      `UPDATE Transaction_Disputes SET
        status = ?,
        resolution_type = ?,
        resolution_notes = ?,
        resolved_by = ?,
        resolved_at = NOW()
       WHERE dispute_id = ?`,
      [newStatus, resolution_type, resolution_notes || '', admin_id || null, id]
    );

    await conn.commit();
    res.json({
      message: `Dispute settled successfully as [${resolution_type.toUpperCase()}]. Escrow allocated.`,
      dispute_id: id,
      resolution_type
    });
  } catch (error) {
    await conn.rollback();
    console.error('Error resolving dispute:', error);
    res.status(500).json({ error: error.message });
  } finally {
    conn.release();
  }
});

// ── 5. PATCH update status (e.g. under_review) ──
router.patch('/:id/status', async (req, res) => {
  const { status } = req.body;
  if (!['pending', 'under_review', 'resolved', 'dismissed'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status.' });
  }
  try {
    await db.query('UPDATE Transaction_Disputes SET status = ? WHERE dispute_id = ?', [status, req.params.id]);
    res.json({ message: `Dispute status updated to ${status}.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
