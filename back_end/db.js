const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '.env') });
const { randomAvatarColor } = require('./avatarColors');

const isPostgres = Boolean(
  process.env.DATABASE_URL &&
  (process.env.DATABASE_URL.startsWith('postgres://') || process.env.DATABASE_URL.startsWith('postgresql://'))
);

let pool;
let dbInterface;

if (isPostgres) {
  // ─── PostgreSQL / Supabase Driver ───
  const { Pool } = require('pg');
  const isLocalPg = process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1');

  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: isLocalPg ? false : { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
  });

  // Convert MySQL '?' syntax to PostgreSQL '$1, $2...' & handle array expansion
  function formatPgQuery(sql, params = []) {
    if (!params || params.length === 0) return { sql, params: [] };
    let pIdx = 1;
    const flatParams = [];
    let inSingle = false;
    let inDouble = false;
    let newSql = '';

    for (let i = 0; i < sql.length; i++) {
      const char = sql[i];
      if (char === "'" && (i === 0 || sql[i - 1] !== '\\')) inSingle = !inSingle;
      else if (char === '"' && (i === 0 || sql[i - 1] !== '\\')) inDouble = !inDouble;

      if (char === '?' && !inSingle && !inDouble) {
        const paramVal = params[flatParams.length];
        if (Array.isArray(paramVal)) {
          if (paramVal.length === 0) {
            newSql += 'NULL';
            flatParams.push(null);
          } else {
            const placeholders = paramVal.map(() => `$${pIdx++}`).join(', ');
            newSql += placeholders;
            flatParams.push(...paramVal);
          }
        } else {
          newSql += `$${pIdx++}`;
          flatParams.push(paramVal);
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

  function extractInsertId(firstRow) {
    if (!firstRow) return null;
    return (
      firstRow.user_id ||
      firstRow.post_id ||
      firstRow.report_id ||
      firstRow.transaction_id ||
      firstRow.dispute_id ||
      firstRow.application_id ||
      firstRow.session_id ||
      firstRow.skill_id ||
      firstRow.document_id ||
      firstRow.conversation_id ||
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
      const insertId = extractInsertId(firstRow);
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
module.exports.initSchema = initSchema;
