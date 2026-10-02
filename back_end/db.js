const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(process.cwd(), '.env') });
dotenv.config({ path: path.join(process.cwd(), 'back_end', '.env') });

const { randomAvatarColor } = require('./avatarColors');

const SUPABASE_FALLBACK_URL = "postgresql://postgres.tdbflvjdjrjzomywuxqg:thereisaverystrongpasswordwhichis%40123@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true";

// Determine effective database connection string
const rawDbUrl = process.env.DATABASE_URL || (process.env.VERCEL || process.env.NODE_ENV === 'production' ? SUPABASE_FALLBACK_URL : null);

const isPostgres = Boolean(
  rawDbUrl &&
  (rawDbUrl.startsWith('postgres://') || rawDbUrl.startsWith('postgresql://'))
);

let pool;
let dbInterface;

if (isPostgres) {
  // ─── PostgreSQL / Supabase Driver ───
  const { Pool } = require('pg');
  const isLocalPg = rawDbUrl.includes('localhost') || rawDbUrl.includes('127.0.0.1');

  pool = new Pool({
    connectionString: rawDbUrl,
    ssl: isLocalPg ? false : { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  });

  // Convert MySQL '?' syntax to PostgreSQL '$1, $2...' & handle array expansion
  function formatPgQuery(rawSql, params = []) {
    // Normalize MySQL NOW(3) -> NOW() for PostgreSQL compatibility
    const sql = rawSql.replace(/NOW\s*\(\s*\d+\s*\)/gi, 'NOW()');
    if (!params || params.length === 0) return { sql, params: [] };

    let pIdx = 1;
    let rawParamIdx = 0;
    const flatParams = [];
    let inSingle = false;
    let inDouble = false;
    let newSql = '';

    const normalizeVal = (val) => {
      if (val === true) return 1;
      if (val === false) return 0;
      return val;
    };

    for (let i = 0; i < sql.length; i++) {
      const char = sql[i];
      if (char === "'" && (i === 0 || sql[i - 1] !== '\\')) inSingle = !inSingle;
      else if (char === '"' && (i === 0 || sql[i - 1] !== '\\')) inDouble = !inDouble;

      if (char === '?' && !inSingle && !inDouble) {
        const paramVal = params[rawParamIdx++];
        if (Array.isArray(paramVal)) {
          if (paramVal.length === 0) {
            newSql += 'NULL';
            flatParams.push(null);
          } else {
            const placeholders = paramVal.map(() => `$${pIdx++}`).join(', ');
            newSql += placeholders;
            flatParams.push(...paramVal.map(normalizeVal));
          }
        } else {
          newSql += `$${pIdx++}`;
          flatParams.push(normalizeVal(paramVal));
        }
      } else {
        newSql += char;
      }
    }
    return { sql: newSql, params: flatParams };
  }

  // Auto-append RETURNING * to INSERT statements if not present
  function ensureReturning(sql) {
    if (/^\s*insert\s+/i.test(sql) && !/\sreturning\s+/i.test(sql)) {
      return `${sql.trim().replace(/;+$/, '')} RETURNING *`;
    }
    return sql;
  }

  const TABLE_PK_MAP = {
    users: 'user_id',
    posts: 'post_id',
    teacher_applications: 'application_id',
    post_applications: 'application_id',
    teacher_application_documents: 'document_id',
    transactions: 'transaction_id',
    transaction_disputes: 'dispute_id',
    reports: 'report_id',
    sessions: 'session_id',
    skills: 'skill_id',
    reviews: 'review_id',
    conversations: 'conversation_id',
    messages: 'message_id'
  };

  function extractInsertId(firstRow, rawSql = '') {
    if (!firstRow) return null;
    const match = rawSql.match(/insert\s+into\s+[`"']?([a-zA-Z0-9_]+)/i);
    if (match) {
      const tbl = match[1].toLowerCase();
      const pkField = TABLE_PK_MAP[tbl];
      if (pkField && firstRow[pkField] !== undefined) {
        return firstRow[pkField];
      }
    }
    return (
      firstRow.application_id ||
      firstRow.document_id ||
      firstRow.post_id ||
      firstRow.report_id ||
      firstRow.transaction_id ||
      firstRow.dispute_id ||
      firstRow.session_id ||
      firstRow.skill_id ||
      firstRow.review_id ||
      firstRow.message_id ||
      firstRow.conversation_id ||
      firstRow.user_id ||
      firstRow.id ||
      Object.values(firstRow)[0] ||
      null
    );
  }

  async function executePgQuery(clientOrPool, rawSql, rawParams) {
    const isInsert = /^\s*insert\s+/i.test(rawSql);
    const sqlWithReturning = isInsert ? ensureReturning(rawSql) : rawSql;
    const { sql: pgSql, params: pgParams } = formatPgQuery(sqlWithReturning, rawParams);

    const res = await clientOrPool.query(pgSql, pgParams);

    if (isInsert) {
      const firstRow = res.rows[0];
      const insertId = extractInsertId(firstRow, rawSql);
      const resultObj = {
        insertId,
        affectedRows: res.rowCount,
        rowCount: res.rowCount
      };
      return [resultObj, res.fields];
    }

    return [res.rows, res.fields];
  }

  dbInterface = {
    isPostgres: true,
    query: (sql, params) => executePgQuery(pool, sql, params),
    getConnection: async () => {
      const client = await pool.connect();
      return {
        query: (sql, params) => executePgQuery(client, sql, params),
        beginTransaction: async () => { await client.query('BEGIN'); },
        commit: async () => { await client.query('COMMIT'); },
        rollback: async () => { await client.query('ROLLBACK'); },
        release: () => { client.release(); }
      };
    }
  };

} else {
  // ─── MySQL Driver (Default / Local) ───
  const mysql = require('mysql2/promise');

  pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'microteach_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  dbInterface = {
    isPostgres: false,
    query: (sql, params) => pool.query(sql, params),
    getConnection: () => pool.getConnection()
  };
}

// Ensure database connection and initial schema adjustments
const initSchema = (async () => {
  if (isPostgres) {
    try {
      const [rows] = await dbInterface.query('SELECT NOW() as current_time');
      console.log('Successfully connected to PostgreSQL (Supabase) database! Server time:', rows[0]?.current_time);
    } catch (err) {
      console.error('Error connecting to PostgreSQL:', err.message);
    }
    return;
  }

  // MySQL avatar color check
  let connection;
  try {
    connection = await pool.getConnection();
    console.log('Successfully connected to MySQL database!');
  } catch (err) {
    console.error('Error connecting to MySQL:', err.message);
    return;
  }

  try {
    try {
      await connection.query('ALTER TABLE Users ADD COLUMN avatar_color VARCHAR(7) NULL');
    } catch (err) {
      if (err.errno !== 1060) throw err;
    }

    const [rows] = await connection.query(
      'SELECT user_id FROM Users WHERE avatar_color IS NULL OR avatar_color = ""'
    );
    for (const row of rows) {
      await connection.query('UPDATE Users SET avatar_color = ? WHERE user_id = ?', [
        randomAvatarColor(),
        row.user_id
      ]);
    }
  } catch (err) {
    console.error('Error preparing avatar_color column:', err.message);
  } finally {
    connection.release();
  }
})();

module.exports = dbInterface;
module.exports.isPostgres = isPostgres;
module.exports.initSchema = initSchema;
