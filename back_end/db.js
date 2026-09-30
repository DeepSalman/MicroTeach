const mysql = require('mysql2/promise');
require('dotenv').config();
const { randomAvatarColor } = require('./avatarColors');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Ensure the Users table has an avatar_color column and that every user
// has one (old rows get a random non-red palette color).
const initSchema = (async () => {
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
      if (err.errno !== 1060) throw err; // 1060 = duplicate column (already exists)
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
    if (rows.length > 0) {
      console.log(`Assigned profile colors to ${rows.length} existing user(s).`);
    }
  } catch (err) {
    console.error('Error preparing avatar_color column:', err.message);
  } finally {
    connection.release();
  }
})();

module.exports = pool;
module.exports.initSchema = initSchema;
