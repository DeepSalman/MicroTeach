const db = require('./db');

class EscrowError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function toCents(value) {
  const match = /^(\d{1,8})(?:\.(\d{1,2}))?$/.exec(String(value));
  if (!match) throw new EscrowError(400, 'Amount must be a non-negative value with at most two decimal places.');
  return Number(match[1]) * 100 + Number((match[2] || '').padEnd(2, '0'));
}

const money = (cents) => (cents / 100).toFixed(2);

async function inTransaction(work) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const result = await work(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function lockPost(conn, postId) {
  const [rows] = await conn.query(
    'SELECT post_id, user_id, bounty, status FROM Posts WHERE post_id = ? FOR UPDATE',
    [postId]
  );
  if (!rows.length) throw new EscrowError(404, 'Post not found.');
  return rows[0];
}

// Call only after locking the post, inside the same database transaction.
async function settleEscrow(conn, post, allocations) {
  const bountyCents = toCents(post.bounty);
  if (bountyCents === 0) return { released: false, empty: true };
  const paidCents = allocations.reduce((total, item) => total + item.cents, 0);
  if (paidCents !== bountyCents || allocations.some((item) => item.cents < 0)) {
    throw new EscrowError(400, 'Escrow allocation must equal the held bounty.');
  }

  const [settled] = await conn.query(
    'SELECT outcome FROM Escrow_Settlements WHERE post_id = ? FOR UPDATE',
    [post.post_id]
  );
  if (settled.length) return { released: false, alreadySettled: true };

  // Protect posts settled before Escrow_Settlements was introduced.
  const [legacySettlement] = await conn.query(
    "SELECT transaction_id FROM Transactions WHERE reference_id = ? AND type IN ('refund', 'bounty_received', 'bounty_payment') LIMIT 1 FOR UPDATE",
    [post.post_id]
  );
  if (legacySettlement.length) return { released: false, alreadySettled: true };

  const [holds] = await conn.query(
    "SELECT amount FROM Transactions WHERE reference_id = ? AND user_id = ? AND type = 'bounty_held' FOR UPDATE",
    [post.post_id, post.user_id]
  );
  if (!holds.some((hold) => toCents(hold.amount) === bountyCents)) {
    throw new EscrowError(409, 'Escrow hold is missing or inconsistent. Reconcile this post before settlement.');
  }

  const outcome = allocations.length === 2 ? 'split' :
    allocations[0].type === 'refund' ? 'refund' : 'payout';
  await conn.query(
    'INSERT INTO Escrow_Settlements (post_id, outcome) VALUES (?, ?)',
    [post.post_id, outcome]
  );

  for (const item of allocations.filter((entry) => entry.cents > 0).sort((a, b) => Number(a.userId) - Number(b.userId))) {
    if (!['refund', 'bounty_received'].includes(item.type)) {
      throw new EscrowError(400, 'Invalid escrow allocation type.');
    }
    const [users] = await conn.query(
      'SELECT wallet_balance FROM Users WHERE user_id = ? FOR UPDATE',
      [item.userId]
    );
    if (!users.length) throw new EscrowError(404, 'Escrow recipient not found.');
    const newBalance = money(toCents(users[0].wallet_balance) + item.cents);
    await conn.query('UPDATE Users SET wallet_balance = ? WHERE user_id = ?', [newBalance, item.userId]);
    await conn.query(
      'INSERT INTO Transactions (user_id, type, amount, balance_after, reference_id, description) VALUES (?, ?, ?, ?, ?, ?)',
      [item.userId, item.type, money(item.cents), newBalance, post.post_id, item.description]
    );
  }
  return { released: true };
}

module.exports = { EscrowError, toCents, money, inTransaction, lockPost, settleEscrow };
