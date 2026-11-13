const crypto = require('crypto');
const db = require('./db');

const SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const BROWSER_SESSION_LIFETIME_MS = 12 * 60 * 60 * 1000;
const IS_PRODUCTION = Boolean(process.env.VERCEL || process.env.NODE_ENV === 'production');
const COOKIE_NAME = IS_PRODUCTION ? '__Host-microteach_session' : 'microteach_session';

function cookie(value, maxAge) {
  const parts = [
    `${COOKIE_NAME}=${value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
  ];
  if (maxAge !== null) parts.push(`Max-Age=${maxAge}`);
  if (IS_PRODUCTION) parts.push('Secure');
  return parts.join('; ');
}

function readToken(req) {
  const cookies = (req.headers.cookie || '').split(';');
  const pair = cookies.find((part) => part.trim().startsWith(`${COOKIE_NAME}=`));
  if (!pair) return null;
  const token = pair.trim().slice(COOKIE_NAME.length + 1);
  return /^[a-f0-9]{64}$/.test(token) ? token : null;
}

function tokenHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function createSession(res, userId, remember = false) {
  await db.query('DELETE FROM Auth_Sessions WHERE expires_at <= ?', [new Date()]);
  const token = crypto.randomBytes(32).toString('hex');
  const lifetime = remember ? SESSION_LIFETIME_MS : BROWSER_SESSION_LIFETIME_MS;
  await db.query(
    'INSERT INTO Auth_Sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)',
    [tokenHash(token), userId, new Date(Date.now() + lifetime)]
  );
  res.setHeader('Set-Cookie', cookie(token, remember ? lifetime / 1000 : null));
  res.setHeader('Cache-Control', 'no-store');
}

async function loadSession(req) {
  const token = readToken(req);
  if (!token) return null;
  const [rows] = await db.query(
    `SELECT u.user_id, u.full_name, u.email, u.role, u.is_verified,
            u.department, u.bio, u.phone, u.student_id, u.wallet_balance,
            u.is_admin, u.avatar_color, u.created_at
       FROM Auth_Sessions s
       JOIN Users u ON u.user_id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > ?`,
    [tokenHash(token), new Date()]
  );
  return rows[0] || null;
}

async function requireSession(req, res, next) {
  try {
    req.auth = await loadSession(req);
    if (!req.auth) return res.status(401).json({ message: 'Please sign in.' });
    res.setHeader('Cache-Control', 'no-store');
    next();
  } catch (error) {
    next(error);
  }
}

async function optionalSession(req, res, next) {
  try {
    req.auth = await loadSession(req);
    next();
  } catch (error) {
    next(error);
  }
}

async function endSession(req, res) {
  const token = readToken(req);
  if (token) {
    await db.query('DELETE FROM Auth_Sessions WHERE token_hash = ?', [tokenHash(token)]);
  }
  res.setHeader('Set-Cookie', cookie('', 0));
  res.setHeader('Cache-Control', 'no-store');
}

module.exports = { createSession, loadSession, requireSession, optionalSession, endSession };
