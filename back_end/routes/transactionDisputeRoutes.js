const express = require('express');
const router = express.Router();
const db = require('../db');
const { EscrowError, toCents, inTransaction, lockPost, settleEscrow } = require('../escrow');

// ── Auto-create Transaction_Disputes table ──
(async () => {
  if (db.isPostgres) return;
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

    // PREVENT MONEY GLITCH: Cannot dispute a completed gig once escrow has been released
    const [completedApps] = await db.query(
      "SELECT application_id FROM Post_Applications WHERE post_id = ? AND status = 'completed'",
      [post_id]
    );
    if (completedApps.length > 0 || post.status === 'closed' || post.status === 'resolved') {
      return res.status(400).json({
        message: 'Cannot dispute a completed gig. The escrow payment has already been released to the tutor.'
      });
    }

    // Verify no payout or refund has already occurred for this post
    const [payouts] = await db.query(
      "SELECT transaction_id FROM Transactions WHERE reference_id = ? AND type IN ('bounty_received', 'refund')",
      [post_id]
    );
    if (payouts.length > 0) {
      return res.status(400).json({
        message: 'Cannot dispute this gig. Escrow funds have already been settled and disbursed.'
      });
    }

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

// ── 4. Resolve a dispute through the shared, single-use escrow settlement. ──
router.post('/:id/resolve', async (req, res) => {
  const { resolution_type, resolution_notes, split_percentage = 50 } = req.body;
  if (!['full_refund', 'split', 'full_payment', 'dismissed'].includes(resolution_type)) {
    return res.status(400).json({ message: 'Invalid resolution type.' });
  }
  try {
    const [references] = await db.query(
      'SELECT post_id FROM Transaction_Disputes WHERE dispute_id = ?', [req.params.id]
    );
    if (!references.length) return res.status(404).json({ message: 'Dispute not found.' });
    await inTransaction(async (conn) => {
      const post = await lockPost(conn, references[0].post_id);
      const [disputes] = await conn.query(
        'SELECT * FROM Transaction_Disputes WHERE dispute_id = ? FOR UPDATE', [req.params.id]
      );
      if (!disputes.length) throw new EscrowError(404, 'Dispute not found.');
      const dispute = disputes[0];
      if (['resolved', 'dismissed'].includes(dispute.status)) {
        throw new EscrowError(409, 'Dispute has already been resolved.');
      }

      if (resolution_type !== 'dismissed') {
        const bountyCents = toCents(post.bounty);
        let tutorId = dispute.reporter_role === 'tutor' ? dispute.reporter_id : dispute.respondent_id;
        if (!tutorId && resolution_type !== 'full_refund') {
          const [apps] = await conn.query(
            "SELECT user_id FROM Post_Applications WHERE post_id = ? AND status IN ('accepted', 'completion_requested', 'completed') LIMIT 1",
            [post.post_id]
          );
          tutorId = apps[0]?.user_id;
        }
        if (resolution_type !== 'full_refund' && !tutorId) {
          throw new EscrowError(400, 'No tutor is available to receive this settlement.');
        }
        if (resolution_type !== 'full_refund') {
          const [tutors] = await conn.query(
            'SELECT application_id FROM Post_Applications WHERE post_id = ? AND user_id = ? LIMIT 1',
            [post.post_id, tutorId]
          );
          if (!tutors.length || String(tutorId) === String(post.user_id)) {
            throw new EscrowError(409, 'Settlement recipient must be a tutor who applied to this post.');
          }
        }

        let allocations;
        if (resolution_type === 'full_refund') {
          allocations = [{ userId: post.user_id, type: 'refund', cents: bountyCents,
            description: `Escrow refund for disputed post #${post.post_id}` }];
        } else if (resolution_type === 'full_payment') {
          allocations = [{ userId: tutorId, type: 'bounty_received', cents: bountyCents,
            description: `Escrow payout for disputed post #${post.post_id}` }];
        } else {
          const percentage = Math.max(5, Math.min(95, parseInt(split_percentage, 10) || 50));
          const refundCents = Math.round(bountyCents * percentage / 100);
          allocations = [
            { userId: post.user_id, type: 'refund', cents: refundCents,
              description: `Escrow split refund for post #${post.post_id}` },
            { userId: tutorId, type: 'bounty_received', cents: bountyCents - refundCents,
              description: `Escrow split payout for post #${post.post_id}` }
          ];
        }
        const settlement = await settleEscrow(conn, post, allocations);
        if (settlement.alreadySettled) throw new EscrowError(409, 'Escrow has already been settled.');
        await conn.query("UPDATE Posts SET status = 'closed' WHERE post_id = ?", [post.post_id]);
        if (dispute.application_id) {
          await conn.query('UPDATE Post_Applications SET status = ? WHERE application_id = ?',
            [resolution_type === 'full_refund' ? 'cancelled' : 'completed', dispute.application_id]);
        }
      }
      await conn.query(
        `UPDATE Transaction_Disputes SET status = ?, resolution_type = ?, resolution_notes = ?,
           resolved_by = ?, resolved_at = NOW() WHERE dispute_id = ?`,
        [resolution_type === 'dismissed' ? 'dismissed' : 'resolved', resolution_type,
          resolution_notes || '', req.auth.user_id, dispute.dispute_id]
      );
    });
    res.json({ message: `Dispute settled as ${resolution_type}.`, dispute_id: req.params.id, resolution_type });
  } catch (error) {
    res.status(error instanceof EscrowError ? error.status : 500).json({ message: error.message });
  }
});

// ── 5. PATCH update status (e.g. under_review) ──
router.patch('/:id/status', async (req, res) => {
  const { status } = req.body;
  if (!['pending', 'under_review'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status.' });
  }
  try {
    await db.query(
      "UPDATE Transaction_Disputes SET status = ? WHERE dispute_id = ? AND status IN ('pending', 'under_review')",
      [status, req.params.id]
    );
    res.json({ message: `Dispute status updated to ${status}.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
