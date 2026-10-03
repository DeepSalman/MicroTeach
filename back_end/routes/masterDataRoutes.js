const express = require('express');
const router = express.Router();
const db = require('../db');

// Ensure Master_Transaction_Types table exists and has default entries
(async function ensureMasterDataTables() {
  if (db.isPostgres) return;
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS Master_Transaction_Types (
        type_code VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        direction ENUM('credit', 'debit', 'escrow_hold', 'neutral') NOT NULL,
        category VARCHAR(50) NOT NULL,
        accounting_treatment VARCHAR(100) NOT NULL,
        is_disputable BOOLEAN DEFAULT FALSE,
        is_reversible BOOLEAN DEFAULT FALSE,
        trigger_method VARCHAR(50) NOT NULL,
        min_amount DECIMAL(10,2) DEFAULT 0.00,
        max_amount DECIMAL(10,2) DEFAULT 50000.00,
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    const defaultTypes = [
      ['top_up', 'Wallet Deposit / Top-up', 'credit', 'Inflow / Funding', 'Student Wallet Asset', false, false, 'Automated (Payment Gateway)', 50.00, 25000.00, 'Funds loaded into student wallet via mobile financial service (bKash/Nagad) or card.', true],
      ['bounty_held', 'Escrow Bounty Reservation', 'escrow_hold', 'Escrow Lifecycle', 'Escrow Liability Reserve', false, true, 'Automated (Post Creation)', 50.00, 10000.00, 'Locked in platform escrow when a student creates a help request with a bounty.', true],
      ['bounty_received', 'Peer Tutor Bounty Payout', 'credit', 'Marketplace Settlement', 'Tutor Earned Revenue', true, true, 'Automated (Session Completion)', 50.00, 10000.00, 'Released from escrow to peer tutor upon mutual lesson completion or dispute settlement.', true],
      ['bounty_payment', 'Direct Bounty Settlement', 'debit', 'Marketplace Settlement', 'Student Expense Settlement', true, true, 'Automated (Session Completion)', 50.00, 10000.00, 'Direct debit record from poster to tutor wallet when settling peer teaching session.', true],
      ['refund', 'Escrow Bounty Refund', 'credit', 'Dispute & Cancellation', 'Liability Reversal to Student', false, false, 'Automated (Post Close / Dispute)', 0.00, 10000.00, 'Returned to student wallet when a post is closed without completed session or arbitrated.', true],
      ['withdrawal', 'Tutor Cashout / Withdrawal', 'debit', 'Outflow / Payout', 'Tutor Asset Withdrawal', false, false, 'Manual / Scheduled Batch', 100.00, 25000.00, 'Peer tutor cashout request from platform wallet to personal bank or mobile wallet.', true],
      ['admin_adjustment', 'Administrative Ledger Correction', 'neutral', 'Governance & Audit', 'Manual General Ledger Adjustment', false, true, 'Manual (Super Admin Only)', 0.00, 50000.00, 'Audited discretionary credit or debit by Super Admin for ledger reconciliation or disputes.', true],
      ['platform_fee', 'Platform Commission Fee', 'debit', 'Institutional Revenue', 'Platform Fee Revenue', false, false, 'Automated (Settlement Engine)', 0.00, 5000.00, 'Micro-commission retained for platform maintenance and escrow operational processing.', false]
    ];

    for (const t of defaultTypes) {
      const sql = db.isPostgres ? `
        INSERT INTO Master_Transaction_Types
        (type_code, name, direction, category, accounting_treatment, is_disputable, is_reversible, trigger_method, min_amount, max_amount, description, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (type_code) DO UPDATE SET
        name = EXCLUDED.name,
        direction = EXCLUDED.direction,
        category = EXCLUDED.category,
        accounting_treatment = EXCLUDED.accounting_treatment
      ` : `
        INSERT INTO Master_Transaction_Types
        (type_code, name, direction, category, accounting_treatment, is_disputable, is_reversible, trigger_method, min_amount, max_amount, description, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        direction = VALUES(direction),
        category = VALUES(category),
        accounting_treatment = VALUES(accounting_treatment)
      `;
      await db.query(sql, t);
    }

    console.log('[masterDataRoutes] Master_Transaction_Types verified & synchronized');
  } catch (err) {
    console.warn('[masterDataRoutes] Initialization warning:', err.message);
  }
})();

// 1. Get all transaction types with live usage statistics
router.get('/transaction-types', async (req, res) => {
  try {
    const query = `
      SELECT
        m.type_code,
        m.name,
        m.direction,
        m.category,
        m.accounting_treatment,
        m.is_disputable,
        m.is_reversible,
        m.trigger_method,
        m.min_amount,
        m.max_amount,
        m.description,
        m.is_active,
        m.created_at,
        m.updated_at,
        COALESCE(stats.tx_count, 0) AS tx_count,
        COALESCE(stats.total_volume, 0) AS total_volume,
        COALESCE(stats.avg_amount, 0) AS avg_amount,
        stats.last_occurred_at
      FROM Master_Transaction_Types m
      LEFT JOIN (
        SELECT
          type,
          COUNT(*) AS tx_count,
          SUM(amount) AS total_volume,
          AVG(amount) AS avg_amount,
          MAX(created_at) AS last_occurred_at
        FROM Transactions
        GROUP BY type
      ) stats ON m.type_code = stats.type
      ORDER BY m.is_active DESC, stats.tx_count DESC, m.name ASC
    `;
    const [rows] = await db.query(query);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching master transaction types:', error);
    res.status(500).json({ error: error.message });
  }
});

// 2. Create or update a transaction type
router.post('/transaction-types', async (req, res) => {
  const {
    type_code,
    name,
    direction,
    category,
    accounting_treatment,
    is_disputable,
    is_reversible,
    trigger_method,
    min_amount,
    max_amount,
    description,
    is_active
  } = req.body;

  if (!type_code || !name || !direction) {
    return res.status(400).json({ message: 'type_code, name, and direction are required.' });
  }

  try {
    const query = db.isPostgres ? `
      INSERT INTO Master_Transaction_Types
      (type_code, name, direction, category, accounting_treatment, is_disputable, is_reversible, trigger_method, min_amount, max_amount, description, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (type_code) DO UPDATE SET
      name = EXCLUDED.name,
      direction = EXCLUDED.direction,
      category = EXCLUDED.category,
      accounting_treatment = EXCLUDED.accounting_treatment,
      is_disputable = EXCLUDED.is_disputable,
      is_reversible = EXCLUDED.is_reversible,
      trigger_method = EXCLUDED.trigger_method,
      min_amount = EXCLUDED.min_amount,
      max_amount = EXCLUDED.max_amount,
      description = EXCLUDED.description,
      is_active = EXCLUDED.is_active
    ` : `
      INSERT INTO Master_Transaction_Types
      (type_code, name, direction, category, accounting_treatment, is_disputable, is_reversible, trigger_method, min_amount, max_amount, description, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
      name = VALUES(name),
      direction = VALUES(direction),
      category = VALUES(category),
      accounting_treatment = VALUES(accounting_treatment),
      is_disputable = VALUES(is_disputable),
      is_reversible = VALUES(is_reversible),
      trigger_method = VALUES(trigger_method),
      min_amount = VALUES(min_amount),
      max_amount = VALUES(max_amount),
      description = VALUES(description),
      is_active = VALUES(is_active)
    `;

    await db.query(query, [
      type_code.toLowerCase().trim().replace(/\s+/g, '_'),
      name,
      direction,
      category || 'General',
      accounting_treatment || 'Platform Reserve',
      Boolean(is_disputable),
      Boolean(is_reversible),
      trigger_method || 'Manual',
      parseFloat(min_amount) || 0,
      parseFloat(max_amount) || 50000,
      description || null,
      is_active !== undefined ? Boolean(is_active) : true
    ]);

    res.json({ message: `Transaction type '${type_code}' registered successfully.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Toggle transaction type active status
router.patch('/transaction-types/:typeCode/toggle', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT is_active FROM Master_Transaction_Types WHERE type_code = ?', [req.params.typeCode]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Transaction type not found.' });
    }

    const newStatus = !rows[0].is_active;
    await db.query('UPDATE Master_Transaction_Types SET is_active = ? WHERE type_code = ?', [newStatus, req.params.typeCode]);

    res.json({ message: `Transaction type '${req.params.typeCode}' is now ${newStatus ? 'active' : 'inactive'}.`, is_active: newStatus });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Global Ledger Query Engine (Every transaction across all users)
router.get('/transactions', async (req, res) => {
  const {
    type,
    direction,
    search,
    startDate,
    endDate,
    sortBy = 'newest',
    page = 1,
    limit = 50
  } = req.query;

  const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const conditions = [];
  const params = [];

  if (type && type !== 'all') {
    conditions.push('t.type = ?');
    params.push(type);
  }

  if (direction && direction !== 'all') {
    conditions.push('m.direction = ?');
    params.push(direction);
  }

  if (startDate) {
    conditions.push('DATE(t.created_at) >= ?');
    params.push(startDate);
  }

  if (endDate) {
    conditions.push('DATE(t.created_at) <= ?');
    params.push(endDate);
  }

  if (search && search.trim()) {
    const s = `%${search.trim()}%`;
    conditions.push('(u.full_name LIKE ? OR u.email LIKE ? OR u.student_id LIKE ? OR t.description LIKE ? OR t.transaction_id = ? OR t.reference_id = ?)');
    const num = isNaN(search.trim()) ? 0 : parseInt(search.trim(), 10);
    params.push(s, s, s, s, num, num);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  let orderClause = 'ORDER BY t.created_at DESC';
  if (sortBy === 'oldest') orderClause = 'ORDER BY t.created_at ASC';
  if (sortBy === 'amount_desc') orderClause = 'ORDER BY t.amount DESC';
  if (sortBy === 'amount_asc') orderClause = 'ORDER BY t.amount ASC';

  try {
    // 1. Fetch Paginated Records
    const dataQuery = `
      SELECT
        t.transaction_id,
        t.user_id,
        t.type,
        t.amount,
        t.balance_after,
        t.reference_id,
        t.description,
        t.created_at,
        u.full_name,
        u.email,
        u.role,
        u.student_id,
        u.department,
        u.wallet_balance AS current_user_balance,
        COALESCE(m.name, t.type) AS type_name,
        COALESCE(m.direction, 'neutral') AS direction,
        COALESCE(m.category, 'General') AS category
      FROM Transactions t
      JOIN Users u ON t.user_id = u.user_id
      LEFT JOIN Master_Transaction_Types m ON t.type = m.type_code
      ${whereClause}
      ${orderClause}
      LIMIT ? OFFSET ?
    `;

    const countQuery = `
      SELECT
        COUNT(*) AS total_count,
        COALESCE(SUM(t.amount), 0) AS total_volume
      FROM Transactions t
      JOIN Users u ON t.user_id = u.user_id
      LEFT JOIN Master_Transaction_Types m ON t.type = m.type_code
      ${whereClause}
    `;

    const [rows] = await db.query(dataQuery, [...params, parseInt(limit, 10), parseInt(offset, 10)]);
    const [countRows] = await db.query(countQuery, params);

    // Global telemetry across entire database
    const [telemetryRows] = await db.query(`
      SELECT
        COUNT(*) AS total_transactions,
        COALESCE(SUM(amount), 0) AS total_volume,
        COALESCE(SUM(CASE WHEN type = 'top_up' THEN amount ELSE 0 END), 0) AS total_inflow,
        COALESCE(SUM(CASE WHEN type = 'bounty_received' THEN amount ELSE 0 END), 0) AS total_tutor_payouts,
        COALESCE(SUM(CASE WHEN type = 'bounty_held' THEN amount ELSE 0 END), 0) AS total_bounty_held,
        COALESCE(SUM(CASE WHEN type = 'refund' THEN amount ELSE 0 END), 0) AS total_refunds
      FROM Transactions
    `);

    res.json({
      transactions: rows,
      pagination: {
        total: countRows[0]?.total_count || 0,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil((countRows[0]?.total_count || 0) / parseInt(limit, 10)) || 1
      },
      filteredVolume: countRows[0]?.total_volume || 0,
      telemetry: telemetryRows[0] || {}
    });
  } catch (error) {
    console.error('Error querying transactions:', error);
    res.status(500).json({ error: error.message });
  }
});

// 5. Ledger Integrity & Reconciliation Checker
router.get('/reconciliation', async (req, res) => {
  try {
    // Total wallet balances in platform
    const [walletSum] = await db.query('SELECT SUM(wallet_balance) AS total_balances, COUNT(*) AS user_count FROM Users');

    // Aggregate flows from ledger
    const [flowStats] = await db.query(`
      SELECT
        COUNT(*) AS total_tx,
        COALESCE(SUM(CASE WHEN type = 'top_up' THEN amount ELSE 0 END), 0) AS total_deposits,
        COALESCE(SUM(CASE WHEN type = 'bounty_received' THEN amount ELSE 0 END), 0) AS total_payouts,
        COALESCE(SUM(CASE WHEN type = 'bounty_held' THEN amount ELSE 0 END), 0) AS total_held,
        COALESCE(SUM(CASE WHEN type = 'refund' THEN amount ELSE 0 END), 0) AS total_refunds
      FROM Transactions
    `);

    // Audit each user
    const [userAudits] = await db.query(`
      SELECT
        u.user_id,
        u.full_name,
        u.email,
        u.student_id,
        u.role,
        u.wallet_balance AS recorded_balance,
        COALESCE(tx.net_tx_flow, 0) AS calculated_flow,
        COALESCE(tx.tx_count, 0) AS tx_count
      FROM Users u
      LEFT JOIN (
        SELECT
          user_id,
          COUNT(*) AS tx_count,
          SUM(
            CASE
              WHEN type IN ('top_up', 'bounty_received', 'refund') THEN amount
              WHEN type IN ('bounty_held', 'bounty_payment', 'withdrawal') THEN -amount
              ELSE 0
            END
          ) AS net_tx_flow
        FROM Transactions
        GROUP BY user_id
      ) tx ON u.user_id = tx.user_id
      ORDER BY u.wallet_balance DESC
    `);

    res.json({
      totalBalances: parseFloat(walletSum[0]?.total_balances || 0),
      userCount: walletSum[0]?.user_count || 0,
      flows: flowStats[0] || {},
      userAudits: userAudits.map(u => ({
        ...u,
        recorded_balance: parseFloat(u.recorded_balance || 0),
        calculated_flow: parseFloat(u.calculated_flow || 0),
        discrepancy: Math.abs(parseFloat(u.recorded_balance || 0) - parseFloat(u.calculated_flow || 0)) > 0.01
      }))
    });
  } catch (error) {
    console.error('Reconciliation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 6. Administrative Manual Adjustment (Audited Ledger Balance Correction)
router.post('/adjust-balance', async (req, res) => {
  const { user_id, amount, direction, reason, admin_id } = req.body;

  if (!user_id || !amount || parseFloat(amount) <= 0 || !direction || !reason) {
    return res.status(400).json({ message: 'user_id, positive amount, direction (credit/debit), and reason are required.' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [userRows] = await conn.query('SELECT wallet_balance, full_name FROM Users WHERE user_id = ? FOR UPDATE', [user_id]);
    if (userRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'User not found.' });
    }

    const curBal = parseFloat(userRows[0].wallet_balance) || 0;
    const adjAmount = parseFloat(amount);
    let newBal = curBal;

    if (direction === 'credit') {
      newBal = curBal + adjAmount;
    } else if (direction === 'debit') {
      if (curBal < adjAmount) {
        await conn.rollback();
        return res.status(400).json({ message: `Insufficient user balance (৳${curBal.toFixed(2)}) for debit adjustment of ৳${adjAmount.toFixed(2)}.` });
      }
      newBal = curBal - adjAmount;
    } else {
      await conn.rollback();
      return res.status(400).json({ message: 'Direction must be credit or debit.' });
    }

    // Update user balance
    await conn.query('UPDATE Users SET wallet_balance = ? WHERE user_id = ?', [newBal, user_id]);

    // Insert audited transaction
    const desc = `Super Admin Adjustment (${direction.toUpperCase()}): ${reason} (Authorized by #${admin_id || 'System'})`;
    const [txResult] = await conn.query(
      `INSERT INTO Transactions (user_id, type, amount, balance_after, description) VALUES (?, 'admin_adjustment', ?, ?, ?)`,
      [user_id, adjAmount, newBal, desc]
    );

    await conn.commit();
    res.json({
      message: `Successfully adjusted balance for ${userRows[0].full_name}. New balance: ৳${newBal.toFixed(2)}.`,
      transaction_id: txResult.insertId,
      new_balance: newBal
    });
  } catch (error) {
    await conn.rollback();
    console.error('Balance adjustment error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    conn.release();
  }
});

// Helper to resolve target users
function buildTargetFilter(target, user_ids) {
  let whereClause = '';
  let params = [];

  switch (target) {
    case 'student':
      whereClause = "WHERE role = 'student' AND (is_admin = 0 OR is_admin IS NULL)";
      break;
    case 'tutor':
      whereClause = "WHERE role = 'tutor' AND (is_admin = 0 OR is_admin IS NULL)";
      break;
    case 'both':
      whereClause = "WHERE role = 'both' AND (is_admin = 0 OR is_admin IS NULL)";
      break;
    case 'all_users':
      whereClause = "WHERE (is_admin = 0 OR is_admin IS NULL)";
      break;
    case 'admin':
      whereClause = "WHERE is_admin = 1";
      break;
    case 'specific':
      if (Array.isArray(user_ids) && user_ids.length > 0) {
        whereClause = "WHERE user_id IN (?)";
        params.push(user_ids);
      } else {
        whereClause = "WHERE 1 = 0";
      }
      break;
    case 'all':
    default:
      whereClause = "WHERE 1 = 1";
      break;
  }
  return { whereClause, params };
}

// 8. Preview Batch Balance Adjustment
router.post('/preview-batch-adjustment', async (req, res) => {
  const { target, user_ids, action, calc_mode, value, floor_zero = true } = req.body;
  const numVal = parseFloat(value);

  if (isNaN(numVal) || numVal <= 0) {
    return res.status(400).json({ message: 'A positive numeric value is required.' });
  }
  if (!['credit', 'debit'].includes(action)) {
    return res.status(400).json({ message: 'Action must be credit or debit.' });
  }
  if (!['fixed', 'percentage'].includes(calc_mode)) {
    return res.status(400).json({ message: 'Calculation mode must be fixed or percentage.' });
  }

  try {
    const { whereClause, params } = buildTargetFilter(target, user_ids);
    const sql = `SELECT user_id, full_name, email, role, student_id, department, wallet_balance, is_admin FROM Users ${whereClause} ORDER BY full_name ASC`;
    const [users] = await db.query(sql, params);

    let totalCurrentBalance = 0;
    let totalAdjustmentAmount = 0;

    const previewList = users.map(u => {
      const curBal = parseFloat(u.wallet_balance) || 0;
      totalCurrentBalance += curBal;

      const adj = calc_mode === 'percentage'
        ? Math.round((curBal * (numVal / 100)) * 100) / 100
        : Math.round(numVal * 100) / 100;

      let actualAdj = adj;
      let newBal = curBal;

      if (action === 'debit') {
        if (floor_zero) {
          actualAdj = Math.min(curBal, adj);
          newBal = Math.max(0, Math.round((curBal - actualAdj) * 100) / 100);
        } else {
          newBal = Math.round((curBal - adj) * 100) / 100;
        }
      } else {
        newBal = Math.round((curBal + adj) * 100) / 100;
      }

      totalAdjustmentAmount += actualAdj;

      return {
        user_id: u.user_id,
        full_name: u.full_name,
        email: u.email,
        role: u.is_admin ? 'admin' : u.role,
        student_id: u.student_id,
        department: u.department,
        current_balance: curBal,
        adjustment_amount: actualAdj,
        new_balance: newBal
      };
    });

    res.json({
      target_type: target,
      action,
      calc_mode,
      value: numVal,
      total_users: users.length,
      total_current_balance: Math.round(totalCurrentBalance * 100) / 100,
      total_adjustment_amount: Math.round(totalAdjustmentAmount * 100) / 100,
      preview: previewList
    });
  } catch (error) {
    console.error('Preview error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 9. Execute Batch Balance Adjustment
router.post('/batch-adjust-balance', async (req, res) => {
  const { target, user_ids, action, calc_mode, value, reason, admin_id, floor_zero = true } = req.body;
  const numVal = parseFloat(value);

  if (isNaN(numVal) || numVal <= 0) {
    return res.status(400).json({ message: 'A positive numeric value is required.' });
  }
  if (!['credit', 'debit'].includes(action)) {
    return res.status(400).json({ message: 'Action must be credit or debit.' });
  }
  if (!['fixed', 'percentage'].includes(calc_mode)) {
    return res.status(400).json({ message: 'Calculation mode must be fixed or percentage.' });
  }
  if (!reason || !reason.trim()) {
    return res.status(400).json({ message: 'An audit reason/memo is required for batch balance operations.' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const { whereClause, params } = buildTargetFilter(target, user_ids);
    const sql = `SELECT user_id, full_name, email, role, wallet_balance, is_admin FROM Users ${whereClause} FOR UPDATE`;
    const [users] = await conn.query(sql, params);

    if (users.length === 0) {
      await conn.rollback();
      return res.status(400).json({ message: 'No eligible users found for this target selection.' });
    }

    let affectedCount = 0;
    let totalAdjusted = 0;

    const opLabel = action === 'credit' ? 'CREDIT' : 'DEBIT';
    const ruleDetail = calc_mode === 'percentage' ? `${numVal}% of balance` : `৳${numVal.toFixed(2)}`;

    for (const u of users) {
      const curBal = parseFloat(u.wallet_balance) || 0;
      const adj = calc_mode === 'percentage'
        ? Math.round((curBal * (numVal / 100)) * 100) / 100
        : Math.round(numVal * 100) / 100;

      let actualAdj = adj;
      let newBal = curBal;

      if (action === 'debit') {
        if (floor_zero) {
          actualAdj = Math.min(curBal, adj);
          newBal = Math.max(0, Math.round((curBal - actualAdj) * 100) / 100);
        } else {
          newBal = Math.round((curBal - adj) * 100) / 100;
        }
      } else {
        newBal = Math.round((curBal + adj) * 100) / 100;
      }

      if (actualAdj > 0 || calc_mode === 'fixed') {
        await conn.query('UPDATE Users SET wallet_balance = ? WHERE user_id = ?', [newBal, u.user_id]);

        const desc = `Batch ${opLabel} (${ruleDetail}): ${reason.trim()} (Authorized by #${admin_id || 'System'})`;
        await conn.query(
          `INSERT INTO Transactions (user_id, type, amount, balance_after, description) VALUES (?, 'admin_adjustment', ?, ?, ?)`,
          [u.user_id, actualAdj, newBal, desc]
        );

        affectedCount++;
        totalAdjusted += actualAdj;
      }
    }

    await conn.commit();
    res.json({
      message: `Successfully processed ${opLabel} on ${affectedCount} accounts. Total adjusted: ৳${totalAdjusted.toFixed(2)}.`,
      affected_count: affectedCount,
      total_adjusted: totalAdjusted
    });
  } catch (error) {
    await conn.rollback();
    console.error('Batch adjustment error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    conn.release();
  }
});

module.exports = router;
