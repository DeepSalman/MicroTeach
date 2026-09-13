/**
 * ============================================================
 * MicroTeach Database Seed Script
 * ============================================================
 *
 * Usage:
 *   node seed.js           — seed data (skips if tables already have data)
 *   node seed.js --force    — clear all data and re-seed
 *   node seed.js --reset    — drop and recreate all tables, then seed
 *
 * Default login (all users): password is "password123"
 *
 * Last updated: 2026-09-13
 * ============================================================
 */

const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const DEFAULT_PASSWORD = 'password123';

// ── Sample Data ──────────────────────────────────────────────

const users = [
  {
    full_name: 'Rafiqul Islam',
    email: 'rafiq@bracu.ac.bd',
    role: 'both',
    is_verified: 1,
    department: 'Computer Science & Engineering',
    bio: 'CS & Data Structures tutor. Undergraduate TA for CSE 221. I love breaking down complex algorithms into simple steps.',
    phone: '+880 1712345678',
    student_id: '21201489',
    wallet_balance: 2350.00
  },
  {
    full_name: 'Sadia Rahman',
    email: 'sadia@bracu.ac.bd',
    role: 'student',
    is_verified: 1,
    department: 'Computer Science & Engineering',
    bio: '3rd year CS student. Struggling with algorithms and calculus. Looking for peer help during midterm sprint.',
    phone: '+880 1834567890',
    student_id: '22101156',
    wallet_balance: 500.00
  },
  {
    full_name: 'Tanvir Hossain',
    email: 'tanvir@bracu.ac.bd',
    role: 'tutor',
    is_verified: 1,
    department: 'Electrical & Electronic Engineering',
    bio: 'EEE tutor specializing in circuits, signal processing, and system architecture. 4.9 star rating.',
    phone: '+880 1956789012',
    student_id: '20301782',
    wallet_balance: 4100.00
  },
  {
    full_name: 'Nusrat Jahan',
    email: 'nusrat@bracu.ac.bd',
    role: 'both',
    is_verified: 0,
    department: 'Mathematics',
    bio: 'Math tutor. Calculus, linear algebra, and statistics. Passionate about making math accessible.',
    phone: '+880 1678901234',
    student_id: '21101345',
    wallet_balance: 1200.00
  },
  {
    full_name: 'Imran Sheikh',
    email: 'imran@bracu.ac.bd',
    role: 'student',
    is_verified: 0,
    department: 'Software Engineering',
    bio: 'Software engineering student. Need help with OOP, databases, and machine learning concepts.',
    phone: '+880 1790123456',
    student_id: '22201678',
    wallet_balance: 300.00
  },
  {
    full_name: 'Fatima Akter',
    email: 'fatima@bracu.ac.bd',
    role: 'tutor',
    is_verified: 1,
    department: 'Data Science & AI',
    bio: 'ML and data science tutor. Currently working on neural network research. Happy to help with Python, TensorFlow, and statistical modeling.',
    phone: '+880 1812345678',
    student_id: '20101923',
    wallet_balance: 3750.00
  }
];

const skills = [
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

const userSkills = [
  // Rafiqul - tutor in CS
  { user_email: 'rafiq@bracu.ac.bd', skill_name: 'Algorithms & Data Structures', proficiency_level: 'Expert', hourly_rate: 400 },
  { user_email: 'rafiq@bracu.ac.bd', skill_name: 'Object-Oriented Programming', proficiency_level: 'Expert', hourly_rate: 350 },
  { user_email: 'rafiq@bracu.ac.bd', skill_name: 'Database Management Systems', proficiency_level: 'Intermediate', hourly_rate: 300 },
  // Tanvir - tutor in EEE
  { user_email: 'tanvir@bracu.ac.bd', skill_name: 'Circuit Analysis', proficiency_level: 'Expert', hourly_rate: 450 },
  { user_email: 'tanvir@bracu.ac.bd', skill_name: 'System Architecture', proficiency_level: 'Expert', hourly_rate: 500 },
  // Nusrat - tutor in Math
  { user_email: 'nusrat@bracu.ac.bd', skill_name: 'Calculus I & II', proficiency_level: 'Expert', hourly_rate: 300 },
  { user_email: 'nusrat@bracu.ac.bd', skill_name: 'Linear Algebra', proficiency_level: 'Expert', hourly_rate: 300 },
  { user_email: 'nusrat@bracu.ac.bd', skill_name: 'Statistics & Probability', proficiency_level: 'Intermediate', hourly_rate: 280 },
  // Fatima - tutor in ML/Data Science
  { user_email: 'fatima@bracu.ac.bd', skill_name: 'Machine Learning', proficiency_level: 'Expert', hourly_rate: 500 },
  { user_email: 'fatima@bracu.ac.bd', skill_name: 'Python Programming', proficiency_level: 'Expert', hourly_rate: 400 },
  { user_email: 'fatima@bracu.ac.bd', skill_name: 'Statistics & Probability', proficiency_level: 'Expert', hourly_rate: 350 },
  // Sadia - student learning
  { user_email: 'sadia@bracu.ac.bd', skill_name: 'Algorithms & Data Structures', proficiency_level: 'Beginner', hourly_rate: 0 },
  { user_email: 'sadia@bracu.ac.bd', skill_name: 'Calculus I & II', proficiency_level: 'Beginner', hourly_rate: 0 },
  // Imran - student learning
  { user_email: 'imran@bracu.ac.bd', skill_name: 'Object-Oriented Programming', proficiency_level: 'Beginner', hourly_rate: 0 },
  { user_email: 'imran@bracu.ac.bd', skill_name: 'Machine Learning', proficiency_level: 'Beginner', hourly_rate: 0 },
  { user_email: 'imran@bracu.ac.bd', skill_name: 'Database Management Systems', proficiency_level: 'Beginner', hourly_rate: 0 }
];

const posts = [
  {
    author_email: 'sadia@bracu.ac.bd',
    category: 'Algorithms & DS',
    course_code: 'CSE 221',
    title: 'Dynamic Programming memoization table segmentation fault in Bellman-Ford',
    description: 'Need quick help tracing out array boundary indices and memo lookup in bottom-up state formulation. My recursion-to-tabulation conversion keeps hitting segfault on the inner loop.',
    delivery_format: 'live_call',
    bounty: 350,
    deadline: 'Today at 10:00 PM',
    is_urgent: 1,
    status: 'active'
  },
  {
    author_email: 'imran@bracu.ac.bd',
    category: 'Object-Oriented',
    course_code: 'CSE 111',
    title: 'Polymorphism and Abstract Class hierarchy debug',
    description: 'Debugging virtual method dispatch and inheritance structure in Java. My abstract class implementation is not behaving as expected with method overriding.',
    delivery_format: 'annotated_pdf',
    bounty: 300,
    deadline: 'Tomorrow at 2:00 PM',
    is_urgent: 0,
    status: 'active'
  },
  {
    author_email: 'sadia@bracu.ac.bd',
    category: 'Calculus & Math',
    course_code: 'MTH 201',
    title: 'Integration by partial fractions — complex rational functions',
    description: 'Struggling with decomposing higher-order rational functions into partial fractions. Need step-by-step breakdown for exam prep.',
    delivery_format: 'video_walkthrough',
    bounty: 250,
    deadline: 'This Friday',
    is_urgent: 0,
    status: 'active'
  },
  {
    author_email: 'imran@bracu.ac.bd',
    category: 'Physics & Lab',
    course_code: 'PHY 102',
    title: 'Projectile motion with air resistance — numerical method approach',
    description: 'Need help implementing Euler method for projectile motion simulation with quadratic drag. My Python code diverges for high initial velocities.',
    delivery_format: 'live_call',
    bounty: 400,
    deadline: 'Today at 8:00 PM',
    is_urgent: 1,
    status: 'active'
  },
  {
    author_email: 'sadia@bracu.ac.bd',
    category: 'System Architecture',
    course_code: 'CSE 331',
    title: 'Pipeline hazard detection and forwarding unit design',
    description: 'Designing the forwarding unit for a 5-stage MIPS pipeline. Need help with data hazard detection logic and control hazard resolution.',
    delivery_format: 'annotated_pdf',
    bounty: 450,
    deadline: 'Wednesday',
    is_urgent: 0,
    status: 'active'
  },
  {
    author_email: 'imran@bracu.ac.bd',
    category: 'Circuits & EEE',
    course_code: 'EEE 163',
    title: 'Thevenin equivalent circuit for multi-source network',
    description: 'Finding Thevenin equivalent when there are multiple independent sources. My nodal analysis gives wrong Vth value for the bridge circuit.',
    delivery_format: 'live_call',
    bounty: 300,
    deadline: 'Tomorrow at 6:00 PM',
    is_urgent: 0,
    status: 'active'
  }
];

const sessions = [
  {
    tutor_email: 'rafiq@bracu.ac.bd',
    student_email: 'sadia@bracu.ac.bd',
    skill_name: 'Algorithms & Data Structures',
    scheduled_time: '2026-09-14 18:00:00',
    duration_minutes: 30,
    status: 'accepted'
  },
  {
    tutor_email: 'nusrat@bracu.ac.bd',
    student_email: 'sadia@bracu.ac.bd',
    skill_name: 'Calculus I & II',
    scheduled_time: '2026-09-15 16:00:00',
    duration_minutes: 45,
    status: 'pending'
  },
  {
    tutor_email: 'fatima@bracu.ac.bd',
    student_email: 'imran@bracu.ac.bd',
    skill_name: 'Machine Learning',
    scheduled_time: '2026-09-14 20:00:00',
    duration_minutes: 30,
    status: 'completed'
  },
  {
    tutor_email: 'tanvir@bracu.ac.bd',
    student_email: 'imran@bracu.ac.bd',
    skill_name: 'System Architecture',
    scheduled_time: '2026-09-16 14:00:00',
    duration_minutes: 60,
    status: 'pending'
  }
];

// ── Schema (for --reset) ─────────────────────────────────────

const schemaSQL = `
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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Skills (
  skill_id INT AUTO_INCREMENT PRIMARY KEY,
  skill_name VARCHAR(100) NOT NULL,
  category VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS User_Skills (
  user_skill_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  skill_id INT NOT NULL,
  proficiency_level ENUM('Beginner','Intermediate','Expert') DEFAULT 'Intermediate',
  hourly_rate DECIMAL(8,2) DEFAULT 0.00,
  FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (skill_id) REFERENCES Skills(skill_id) ON DELETE CASCADE
);

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
);

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
);
`;

// ── Seed Logic ───────────────────────────────────────────────

async function seed() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const reset = args.includes('--reset');

  console.log('\n🌱 MicroTeach Database Seeder\n');

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  console.log('✅ Connected to database:', process.env.DB_NAME);

  // --reset: drop and recreate tables
  if (reset) {
    console.log('\n⚠️  Resetting database (dropping all tables)...');
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    await conn.query('DROP TABLE IF EXISTS Sessions');
    await conn.query('DROP TABLE IF EXISTS Posts');
    await conn.query('DROP TABLE IF EXISTS User_Skills');
    await conn.query('DROP TABLE IF EXISTS Skills');
    await conn.query('DROP TABLE IF EXISTS Users');
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    await conn.query(schemaSQL);
    console.log('✅ Tables recreated');
  }

  // --force: clear data
  if (force && !reset) {
    console.log('\n⚠️  Clearing existing data...');
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    await conn.query('TRUNCATE TABLE Sessions');
    await conn.query('TRUNCATE TABLE Posts');
    await conn.query('TRUNCATE TABLE User_Skills');
    await conn.query('TRUNCATE TABLE Skills');
    await conn.query('TRUNCATE TABLE Users');
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('✅ Data cleared');
  }

  // Check if data already exists
  const [existing] = await conn.query('SELECT COUNT(*) as count FROM Users');
  if (existing[0].count > 0 && !force && !reset) {
    console.log('\n📋 Database already has', existing[0].count, 'users. Use --force to re-seed or --reset to recreate tables.\n');
    await conn.end();
    return;
  }

  // ── 1. Seed Users ──
  console.log('\n👤 Seeding users...');
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, salt);
  const userIdMap = {}; // email -> user_id

  for (const u of users) {
    const [result] = await conn.query(
      `INSERT INTO Users (full_name, email, password, role, is_verified, department, bio, phone, student_id, wallet_balance)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [u.full_name, u.email, hashedPassword, u.role, u.is_verified, u.department, u.bio, u.phone, u.student_id, u.wallet_balance]
    );
    userIdMap[u.email] = result.insertId;
    console.log('  +', u.full_name, '(' + u.email + ') → ID', result.insertId);
  }

  // ── 2. Seed Skills ──
  console.log('\n📚 Seeding skills...');
  const skillIdMap = {}; // skill_name -> skill_id

  for (const s of skills) {
    const [result] = await conn.query(
      'INSERT INTO Skills (skill_name, category) VALUES (?, ?)',
      [s.skill_name, s.category]
    );
    skillIdMap[s.skill_name] = result.insertId;
    console.log('  +', s.skill_name, '→ ID', result.insertId);
  }

  // ── 3. Seed User_Skills ──
  console.log('\n🔗 Seeding user-skill mappings...');
  for (const us of userSkills) {
    await conn.query(
      'INSERT INTO User_Skills (user_id, skill_id, proficiency_level, hourly_rate) VALUES (?, ?, ?, ?)',
      [userIdMap[us.user_email], skillIdMap[us.skill_name], us.proficiency_level, us.hourly_rate]
    );
    console.log('  +', us.user_email, '→', us.skill_name, '(' + us.proficiency_level + ')');
  }

  // ── 4. Seed Posts ──
  console.log('\n📝 Seeding posts...');
  for (const p of posts) {
    await conn.query(
      `INSERT INTO Posts (user_id, category, course_code, title, description, delivery_format, bounty, deadline, is_urgent, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userIdMap[p.author_email], p.category, p.course_code, p.title, p.description, p.delivery_format, p.bounty, p.deadline, p.is_urgent, p.status]
    );
    console.log('  +', p.title.substring(0, 50) + '...');
  }

  // ── 5. Seed Sessions ──
  console.log('\n📅 Seeding sessions...');
  for (const s of sessions) {
    const [skillRows] = await conn.query('SELECT skill_id FROM Skills WHERE skill_name = ?', [s.skill_name]);
    await conn.query(
      `INSERT INTO Sessions (tutor_id, student_id, skill_id, scheduled_time, duration_minutes, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userIdMap[s.tutor_email], userIdMap[s.student_email], skillRows[0].skill_id, s.scheduled_time, s.duration_minutes, s.status]
    );
    console.log('  +', s.tutor_email, '→', s.student_email, '(' + s.status + ')');
  }

  // ── Summary ──
  const [counts] = await conn.query(`
    SELECT
      (SELECT COUNT(*) FROM Users) as users,
      (SELECT COUNT(*) FROM Skills) as skills,
      (SELECT COUNT(*) FROM User_Skills) as user_skills,
      (SELECT COUNT(*) FROM Posts) as posts,
      (SELECT COUNT(*) FROM Sessions) as sessions
  `);
  const c = counts[0];

  console.log('\n' + '═'.repeat(50));
  console.log('✅ Seed complete!');
  console.log('═'.repeat(50));
  console.log(`   Users:       ${c.users}`);
  console.log(`   Skills:      ${c.skills}`);
  console.log(`   User-Skills: ${c.user_skills}`);
  console.log(`   Posts:       ${c.posts}`);
  console.log(`   Sessions:    ${c.sessions}`);
  console.log('═'.repeat(50));
  console.log('\n🔑 All users login with password: ' + DEFAULT_PASSWORD);
  console.log('   Example: rafiq@bracu.ac.bd / password123\n');

  await conn.end();
}

seed().catch(err => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
