/**
 * ============================================================
 * MicroTeach — Setup & Seed Script
 * ============================================================
 *
 * Handles everything:
 *   - Creates database if it doesn't exist
 *   - Creates tables if they don't exist (no errors if they do)
 *   - Seeds data only if tables are empty
 *
 * Usage:
 *   node seed.js            — setup (skips what's already done)
 *   node seed.js --force    — re-seed data (keeps tables)
 *   node seed.js --fresh    — drop everything and start over
 *
 * All users login with password: password123
 * ============================================================
 */

const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const DB_NAME = process.env.DB_NAME || 'microteach_db';
const DEFAULT_PASSWORD = 'password123';

// ── Schema ───────────────────────────────────────────────────

const TABLES = {
  Users: `
    CREATE TABLE IF NOT EXISTS Users (
      user_id INT AUTO_INCREMENT PRIMARY KEY,
      full_name VARCHAR(100) NOT NULL,
      email VARCHAR(150) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      role ENUM('student','tutor','both') DEFAULT 'student',
      is_verified TINYINT(1) DEFAULT 0,
      department VARCHAR(100),
      bio TEXT,
      phone VARCHAR(20),
      student_id VARCHAR(50),
      wallet_balance DECIMAL(10,2) DEFAULT 0.00,
      is_admin TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
  Skills: `
    CREATE TABLE IF NOT EXISTS Skills (
      skill_id INT AUTO_INCREMENT PRIMARY KEY,
      skill_name VARCHAR(100) NOT NULL,
      category VARCHAR(100) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
  User_Skills: `
    CREATE TABLE IF NOT EXISTS User_Skills (
      user_skill_id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      skill_id INT NOT NULL,
      proficiency_level ENUM('Beginner','Intermediate','Expert') DEFAULT 'Intermediate',
      hourly_rate DECIMAL(8,2) DEFAULT 0.00,
      FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
      FOREIGN KEY (skill_id) REFERENCES Skills(skill_id) ON DELETE CASCADE
    )`,
  Posts: `
    CREATE TABLE IF NOT EXISTS Posts (
      post_id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      category VARCHAR(100) NOT NULL,
      course_code VARCHAR(50) NOT NULL,
      title VARCHAR(120) NOT NULL,
      description TEXT,
      delivery_format ENUM('live_call','annotated_pdf','video_walkthrough') DEFAULT 'live_call',
      bounty DECIMAL(10,2) DEFAULT 0.00,
      deadline VARCHAR(100),
      is_urgent TINYINT(1) DEFAULT 0,
      status ENUM('active','pending','resolved','closed') DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
    )`,
  Sessions: `
    CREATE TABLE IF NOT EXISTS Sessions (
      session_id INT AUTO_INCREMENT PRIMARY KEY,
      tutor_id INT NOT NULL,
      student_id INT NOT NULL,
      skill_id INT NOT NULL,
      scheduled_time DATETIME NOT NULL,
      duration_minutes INT DEFAULT 60,
      status ENUM('pending','accepted','completed','cancelled') DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tutor_id) REFERENCES Users(user_id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES Users(user_id) ON DELETE CASCADE,
      FOREIGN KEY (skill_id) REFERENCES Skills(skill_id) ON DELETE CASCADE
    )`,
  Teacher_Applications: `
    CREATE TABLE IF NOT EXISTS Teacher_Applications (
      application_id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      reason TEXT,
      expertise TEXT,
      status ENUM('pending','approved','rejected') DEFAULT 'pending',
      reviewed_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      reviewed_at TIMESTAMP NULL,
      FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
      FOREIGN KEY (reviewed_by) REFERENCES Users(user_id) ON DELETE SET NULL
    )`
};

// ── Sample Data ──────────────────────────────────────────────

const USERS = [
  { full_name: 'Rafiqul Islam', email: 'rafiq@bracu.ac.bd', role: 'both', is_verified: 1, department: 'Computer Science & Engineering', bio: 'CS & Data Structures tutor. Undergraduate TA for CSE 221. I love breaking down complex algorithms into simple steps.', phone: '+880 1712345678', student_id: '21201489', wallet_balance: 2350.00 },
  { full_name: 'Sadia Rahman', email: 'sadia@bracu.ac.bd', role: 'student', is_verified: 1, department: 'Computer Science & Engineering', bio: '3rd year CS student. Struggling with algorithms and calculus. Looking for peer help during midterm sprint.', phone: '+880 1834567890', student_id: '22101156', wallet_balance: 500.00 },
  { full_name: 'Tanvir Hossain', email: 'tanvir@bracu.ac.bd', role: 'tutor', is_verified: 1, department: 'Electrical & Electronic Engineering', bio: 'EEE tutor specializing in circuits, signal processing, and system architecture. 4.9 star rating.', phone: '+880 1956789012', student_id: '20301782', wallet_balance: 4100.00 },
  { full_name: 'Nusrat Jahan', email: 'nusrat@bracu.ac.bd', role: 'both', is_verified: 0, department: 'Mathematics', bio: 'Math tutor. Calculus, linear algebra, and statistics. Passionate about making math accessible.', phone: '+880 1678901234', student_id: '21101345', wallet_balance: 1200.00 },
  { full_name: 'Imran Sheikh', email: 'imran@bracu.ac.bd', role: 'student', is_verified: 0, department: 'Software Engineering', bio: 'Software engineering student. Need help with OOP, databases, and machine learning concepts.', phone: '+880 1790123456', student_id: '22201678', wallet_balance: 300.00 },
  { full_name: 'Fatima Akter', email: 'fatima@bracu.ac.bd', role: 'tutor', is_verified: 1, department: 'Data Science & AI', bio: 'ML and data science tutor. Currently working on neural network research. Happy to help with Python, TensorFlow, and statistical modeling.', phone: '+880 1812345678', student_id: '20101923', wallet_balance: 3750.00 },
  { full_name: 'Salman Admin', email: 'salman@gmail.com', role: 'both', is_verified: 1, department: 'Administration', bio: 'Platform administrator.', phone: '+880 1999999999', student_id: 'ADMIN001', wallet_balance: 0.00, is_admin: 1 },
  { full_name: 'Test Student', email: 'test@student.com', role: 'student', is_verified: 1, department: 'Computer Science & Engineering', bio: 'Testing the platform. 2nd year CS student.', phone: '+880 1888888888', student_id: 'TEST001', wallet_balance: 200.00 }
];

const SKILLS = [
  { skill_name: 'Algorithms & Data Structures', category: 'Computer Science' },
  { skill_name: 'Object-Oriented Programming', category: 'Computer Science' },
  { skill_name: 'Database Management Systems', category: 'Computer Science' },
  { skill_name: 'Machine Learning', category: 'Data Science' },
  { skill_name: 'Calculus I & II', category: 'Mathematics' },
  { skill_name: 'Linear Algebra', category: 'Mathematics' },
  { skill_name: 'Physics I & II', category: 'Science' },
  { skill_name: 'Circuit Analysis', category: 'Engineering' },
  { skill_name: 'System Architecture', category: 'Engineering' },
  { skill_name: 'Statistics & Probability', category: 'Mathematics' },
  { skill_name: 'Python Programming', category: 'Computer Science' },
  { skill_name: 'Java Programming', category: 'Computer Science' }
];

const USER_SKILLS = [
  { user_email: 'rafiq@bracu.ac.bd', skill_name: 'Algorithms & Data Structures', level: 'Expert', rate: 400 },
  { user_email: 'rafiq@bracu.ac.bd', skill_name: 'Object-Oriented Programming', level: 'Expert', rate: 350 },
  { user_email: 'rafiq@bracu.ac.bd', skill_name: 'Database Management Systems', level: 'Intermediate', rate: 300 },
  { user_email: 'tanvir@bracu.ac.bd', skill_name: 'Circuit Analysis', level: 'Expert', rate: 450 },
  { user_email: 'tanvir@bracu.ac.bd', skill_name: 'System Architecture', level: 'Expert', rate: 500 },
  { user_email: 'nusrat@bracu.ac.bd', skill_name: 'Calculus I & II', level: 'Expert', rate: 300 },
  { user_email: 'nusrat@bracu.ac.bd', skill_name: 'Linear Algebra', level: 'Expert', rate: 300 },
  { user_email: 'nusrat@bracu.ac.bd', skill_name: 'Statistics & Probability', level: 'Intermediate', rate: 280 },
  { user_email: 'fatima@bracu.ac.bd', skill_name: 'Machine Learning', level: 'Expert', rate: 500 },
  { user_email: 'fatima@bracu.ac.bd', skill_name: 'Python Programming', level: 'Expert', rate: 400 },
  { user_email: 'fatima@bracu.ac.bd', skill_name: 'Statistics & Probability', level: 'Expert', rate: 350 },
  { user_email: 'sadia@bracu.ac.bd', skill_name: 'Algorithms & Data Structures', level: 'Beginner', rate: 0 },
  { user_email: 'sadia@bracu.ac.bd', skill_name: 'Calculus I & II', level: 'Beginner', rate: 0 },
  { user_email: 'imran@bracu.ac.bd', skill_name: 'Object-Oriented Programming', level: 'Beginner', rate: 0 },
  { user_email: 'imran@bracu.ac.bd', skill_name: 'Machine Learning', level: 'Beginner', rate: 0 },
  { user_email: 'imran@bracu.ac.bd', skill_name: 'Database Management Systems', level: 'Beginner', rate: 0 }
];

const POSTS = [
  { author: 'sadia@bracu.ac.bd', category: 'Algorithms & DS', code: 'CSE 221', title: 'Dynamic Programming memoization table segmentation fault in Bellman-Ford', desc: 'Need quick help tracing out array boundary indices and memo lookup in bottom-up state formulation. My recursion-to-tabulation conversion keeps hitting segfault on the inner loop.', format: 'live_call', bounty: 350, deadline: 'Today at 10:00 PM', urgent: 1 },
  { author: 'imran@bracu.ac.bd', category: 'Object-Oriented', code: 'CSE 111', title: 'Polymorphism and Abstract Class hierarchy debug', desc: 'Debugging virtual method dispatch and inheritance structure in Java. My abstract class implementation is not behaving as expected with method overriding.', format: 'annotated_pdf', bounty: 300, deadline: 'Tomorrow at 2:00 PM', urgent: 0 },
  { author: 'sadia@bracu.ac.bd', category: 'Calculus & Math', code: 'MTH 201', title: 'Integration by partial fractions — complex rational functions', desc: 'Struggling with decomposing higher-order rational functions into partial fractions. Need step-by-step breakdown for exam prep.', format: 'video_walkthrough', bounty: 250, deadline: 'This Friday', urgent: 0 },
  { author: 'imran@bracu.ac.bd', category: 'Physics & Lab', code: 'PHY 102', title: 'Projectile motion with air resistance — numerical method approach', desc: 'Need help implementing Euler method for projectile motion simulation with quadratic drag. My Python code diverges for high initial velocities.', format: 'live_call', bounty: 400, deadline: 'Today at 8:00 PM', urgent: 1 },
  { author: 'sadia@bracu.ac.bd', category: 'System Architecture', code: 'CSE 331', title: 'Pipeline hazard detection and forwarding unit design', desc: 'Designing the forwarding unit for a 5-stage MIPS pipeline. Need help with data hazard detection logic and control hazard resolution.', format: 'annotated_pdf', bounty: 450, deadline: 'Wednesday', urgent: 0 },
  { author: 'imran@bracu.ac.bd', category: 'Circuits & EEE', code: 'EEE 163', title: 'Thevenin equivalent circuit for multi-source network', desc: 'Finding Thevenin equivalent when there are multiple independent sources. My nodal analysis gives wrong Vth value for the bridge circuit.', format: 'live_call', bounty: 300, deadline: 'Tomorrow at 6:00 PM', urgent: 0 }
];

const SESSIONS = [
  { tutor: 'rafiq@bracu.ac.bd', student: 'sadia@bracu.ac.bd', skill: 'Algorithms & Data Structures', time: '2026-09-14 18:00:00', duration: 30, status: 'accepted' },
  { tutor: 'nusrat@bracu.ac.bd', student: 'sadia@bracu.ac.bd', skill: 'Calculus I & II', time: '2026-09-15 16:00:00', duration: 45, status: 'pending' },
  { tutor: 'fatima@bracu.ac.bd', student: 'imran@bracu.ac.bd', skill: 'Machine Learning', time: '2026-09-14 20:00:00', duration: 30, status: 'completed' },
  { tutor: 'tanvir@bracu.ac.bd', student: 'imran@bracu.ac.bd', skill: 'System Architecture', time: '2026-09-16 14:00:00', duration: 60, status: 'pending' }
];

// ── Helpers ──────────────────────────────────────────────────

async function tableExists(conn, tableName) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) as count FROM information_schema.tables
     WHERE table_schema = ? AND table_name = ?`,
    [DB_NAME, tableName]
  );
  return rows[0].count > 0;
}

async function tableIsEmpty(conn, tableName) {
  const [rows] = await conn.query(`SELECT COUNT(*) as count FROM \`${tableName}\``);
  return rows[0].count === 0;
}

// ── Main ─────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const fresh = args.includes('--fresh');

  console.log('\n🌱 MicroTeach — Setup & Seed\n');

  // 1. Connect to MySQL (no database selected yet)
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
  });
  console.log('✅ Connected to MySQL');

  // 2. Check if database exists, create if not
  const [dbCheck] = await conn.query(
    `SELECT COUNT(*) as count FROM information_schema.schemata WHERE schema_name = ?`,
    [DB_NAME]
  );
  if (dbCheck[0].count === 0) {
    await conn.query(`CREATE DATABASE \`${DB_NAME}\``);
    console.log(`✅ Created database "${DB_NAME}"`);
  } else {
    console.log(`✅ Database "${DB_NAME}" already exists — using it`);
  }
  await conn.query(`USE \`${DB_NAME}\``);

  // 3. --fresh: drop everything
  if (fresh) {
    console.log('\n⚠️  Fresh mode — dropping all tables...');
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const name of ['Teacher_Applications', 'Sessions', 'Posts', 'User_Skills', 'Skills', 'Users']) {
      await conn.query(`DROP TABLE IF EXISTS \`${name}\``);
    }
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('✅ All tables dropped');
  }

  // 4. Create tables (IF NOT EXISTS — no errors if they exist)
  console.log('\n📋 Checking tables...');
  let tablesCreated = 0;
  for (const [name, sql] of Object.entries(TABLES)) {
    const exists = await tableExists(conn, name);
    if (!exists) {
      await conn.query(sql);
      console.log(`  + Created "${name}"`);
      tablesCreated++;
    } else {
      console.log(`  ✓ "${name}" already exists — skipping`);
    }
  }
  if (tablesCreated === 0) {
    console.log('  All tables already exist');
  }

  // 5. Check if data is already seeded
  if (!force && !fresh) {
    const usersEmpty = await tableIsEmpty(conn, 'Users');
    if (!usersEmpty) {
      const [counts] = await conn.query(`
        SELECT
          (SELECT COUNT(*) FROM Users) as users,
          (SELECT COUNT(*) FROM Posts) as posts,
          (SELECT COUNT(*) FROM Skills) as skills
      `);
      const c = counts[0];
      console.log(`\n📋 Data already seeded (${c.users} users, ${c.posts} posts, ${c.skills} skills)`);
      console.log('   Use --force to re-seed or --fresh to start over\n');
      await conn.end();
      return;
    }
  }

  // 6. --force: clear data before re-seeding
  if (force && !fresh) {
    console.log('\n⚠️  Clearing existing data...');
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const name of ['Teacher_Applications', 'Sessions', 'Posts', 'User_Skills', 'Skills', 'Users']) {
      await conn.query(`TRUNCATE TABLE \`${name}\``);
    }
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('✅ Data cleared');
  }

  // 7. Seed Users
  console.log('\n👤 Seeding users...');
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(DEFAULT_PASSWORD, salt);
  const uid = {};

  for (const u of USERS) {
    const [r] = await conn.query(
      `INSERT INTO Users (full_name, email, password, role, is_verified, department, bio, phone, student_id, wallet_balance, is_admin)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [u.full_name, u.email, hash, u.role, u.is_verified, u.department, u.bio, u.phone, u.student_id, u.wallet_balance, u.is_admin || 0]
    );
    uid[u.email] = r.insertId;
    console.log(`  + ${u.full_name} (${u.email})`);
  }

  // 8. Seed Skills
  console.log('\n📚 Seeding skills...');
  const sid = {};

  for (const s of SKILLS) {
    const [r] = await conn.query('INSERT INTO Skills (skill_name, category) VALUES (?, ?)', [s.skill_name, s.category]);
    sid[s.skill_name] = r.insertId;
    console.log(`  + ${s.skill_name}`);
  }

  // 9. Seed User_Skills
  console.log('\n🔗 Linking users to skills...');
  for (const us of USER_SKILLS) {
    await conn.query(
      'INSERT INTO User_Skills (user_id, skill_id, proficiency_level, hourly_rate) VALUES (?, ?, ?, ?)',
      [uid[us.user_email], sid[us.skill_name], us.level, us.rate]
    );
    console.log(`  + ${us.user_email} → ${us.skill_name} (${us.level})`);
  }

  // 10. Seed Posts
  console.log('\n📝 Seeding posts...');
  for (const p of POSTS) {
    await conn.query(
      `INSERT INTO Posts (user_id, category, course_code, title, description, delivery_format, bounty, deadline, is_urgent, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [uid[p.author], p.category, p.code, p.title, p.desc, p.format, p.bounty, p.deadline, p.urgent]
    );
    console.log(`  + ${p.title.substring(0, 55)}...`);
  }

  // 11. Seed Sessions
  console.log('\n📅 Seeding sessions...');
  for (const s of SESSIONS) {
    const [skillRow] = await conn.query('SELECT skill_id FROM Skills WHERE skill_name = ?', [s.skill]);
    await conn.query(
      `INSERT INTO Sessions (tutor_id, student_id, skill_id, scheduled_time, duration_minutes, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [uid[s.tutor], uid[s.student], skillRow[0].skill_id, s.time, s.duration, s.status]
    );
    console.log(`  + ${s.tutor} → ${s.student} [${s.status}]`);
  }

  // 12. Seed Teacher Applications
  console.log('\n📋 Seeding teacher applications...');
  const applications = [
    { user_email: 'sadia@bracu.ac.bd', reason: 'I have been helping peers with algorithms and calculus for 2 years. Want to officially become a tutor.', expertise: 'Algorithms & Data Structures, Calculus I & II', status: 'pending' },
    { user_email: 'imran@bracu.ac.bd', reason: 'Strong background in OOP and databases. Want to tutor junior students.', expertise: 'Object-Oriented Programming, Database Management Systems', status: 'pending' },
  ];
  for (const app of applications) {
    await conn.query(
      `INSERT INTO Teacher_Applications (user_id, reason, expertise, status) VALUES (?, ?, ?, ?)`,
      [uid[app.user_email], app.reason, app.expertise, app.status]
    );
    console.log(`  + ${app.user_email} [${app.status}]`);
  }

  // Summary
  const [counts] = await conn.query(`
    SELECT
      (SELECT COUNT(*) FROM Users) as users,
      (SELECT COUNT(*) FROM Skills) as skills,
      (SELECT COUNT(*) FROM User_Skills) as user_skills,
      (SELECT COUNT(*) FROM Posts) as posts,
      (SELECT COUNT(*) FROM Sessions) as sessions,
      (SELECT COUNT(*) FROM Teacher_Applications) as applications
  `);
  const c = counts[0];

  console.log('\n' + '═'.repeat(50));
  console.log('✅ SETUP COMPLETE');
  console.log('═'.repeat(50));
  console.log(`   Users:       ${c.users}`);
  console.log(`   Skills:      ${c.skills}`);
  console.log(`   User-Skills: ${c.user_skills}`);
  console.log(`   Posts:       ${c.posts}`);
  console.log(`   Sessions:    ${c.sessions}`);
  console.log(`   Applications: ${c.applications}`);
  console.log('═'.repeat(50));
  console.log('\n🔑 All users login with password: ' + DEFAULT_PASSWORD);
  console.log('   Example: rafiq@bracu.ac.bd / password123\n');

  await conn.end();
}

main().catch(err => {
  console.error('\n❌ Setup failed:', err.message);
  process.exit(1);
});
