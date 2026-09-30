-- ============================================================
-- MicroTeach Platform — Supabase (PostgreSQL) Production Schema & Seed
-- ============================================================
-- Instructions:
-- 1. Open your Supabase Dashboard: https://supabase.com/dashboard
-- 2. Select your Project -> Click on 'SQL Editor' in the left menu
-- 3. Click 'New query', paste this ENTIRE script, and click 'RUN'.
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Clean drop of any previous tables (eliminates case-sensitive name conflicts from earlier attempts)
DROP TABLE IF EXISTS "Messages", messages CASCADE;
DROP TABLE IF EXISTS "Conversation_Members", conversation_members CASCADE;
DROP TABLE IF EXISTS "Conversations", conversations CASCADE;
DROP TABLE IF EXISTS "Reviews", reviews CASCADE;
DROP TABLE IF EXISTS "Transactions", transactions CASCADE;
DROP TABLE IF EXISTS "Post_Applications", post_applications CASCADE;
DROP TABLE IF EXISTS "Reports", reports CASCADE;
DROP TABLE IF EXISTS "Teacher_Application_Documents", teacher_application_documents CASCADE;
DROP TABLE IF EXISTS "Teacher_Applications", teacher_applications CASCADE;
DROP TABLE IF EXISTS "Sessions", sessions CASCADE;
DROP TABLE IF EXISTS "Posts", posts CASCADE;
DROP TABLE IF EXISTS "User_Skills", user_skills CASCADE;
DROP TABLE IF EXISTS "Skills", skills CASCADE;
DROP TABLE IF EXISTS "Transaction_Disputes", transaction_disputes CASCADE;
DROP TABLE IF EXISTS "Master_Transaction_Types", master_transaction_types CASCADE;
DROP TABLE IF EXISTS "Users", users CASCADE;

-- 1. Users
CREATE TABLE IF NOT EXISTS Users (
  user_id SERIAL PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'student' CHECK (role IN ('student', 'tutor', 'both')),
  is_verified SMALLINT DEFAULT 0,
  department VARCHAR(100),
  bio TEXT,
  phone VARCHAR(20),
  student_id VARCHAR(50),
  wallet_balance DECIMAL(10,2) DEFAULT 0.00,
  is_admin SMALLINT DEFAULT 0,
  avatar_color VARCHAR(7),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Skills
CREATE TABLE IF NOT EXISTS Skills (
  skill_id SERIAL PRIMARY KEY,
  skill_name VARCHAR(100) NOT NULL,
  category VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. User_Skills
CREATE TABLE IF NOT EXISTS User_Skills (
  user_skill_id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES Users(user_id) ON DELETE CASCADE,
  skill_id INT NOT NULL REFERENCES Skills(skill_id) ON DELETE CASCADE,
  proficiency_level VARCHAR(20) DEFAULT 'Intermediate',
  hourly_rate DECIMAL(8,2) DEFAULT 0.00
);

-- 4. Posts
CREATE TABLE IF NOT EXISTS Posts (
  post_id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES Users(user_id) ON DELETE CASCADE,
  category VARCHAR(100) NOT NULL,
  course_code VARCHAR(50) NOT NULL,
  title VARCHAR(120) NOT NULL,
  description TEXT,
  delivery_format VARCHAR(30) DEFAULT 'live_call',
  bounty DECIMAL(10,2) DEFAULT 0.00,
  deadline VARCHAR(100),
  is_urgent SMALLINT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 5. Sessions
CREATE TABLE IF NOT EXISTS Sessions (
  session_id SERIAL PRIMARY KEY,
  tutor_id INT NOT NULL REFERENCES Users(user_id) ON DELETE CASCADE,
  student_id INT NOT NULL REFERENCES Users(user_id) ON DELETE CASCADE,
  skill_id INT NOT NULL REFERENCES Skills(skill_id) ON DELETE CASCADE,
  scheduled_time TIMESTAMPTZ NOT NULL,
  duration_minutes INT DEFAULT 60,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 6. Teacher_Applications
CREATE TABLE IF NOT EXISTS Teacher_Applications (
  application_id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES Users(user_id) ON DELETE CASCADE,
  student_id VARCHAR(50),
  reason TEXT,
  expertise TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  reviewed_by INT REFERENCES Users(user_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMPTZ NULL
);

-- 7. Teacher_Application_Documents
CREATE TABLE IF NOT EXISTS Teacher_Application_Documents (
  document_id SERIAL PRIMARY KEY,
  application_id INT NOT NULL REFERENCES Teacher_Applications(application_id) ON DELETE CASCADE,
  document_type VARCHAR(50) NOT NULL,
  file_path VARCHAR(512) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size INT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 8. Reports
CREATE TABLE IF NOT EXISTS Reports (
  report_id SERIAL PRIMARY KEY,
  post_id INT NOT NULL REFERENCES Posts(post_id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES Users(user_id) ON DELETE CASCADE,
  reason VARCHAR(50) NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  admin_notes TEXT,
  action_taken VARCHAR(50),
  reviewed_at TIMESTAMPTZ,
  reviewed_by INT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 9. Post_Applications
CREATE TABLE IF NOT EXISTS Post_Applications (
  application_id SERIAL PRIMARY KEY,
  post_id INT NOT NULL REFERENCES Posts(post_id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES Users(user_id) ON DELETE CASCADE,
  message TEXT,
  status VARCHAR(30) DEFAULT 'pending',
  completion_requested_by INT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (post_id, user_id)
);

-- 10. Transactions
CREATE TABLE IF NOT EXISTS Transactions (
  transaction_id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES Users(user_id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  balance_after DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  reference_id INT NULL,
  description VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 11. Reviews
CREATE TABLE IF NOT EXISTS Reviews (
  review_id SERIAL PRIMARY KEY,
  reviewer_id INT NOT NULL REFERENCES Users(user_id) ON DELETE CASCADE,
  reviewee_id INT NOT NULL REFERENCES Users(user_id) ON DELETE CASCADE,
  post_id INT NOT NULL REFERENCES Posts(post_id) ON DELETE CASCADE,
  rating DECIMAL(2,1) NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (reviewer_id, post_id)
);

-- 12. Conversations
CREATE TABLE IF NOT EXISTS Conversations (
  conversation_id SERIAL PRIMARY KEY,
  post_id INT NULL REFERENCES Posts(post_id) ON DELETE SET NULL,
  last_message_preview VARCHAR(255) DEFAULT '',
  last_message_at TIMESTAMPTZ NULL DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 13. Conversation_Members
CREATE TABLE IF NOT EXISTS Conversation_Members (
  conversation_id INT NOT NULL REFERENCES Conversations(conversation_id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES Users(user_id) ON DELETE CASCADE,
  last_read_seq INT NOT NULL DEFAULT 0,
  last_delivered_seq INT NOT NULL DEFAULT 0,
  muted SMALLINT NOT NULL DEFAULT 0,
  PRIMARY KEY (conversation_id, user_id)
);

-- 14. Messages
CREATE TABLE IF NOT EXISTS Messages (
  conversation_id INT NOT NULL REFERENCES Conversations(conversation_id) ON DELETE CASCADE,
  seq INT NOT NULL,
  sender_id INT NOT NULL REFERENCES Users(user_id) ON DELETE CASCADE,
  kind VARCHAR(30) NOT NULL DEFAULT 'text',
  body TEXT NOT NULL,
  client_msg_id VARCHAR(64) NULL,
  file_path VARCHAR(512) NULL,
  file_type VARCHAR(50) NULL,
  file_name VARCHAR(255) NULL,
  file_size INT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (conversation_id, seq)
);

-- 15. Transaction_Disputes
CREATE TABLE IF NOT EXISTS Transaction_Disputes (
  dispute_id SERIAL PRIMARY KEY,
  post_id INT NOT NULL REFERENCES Posts(post_id) ON DELETE CASCADE,
  application_id INT NULL,
  reporter_id INT NOT NULL REFERENCES Users(user_id) ON DELETE CASCADE,
  respondent_id INT NULL,
  reporter_role VARCHAR(20) NOT NULL,
  dispute_type VARCHAR(30) NOT NULL,
  reason VARCHAR(150) NOT NULL,
  split_percentage INT DEFAULT 50,
  proposed_refund_amount DECIMAL(10,2) DEFAULT 0.00,
  proposed_payout_amount DECIMAL(10,2) DEFAULT 0.00,
  description TEXT NOT NULL,
  evidence_url VARCHAR(512) NULL,
  status VARCHAR(30) DEFAULT 'pending',
  resolution_type VARCHAR(30) NULL,
  resolution_notes TEXT NULL,
  resolved_by INT NULL,
  resolved_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 16. Master_Transaction_Types
CREATE TABLE IF NOT EXISTS Master_Transaction_Types (
  type_code VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  direction VARCHAR(20) NOT NULL,
  category VARCHAR(50) NOT NULL,
  accounting_treatment VARCHAR(100) NOT NULL,
  is_disputable BOOLEAN DEFAULT FALSE,
  is_reversible BOOLEAN DEFAULT FALSE,
  trigger_method VARCHAR(50) NOT NULL,
  min_amount DECIMAL(10,2) DEFAULT 0.00,
  max_amount DECIMAL(10,2) DEFAULT 50000.00,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- SEED DATA
-- ============================================================

-- Users
INSERT INTO Users (user_id, full_name, email, password, role, is_verified, department, bio, phone, student_id, wallet_balance, is_admin, avatar_color) VALUES (1, 'Rafiqul Islam', 'rafiq@bracu.ac.bd', '$2b$10$0jlcWG8J71iZonY9Rif27eq0oeR089Wq6teaVvmA3A31XpkC0DxF2', 'both', 1, 'Computer Science & Engineering', 'CS & Data Structures tutor. Undergraduate TA for CSE 221. I love breaking down complex algorithms into simple steps.', '+880 1712345678', '21201489', 2350.00, 0, '#c9854f') ON CONFLICT (user_id) DO NOTHING;
INSERT INTO Users (user_id, full_name, email, password, role, is_verified, department, bio, phone, student_id, wallet_balance, is_admin, avatar_color) VALUES (2, 'Sadia Rahman', 'sadia@bracu.ac.bd', '$2b$10$0jlcWG8J71iZonY9Rif27eq0oeR089Wq6teaVvmA3A31XpkC0DxF2', 'both', 1, 'Computer Science & Engineering', '3rd year CS student. Struggling with algorithms and calculus. Looking for peer help during midterm sprint.', '+880 1834567890', '22101156', 1110.00, 0, '#3d7a57') ON CONFLICT (user_id) DO NOTHING;
INSERT INTO Users (user_id, full_name, email, password, role, is_verified, department, bio, phone, student_id, wallet_balance, is_admin, avatar_color) VALUES (3, 'Tanvir Hossain', 'tanvir@bracu.ac.bd', '$2b$10$0jlcWG8J71iZonY9Rif27eq0oeR089Wq6teaVvmA3A31XpkC0DxF2', 'tutor', 1, 'Electrical & Electronic Engineering', 'EEE tutor specializing in circuits, signal processing, and system architecture. 4.9 star rating.', '+880 1956789012', '20301782', 4100.00, 0, '#6ba578') ON CONFLICT (user_id) DO NOTHING;
INSERT INTO Users (user_id, full_name, email, password, role, is_verified, department, bio, phone, student_id, wallet_balance, is_admin, avatar_color) VALUES (4, 'Nusrat Jahan', 'nusrat@bracu.ac.bd', '$2b$10$0jlcWG8J71iZonY9Rif27eq0oeR089Wq6teaVvmA3A31XpkC0DxF2', 'both', 0, 'Mathematics', 'Math tutor. Calculus, linear algebra, and statistics. Passionate about making math accessible.', '+880 1678901234', '21101345', 1200.00, 0, '#3d7a57') ON CONFLICT (user_id) DO NOTHING;
INSERT INTO Users (user_id, full_name, email, password, role, is_verified, department, bio, phone, student_id, wallet_balance, is_admin, avatar_color) VALUES (5, 'Imran Sheikh', 'imran@bracu.ac.bd', '$2b$10$0jlcWG8J71iZonY9Rif27eq0oeR089Wq6teaVvmA3A31XpkC0DxF2', 'student', 0, 'Software Engineering', 'Software engineering student. Need help with OOP, databases, and machine learning concepts.', '+880 1790123456', '22201678', 840.00, 0, '#3d7a57') ON CONFLICT (user_id) DO NOTHING;
INSERT INTO Users (user_id, full_name, email, password, role, is_verified, department, bio, phone, student_id, wallet_balance, is_admin, avatar_color) VALUES (6, 'Fatima Akter', 'fatima@bracu.ac.bd', '$2b$10$0jlcWG8J71iZonY9Rif27eq0oeR089Wq6teaVvmA3A31XpkC0DxF2', 'tutor', 1, 'Data Science & AI', 'ML and data science tutor. Currently working on neural network research. Happy to help with Python, TensorFlow, and statistical modeling.', '+880 1812345678', '20101923', 3750.00, 0, '#86ba90') ON CONFLICT (user_id) DO NOTHING;
INSERT INTO Users (user_id, full_name, email, password, role, is_verified, department, bio, phone, student_id, wallet_balance, is_admin, avatar_color) VALUES (7, 'Salman Admin', 'salman@gmail.com', '$2b$10$0jlcWG8J71iZonY9Rif27eq0oeR089Wq6teaVvmA3A31XpkC0DxF2', 'both', 1, 'Computer Science & Engineering', 'Platform administrator.', '+880 1999999999', 'ADMIN001', 350.00, 1, '#1a1a2e') ON CONFLICT (user_id) DO NOTHING;
INSERT INTO Users (user_id, full_name, email, password, role, is_verified, department, bio, phone, student_id, wallet_balance, is_admin, avatar_color) VALUES (8, 'Test Student', 'test@student.com', '$2b$10$0jlcWG8J71iZonY9Rif27eq0oeR089Wq6teaVvmA3A31XpkC0DxF2', 'student', 1, 'Computer Science & Engineering', 'Testing the platform. 2nd year CS student.', '+880 1888888888', 'TEST001', 200.00, 0, '#6ba578') ON CONFLICT (user_id) DO NOTHING;
INSERT INTO Users (user_id, full_name, email, password, role, is_verified, department, bio, phone, student_id, wallet_balance, is_admin, avatar_color) VALUES (10, 'Jisan', 'jisan@gmail.com', '$2b$10$murjusJJWxmc9sfqVOPzcuk5fjIJh8u3xq1LrpMC11NgmsAe/r9xG', 'both', 1, 'cs', NULL, NULL, NULL, 0.00, 0, '#c9854f') ON CONFLICT (user_id) DO NOTHING;
INSERT INTO Users (user_id, full_name, email, password, role, is_verified, department, bio, phone, student_id, wallet_balance, is_admin, avatar_color) VALUES (11, 'sharif', 'sharf@gmail.com', '$2b$10$sH26qcTBHMGmkw65XNxIY.xGO8HRer5dDtfI2B6unlPTz9kPQnYUy', 'student', 0, 'cs', NULL, NULL, NULL, 0.00, 0, '#dfa06e') ON CONFLICT (user_id) DO NOTHING;
INSERT INTO Users (user_id, full_name, email, password, role, is_verified, department, bio, phone, student_id, wallet_balance, is_admin, avatar_color) VALUES (12, 'joy', 'joy@gmail.com', '$2b$10$KLKrWihT6hZuuPqSy5eFaeexHTuMpYeu88wtJJXHUuH/StknjO35e', 'both', 1, 'cs', NULL, NULL, NULL, 9999600.00, 0, '#f0ea8f') ON CONFLICT (user_id) DO NOTHING;
INSERT INTO Users (user_id, full_name, email, password, role, is_verified, department, bio, phone, student_id, wallet_balance, is_admin, avatar_color) VALUES (13, 'yousuf', 'yousuf@gmail.com', '$2b$10$WMUhDFUVhmYxhAx6ieHmA.HhitS4sM9p/2ushMGtvK6gLRBJViEzO', 'both', 1, 'cs', NULL, NULL, NULL, 1450.00, 0, '#6ba578') ON CONFLICT (user_id) DO NOTHING;
INSERT INTO Users (user_id, full_name, email, password, role, is_verified, department, bio, phone, student_id, wallet_balance, is_admin, avatar_color) VALUES (15, 'Maria', 'maria@gmail.com', '$2b$10$3aBu77HSyCrsG3VYvpgfkeiuBxndJg9KY2OU.ucE4iwNnPqf8trgW', 'both', 1, 'ee', NULL, NULL, NULL, 650.00, 0, '#f0ea8f') ON CONFLICT (user_id) DO NOTHING;
SELECT setval(pg_get_serial_sequence('users', 'user_id'), COALESCE((SELECT MAX(user_id) FROM Users), 1));

-- Skills
INSERT INTO Skills (skill_id, skill_name, category) VALUES (1, 'Algorithms & Data Structures', 'Computer Science') ON CONFLICT (skill_id) DO NOTHING;
INSERT INTO Skills (skill_id, skill_name, category) VALUES (2, 'Object-Oriented Programming', 'Computer Science') ON CONFLICT (skill_id) DO NOTHING;
INSERT INTO Skills (skill_id, skill_name, category) VALUES (3, 'Database Management Systems', 'Computer Science') ON CONFLICT (skill_id) DO NOTHING;
INSERT INTO Skills (skill_id, skill_name, category) VALUES (4, 'Machine Learning', 'Data Science') ON CONFLICT (skill_id) DO NOTHING;
INSERT INTO Skills (skill_id, skill_name, category) VALUES (5, 'Calculus I & II', 'Mathematics') ON CONFLICT (skill_id) DO NOTHING;
INSERT INTO Skills (skill_id, skill_name, category) VALUES (6, 'Linear Algebra', 'Mathematics') ON CONFLICT (skill_id) DO NOTHING;
INSERT INTO Skills (skill_id, skill_name, category) VALUES (7, 'Physics I & II', 'Science') ON CONFLICT (skill_id) DO NOTHING;
INSERT INTO Skills (skill_id, skill_name, category) VALUES (8, 'Circuit Analysis', 'Engineering') ON CONFLICT (skill_id) DO NOTHING;
INSERT INTO Skills (skill_id, skill_name, category) VALUES (9, 'System Architecture', 'Engineering') ON CONFLICT (skill_id) DO NOTHING;
INSERT INTO Skills (skill_id, skill_name, category) VALUES (10, 'Statistics & Probability', 'Mathematics') ON CONFLICT (skill_id) DO NOTHING;
INSERT INTO Skills (skill_id, skill_name, category) VALUES (11, 'Python Programming', 'Computer Science') ON CONFLICT (skill_id) DO NOTHING;
INSERT INTO Skills (skill_id, skill_name, category) VALUES (12, 'Java Programming', 'Computer Science') ON CONFLICT (skill_id) DO NOTHING;
SELECT setval(pg_get_serial_sequence('skills', 'skill_id'), COALESCE((SELECT MAX(skill_id) FROM Skills), 1));

-- Posts
INSERT INTO Posts (post_id, user_id, category, course_code, title, description, delivery_format, bounty, deadline, is_urgent, status) VALUES (1, 2, 'Algorithms & DS', 'CSE 221', 'Dynamic Programming memoization table segmentation fault in Bellman-Ford', 'Need quick help tracing out array boundary indices and memo lookup in bottom-up state formulation. My recursion-to-tabulation conversion keeps hitting segfault on the inner loop.', 'live_call', 350.00, 'Today at 10:00 PM', 1, 'closed') ON CONFLICT (post_id) DO NOTHING;
INSERT INTO Posts (post_id, user_id, category, course_code, title, description, delivery_format, bounty, deadline, is_urgent, status) VALUES (2, 5, 'Object-Oriented', 'CSE 111', 'Polymorphism and Abstract Class hierarchy debug', 'Debugging virtual method dispatch and inheritance structure in Java. My abstract class implementation is not behaving as expected with method overriding.', 'annotated_pdf', 300.00, 'Tomorrow at 2:00 PM', 0, 'closed') ON CONFLICT (post_id) DO NOTHING;
INSERT INTO Posts (post_id, user_id, category, course_code, title, description, delivery_format, bounty, deadline, is_urgent, status) VALUES (3, 2, 'Calculus & Math', 'MTH 201', 'Integration by partial fractions — complex rational functions', 'Struggling with decomposing higher-order rational functions into partial fractions. Need step-by-step breakdown for exam prep.', 'video_walkthrough', 250.00, 'This Friday', 0, 'completed') ON CONFLICT (post_id) DO NOTHING;
INSERT INTO Posts (post_id, user_id, category, course_code, title, description, delivery_format, bounty, deadline, is_urgent, status) VALUES (4, 5, 'Physics & Lab', 'PHY 102', 'Projectile motion with air resistance — numerical method approach', 'Need help implementing Euler method for projectile motion simulation with quadratic drag. My Python code diverges for high initial velocities.', 'live_call', 400.00, 'Today at 8:00 PM', 1, 'closed') ON CONFLICT (post_id) DO NOTHING;
INSERT INTO Posts (post_id, user_id, category, course_code, title, description, delivery_format, bounty, deadline, is_urgent, status) VALUES (5, 2, 'System Architecture', 'CSE 331', 'Pipeline hazard detection and forwarding unit design', 'Designing the forwarding unit for a 5-stage MIPS pipeline. Need help with data hazard detection logic and control hazard resolution.', 'annotated_pdf', 450.00, 'Wednesday', 0, 'completed') ON CONFLICT (post_id) DO NOTHING;
INSERT INTO Posts (post_id, user_id, category, course_code, title, description, delivery_format, bounty, deadline, is_urgent, status) VALUES (6, 5, 'Circuits & EEE', 'EEE 163', 'Thevenin equivalent circuit for multi-source network', 'Finding Thevenin equivalent when there are multiple independent sources. My nodal analysis gives wrong Vth value for the bridge circuit.', 'live_call', 300.00, 'Tomorrow at 6:00 PM', 0, 'active') ON CONFLICT (post_id) DO NOTHING;
INSERT INTO Posts (post_id, user_id, category, course_code, title, description, delivery_format, bounty, deadline, is_urgent, status) VALUES (7, 12, 'Algorithms & DS', 'CSE 221 - Algorithms & Data Structures', 'MST', 'abc', 'live_call', 450.00, 'Tomorrow at 10pm', 1, 'completed') ON CONFLICT (post_id) DO NOTHING;
INSERT INTO Posts (post_id, user_id, category, course_code, title, description, delivery_format, bounty, deadline, is_urgent, status) VALUES (8, 7, 'Algorithms & DS', 'Algorighms', 'hello type problem', 'testing the typing spacing and others', 'annotated_pdf', 200.00, '111', 1, 'completed') ON CONFLICT (post_id) DO NOTHING;
INSERT INTO Posts (post_id, user_id, category, course_code, title, description, delivery_format, bounty, deadline, is_urgent, status) VALUES (9, 7, 'Algorithms & DS', 'card testing 2 without urgency', 'test 2', '', 'live_call', 100.00, NULL, 0, 'active') ON CONFLICT (post_id) DO NOTHING;
INSERT INTO Posts (post_id, user_id, category, course_code, title, description, delivery_format, bounty, deadline, is_urgent, status) VALUES (10, 12, 'University Level', '', 'Testing the acceptance pannel', '', 'live_call', 350.00, NULL, 1, 'completed') ON CONFLICT (post_id) DO NOTHING;
INSERT INTO Posts (post_id, user_id, category, course_code, title, description, delivery_format, bounty, deadline, is_urgent, status) VALUES (11, 12, 'SSC Level', '', 'atom ki ', '', 'annotated_pdf', 350.00, '2026-09-29T19:00', 1, 'active') ON CONFLICT (post_id) DO NOTHING;
INSERT INTO Posts (post_id, user_id, category, course_code, title, description, delivery_format, bounty, deadline, is_urgent, status) VALUES (12, 7, 'University Level', '', 'DBMS Normalizartion ', 'Attribute finding ', 'video_walkthrough', 100.00, '2026-10-09T23:59', 1, 'completed') ON CONFLICT (post_id) DO NOTHING;
INSERT INTO Posts (post_id, user_id, category, course_code, title, description, delivery_format, bounty, deadline, is_urgent, status) VALUES (13, 7, 'University Level', '', 'Testing the Approval Button', '', 'live_call', 350.00, NULL, 1, 'completed') ON CONFLICT (post_id) DO NOTHING;
INSERT INTO Posts (post_id, user_id, category, course_code, title, description, delivery_format, bounty, deadline, is_urgent, status) VALUES (14, 7, 'University Level', '', 'High urgency problem ', '', 'live_call', 100.00, NULL, 1, 'active') ON CONFLICT (post_id) DO NOTHING;
INSERT INTO Posts (post_id, user_id, category, course_code, title, description, delivery_format, bounty, deadline, is_urgent, status) VALUES (15, 15, 'HSC Level', '', 'Testing the acceptance button ', '', 'live_call', 350.00, NULL, 1, 'active') ON CONFLICT (post_id) DO NOTHING;
INSERT INTO Posts (post_id, user_id, category, course_code, title, description, delivery_format, bounty, deadline, is_urgent, status) VALUES (16, 15, 'University Level', '', 'Testing the mark complete button ', '', 'live_call', 350.00, NULL, 0, 'completed') ON CONFLICT (post_id) DO NOTHING;
SELECT setval(pg_get_serial_sequence('posts', 'post_id'), COALESCE((SELECT MAX(post_id) FROM Posts), 1));

-- Post Applications
INSERT INTO Post_Applications (application_id, post_id, user_id, message, status, completion_requested_by) VALUES (1, 1, 1, 'I am a TA for CSE 221 and specialize in DP. Can help you debug the memoization table.', 'cancelled', NULL) ON CONFLICT (application_id) DO NOTHING;
INSERT INTO Post_Applications (application_id, post_id, user_id, message, status, completion_requested_by) VALUES (2, 1, 6, 'Experienced with Bellman-Ford and dynamic programming. Happy to walk through the solution.', 'pending', NULL) ON CONFLICT (application_id) DO NOTHING;
INSERT INTO Post_Applications (application_id, post_id, user_id, message, status, completion_requested_by) VALUES (3, 2, 1, 'Java OOP is my forte. Can debug virtual method dispatch issues quickly.', 'pending', NULL) ON CONFLICT (application_id) DO NOTHING;
INSERT INTO Post_Applications (application_id, post_id, user_id, message, status, completion_requested_by) VALUES (4, 3, 4, 'Math tutor specializing in calculus. Can break down partial fractions step by step.', 'pending', NULL) ON CONFLICT (application_id) DO NOTHING;
INSERT INTO Post_Applications (application_id, post_id, user_id, message, status, completion_requested_by) VALUES (5, 6, 3, 'EEE tutor with 4.9 star rating. Circuit analysis is my specialty.', 'pending', NULL) ON CONFLICT (application_id) DO NOTHING;
INSERT INTO Post_Applications (application_id, post_id, user_id, message, status, completion_requested_by) VALUES (6, 4, 6, 'Python and numerical methods expert. Can help with Euler method implementation.', 'accepted', NULL) ON CONFLICT (application_id) DO NOTHING;
INSERT INTO Post_Applications (application_id, post_id, user_id, message, status, completion_requested_by) VALUES (7, 2, 2, '', 'pending', NULL) ON CONFLICT (application_id) DO NOTHING;
INSERT INTO Post_Applications (application_id, post_id, user_id, message, status, completion_requested_by) VALUES (8, 3, 12, '', 'completed', NULL) ON CONFLICT (application_id) DO NOTHING;
INSERT INTO Post_Applications (application_id, post_id, user_id, message, status, completion_requested_by) VALUES (9, 5, 7, 'Hello', 'completed', NULL) ON CONFLICT (application_id) DO NOTHING;
INSERT INTO Post_Applications (application_id, post_id, user_id, message, status, completion_requested_by) VALUES (11, 7, 13, '10 pm perfect time', 'completed', NULL) ON CONFLICT (application_id) DO NOTHING;
INSERT INTO Post_Applications (application_id, post_id, user_id, message, status, completion_requested_by) VALUES (12, 2, 12, '', 'pending', NULL) ON CONFLICT (application_id) DO NOTHING;
INSERT INTO Post_Applications (application_id, post_id, user_id, message, status, completion_requested_by) VALUES (30, 2, 7, '', 'pending', NULL) ON CONFLICT (application_id) DO NOTHING;
INSERT INTO Post_Applications (application_id, post_id, user_id, message, status, completion_requested_by) VALUES (31, 9, 12, 'I can teach you very well so come to me', 'rejected', NULL) ON CONFLICT (application_id) DO NOTHING;
INSERT INTO Post_Applications (application_id, post_id, user_id, message, status, completion_requested_by) VALUES (32, 8, 12, 'I can teach you well come to me', 'completed', NULL) ON CONFLICT (application_id) DO NOTHING;
INSERT INTO Post_Applications (application_id, post_id, user_id, message, status, completion_requested_by) VALUES (33, 10, 7, 'I can teach you well accept me', 'completed', NULL) ON CONFLICT (application_id) DO NOTHING;
INSERT INTO Post_Applications (application_id, post_id, user_id, message, status, completion_requested_by) VALUES (34, 4, 12, '', 'pending', NULL) ON CONFLICT (application_id) DO NOTHING;
INSERT INTO Post_Applications (application_id, post_id, user_id, message, status, completion_requested_by) VALUES (35, 6, 12, '', 'pending', NULL) ON CONFLICT (application_id) DO NOTHING;
INSERT INTO Post_Applications (application_id, post_id, user_id, message, status, completion_requested_by) VALUES (36, 4, 7, '', 'pending', NULL) ON CONFLICT (application_id) DO NOTHING;
INSERT INTO Post_Applications (application_id, post_id, user_id, message, status, completion_requested_by) VALUES (37, 11, 7, '', 'pending', NULL) ON CONFLICT (application_id) DO NOTHING;
INSERT INTO Post_Applications (application_id, post_id, user_id, message, status, completion_requested_by) VALUES (38, 6, 7, '', 'pending', NULL) ON CONFLICT (application_id) DO NOTHING;
INSERT INTO Post_Applications (application_id, post_id, user_id, message, status, completion_requested_by) VALUES (39, 12, 12, 'I know DBMS normalization very well', 'completed', NULL) ON CONFLICT (application_id) DO NOTHING;
INSERT INTO Post_Applications (application_id, post_id, user_id, message, status, completion_requested_by) VALUES (40, 13, 15, '', 'completed', NULL) ON CONFLICT (application_id) DO NOTHING;
INSERT INTO Post_Applications (application_id, post_id, user_id, message, status, completion_requested_by) VALUES (41, 15, 7, '', 'completion_requested', 15) ON CONFLICT (application_id) DO NOTHING;
INSERT INTO Post_Applications (application_id, post_id, user_id, message, status, completion_requested_by) VALUES (42, 16, 7, '', 'completed', NULL) ON CONFLICT (application_id) DO NOTHING;
SELECT setval(pg_get_serial_sequence('post_applications', 'application_id'), COALESCE((SELECT MAX(application_id) FROM Post_Applications), 1));

-- Teacher Applications
INSERT INTO Teacher_Applications (application_id, user_id, student_id, reason, expertise, status, reviewed_by, reviewed_at) VALUES (2, 5, NULL, 'Strong background in OOP and databases. Want to tutor junior students.', 'Object-Oriented Programming, Database Management Systems', 'rejected', 7, '2026-09-26 10:41:14+06:00') ON CONFLICT (application_id) DO NOTHING;
INSERT INTO Teacher_Applications (application_id, user_id, student_id, reason, expertise, status, reviewed_by, reviewed_at) VALUES (6, 2, NULL, 'ok kk dddddddddddddddddddddddddddick', 'okjdeofhoej foeu23ofijoeifhjoehfoejof 2p3nr032rfjfoinfoin2p', 'approved', 7, '2026-09-26 12:03:18+06:00') ON CONFLICT (application_id) DO NOTHING;
INSERT INTO Teacher_Applications (application_id, user_id, student_id, reason, expertise, status, reviewed_by, reviewed_at) VALUES (7, 10, NULL, 'ami onekkkkkkkk moivaeige3oighe3hg9fiehgihewoiuhgeoiuhgfoeihgfi', 'efegegewgwgvw', 'approved', 7, '2026-09-26 13:57:07+06:00') ON CONFLICT (application_id) DO NOTHING;
INSERT INTO Teacher_Applications (application_id, user_id, student_id, reason, expertise, status, reviewed_by, reviewed_at) VALUES (8, 12, NULL, 'abcajksdgashx k` kjfh klhs zlkj cj', '', 'approved', 7, '2026-09-26 14:08:31+06:00') ON CONFLICT (application_id) DO NOTHING;
INSERT INTO Teacher_Applications (application_id, user_id, student_id, reason, expertise, status, reviewed_by, reviewed_at) VALUES (9, 13, NULL, 'I wanna apply for teacher jjjjjjjjjjj', '', 'approved', 7, '2026-09-26 15:28:44+06:00') ON CONFLICT (application_id) DO NOTHING;
INSERT INTO Teacher_Applications (application_id, user_id, student_id, reason, expertise, status, reviewed_by, reviewed_at) VALUES (10, 15, NULL, 'ami porate chai fewfhfhoewiqhfeoiqfhq', 'cse', 'approved', 7, '2026-09-29 15:10:14+06:00') ON CONFLICT (application_id) DO NOTHING;
SELECT setval(pg_get_serial_sequence('teacher_applications', 'application_id'), COALESCE((SELECT MAX(application_id) FROM Teacher_Applications), 1));

-- Reports
INSERT INTO Reports (report_id, post_id, user_id, reason, description, status, admin_notes, action_taken) VALUES (1, 1, 5, 'spam', NULL, 'pending', NULL, NULL) ON CONFLICT (report_id) DO NOTHING;
INSERT INTO Reports (report_id, post_id, user_id, reason, description, status, admin_notes, action_taken) VALUES (2, 2, 8, 'inappropriate', NULL, 'pending', NULL, NULL) ON CONFLICT (report_id) DO NOTHING;
INSERT INTO Reports (report_id, post_id, user_id, reason, description, status, admin_notes, action_taken) VALUES (3, 3, 2, 'academic_dishonesty', NULL, 'reviewed', NULL, NULL) ON CONFLICT (report_id) DO NOTHING;
INSERT INTO Reports (report_id, post_id, user_id, reason, description, status, admin_notes, action_taken) VALUES (4, 6, 5, 'fraud', NULL, 'pending', NULL, NULL) ON CONFLICT (report_id) DO NOTHING;
INSERT INTO Reports (report_id, post_id, user_id, reason, description, status, admin_notes, action_taken) VALUES (5, 2, 12, 'spam', NULL, 'pending', 'Test admin review note', 'reviewed') ON CONFLICT (report_id) DO NOTHING;
SELECT setval(pg_get_serial_sequence('reports', 'report_id'), COALESCE((SELECT MAX(report_id) FROM Reports), 1));

-- Transactions
INSERT INTO Transactions (transaction_id, user_id, type, amount, balance_after, reference_id, description) VALUES (1, 2, 'top_up', 100.00, 600.00, NULL, 'Topped up ৳100') ON CONFLICT (transaction_id) DO NOTHING;
INSERT INTO Transactions (transaction_id, user_id, type, amount, balance_after, reference_id, description) VALUES (2, 2, 'refund', 350.00, 950.00, 1, 'Escrow Arbitrated: 100% refund for post #1 (Dynamic Programming memoization table segmentation fault in Bellman-Ford)') ON CONFLICT (transaction_id) DO NOTHING;
INSERT INTO Transactions (transaction_id, user_id, type, amount, balance_after, reference_id, description) VALUES (3, 12, 'top_up', 10000000.00, 10000000.00, NULL, 'Topped up ৳10000000') ON CONFLICT (transaction_id) DO NOTHING;
INSERT INTO Transactions (transaction_id, user_id, type, amount, balance_after, reference_id, description) VALUES (4, 12, 'bounty_held', 450.00, 9999550.00, 7, 'Held ৳450 bounty for post: MST') ON CONFLICT (transaction_id) DO NOTHING;
INSERT INTO Transactions (transaction_id, user_id, type, amount, balance_after, reference_id, description) VALUES (5, 13, 'top_up', 1000.00, 1000.00, NULL, 'Topped up ৳1000') ON CONFLICT (transaction_id) DO NOTHING;
INSERT INTO Transactions (transaction_id, user_id, type, amount, balance_after, reference_id, description) VALUES (6, 13, 'bounty_received', 450.00, 1450.00, 7, 'Received ৳450 bounty for post #7') ON CONFLICT (transaction_id) DO NOTHING;
INSERT INTO Transactions (transaction_id, user_id, type, amount, balance_after, reference_id, description) VALUES (7, 12, 'top_up', 100.00, 9999650.00, NULL, 'Topped up ৳100') ON CONFLICT (transaction_id) DO NOTHING;
INSERT INTO Transactions (transaction_id, user_id, type, amount, balance_after, reference_id, description) VALUES (8, 12, 'top_up', 350.00, 10000000.00, NULL, 'Topped up ৳350') ON CONFLICT (transaction_id) DO NOTHING;
INSERT INTO Transactions (transaction_id, user_id, type, amount, balance_after, reference_id, description) VALUES (9, 7, 'top_up', 500.00, 500.00, NULL, 'Topped up ৳500') ON CONFLICT (transaction_id) DO NOTHING;
INSERT INTO Transactions (transaction_id, user_id, type, amount, balance_after, reference_id, description) VALUES (10, 7, 'bounty_held', 200.00, 300.00, 8, 'Held ৳200 bounty for post: hello type problem') ON CONFLICT (transaction_id) DO NOTHING;
INSERT INTO Transactions (transaction_id, user_id, type, amount, balance_after, reference_id, description) VALUES (11, 7, 'bounty_held', 100.00, 200.00, 9, 'Held ৳100 bounty for post: test 2') ON CONFLICT (transaction_id) DO NOTHING;
INSERT INTO Transactions (transaction_id, user_id, type, amount, balance_after, reference_id, description) VALUES (12, 12, 'bounty_held', 350.00, 9999650.00, 10, 'Held ৳350 bounty for post: Testing the acceptance pannel') ON CONFLICT (transaction_id) DO NOTHING;
INSERT INTO Transactions (transaction_id, user_id, type, amount, balance_after, reference_id, description) VALUES (13, 12, 'bounty_received', 200.00, 9999850.00, 8, 'Received ৳200 bounty for post #8') ON CONFLICT (transaction_id) DO NOTHING;
INSERT INTO Transactions (transaction_id, user_id, type, amount, balance_after, reference_id, description) VALUES (14, 7, 'bounty_received', 350.00, 550.00, 10, 'Received ৳350 bounty for post #10') ON CONFLICT (transaction_id) DO NOTHING;
INSERT INTO Transactions (transaction_id, user_id, type, amount, balance_after, reference_id, description) VALUES (15, 12, 'bounty_held', 350.00, 9999500.00, 11, 'Held ৳350 bounty for post: atom ki ') ON CONFLICT (transaction_id) DO NOTHING;
INSERT INTO Transactions (transaction_id, user_id, type, amount, balance_after, reference_id, description) VALUES (16, 7, 'bounty_held', 100.00, 450.00, 12, 'Held ৳100 bounty for post: DBMS Normalizartion ') ON CONFLICT (transaction_id) DO NOTHING;
INSERT INTO Transactions (transaction_id, user_id, type, amount, balance_after, reference_id, description) VALUES (17, 12, 'bounty_received', 100.00, 9999600.00, 12, 'Received ৳100 bounty for post #12') ON CONFLICT (transaction_id) DO NOTHING;
INSERT INTO Transactions (transaction_id, user_id, type, amount, balance_after, reference_id, description) VALUES (18, 15, 'top_up', 1000.00, 1000.00, NULL, 'Topped up ৳1000') ON CONFLICT (transaction_id) DO NOTHING;
INSERT INTO Transactions (transaction_id, user_id, type, amount, balance_after, reference_id, description) VALUES (19, 5, 'refund', 300.00, 600.00, 2, 'Escrow Arbitrated: 100% refund for post #2 (Polymorphism and Abstract Class hierarchy debug)') ON CONFLICT (transaction_id) DO NOTHING;
INSERT INTO Transactions (transaction_id, user_id, type, amount, balance_after, reference_id, description) VALUES (20, 5, 'refund', 240.00, 840.00, 4, 'Escrow Arbitrated: 60% split refund for post #4') ON CONFLICT (transaction_id) DO NOTHING;
INSERT INTO Transactions (transaction_id, user_id, type, amount, balance_after, reference_id, description) VALUES (21, 2, 'bounty_received', 160.00, 1110.00, 4, 'Escrow Arbitrated: 40% split payout for post #4') ON CONFLICT (transaction_id) DO NOTHING;
INSERT INTO Transactions (transaction_id, user_id, type, amount, balance_after, reference_id, description) VALUES (22, 7, 'bounty_held', 350.00, 100.00, 13, 'Held ৳350 bounty for post: Testing the Approval Button') ON CONFLICT (transaction_id) DO NOTHING;
INSERT INTO Transactions (transaction_id, user_id, type, amount, balance_after, reference_id, description) VALUES (23, 7, 'bounty_held', 100.00, 0.00, 14, 'Held ৳100 bounty for post: High urgency problem ') ON CONFLICT (transaction_id) DO NOTHING;
INSERT INTO Transactions (transaction_id, user_id, type, amount, balance_after, reference_id, description) VALUES (24, 15, 'bounty_received', 350.00, 1350.00, 13, 'Received ৳350 bounty for post #13') ON CONFLICT (transaction_id) DO NOTHING;
INSERT INTO Transactions (transaction_id, user_id, type, amount, balance_after, reference_id, description) VALUES (25, 15, 'bounty_held', 350.00, 1000.00, 15, 'Held ৳350 bounty for post: Testing the acceptance button ') ON CONFLICT (transaction_id) DO NOTHING;
INSERT INTO Transactions (transaction_id, user_id, type, amount, balance_after, reference_id, description) VALUES (26, 15, 'bounty_held', 350.00, 650.00, 16, 'Held ৳350 bounty for post: Testing the mark complete button ') ON CONFLICT (transaction_id) DO NOTHING;
INSERT INTO Transactions (transaction_id, user_id, type, amount, balance_after, reference_id, description) VALUES (27, 7, 'bounty_received', 350.00, 350.00, 16, 'Received ৳350 bounty for post #16') ON CONFLICT (transaction_id) DO NOTHING;
SELECT setval(pg_get_serial_sequence('transactions', 'transaction_id'), COALESCE((SELECT MAX(transaction_id) FROM Transactions), 1));

-- Master Transaction Types
INSERT INTO Master_Transaction_Types (type_code, name, direction, category, accounting_treatment, is_disputable, is_reversible, trigger_method, min_amount, max_amount, description, is_active) VALUES ('admin_adjustment', 'Administrative Ledger Correction', 'neutral', 'Governance & Audit', 'Manual General Ledger Adjustment', FALSE, TRUE, 'Manual (Super Admin Only)', 0.00, 50000.00, 'Audited discretionary credit or debit by Super Admin for ledger reconciliation or disputes.', TRUE) ON CONFLICT (type_code) DO NOTHING;
INSERT INTO Master_Transaction_Types (type_code, name, direction, category, accounting_treatment, is_disputable, is_reversible, trigger_method, min_amount, max_amount, description, is_active) VALUES ('bounty_held', 'Escrow Bounty Reservation', 'escrow_hold', 'Escrow Lifecycle', 'Escrow Liability Reserve', FALSE, TRUE, 'Automated (Post Creation)', 50.00, 10000.00, 'Locked in platform escrow when a student creates a help request with a bounty.', TRUE) ON CONFLICT (type_code) DO NOTHING;
INSERT INTO Master_Transaction_Types (type_code, name, direction, category, accounting_treatment, is_disputable, is_reversible, trigger_method, min_amount, max_amount, description, is_active) VALUES ('bounty_payment', 'Direct Bounty Settlement', 'debit', 'Marketplace Settlement', 'Student Expense Settlement', TRUE, TRUE, 'Automated (Session Completion)', 50.00, 10000.00, 'Direct debit record from poster to tutor wallet when settling peer teaching session.', TRUE) ON CONFLICT (type_code) DO NOTHING;
INSERT INTO Master_Transaction_Types (type_code, name, direction, category, accounting_treatment, is_disputable, is_reversible, trigger_method, min_amount, max_amount, description, is_active) VALUES ('bounty_received', 'Peer Tutor Bounty Payout', 'credit', 'Marketplace Settlement', 'Tutor Earned Revenue', TRUE, TRUE, 'Automated (Session Completion)', 50.00, 10000.00, 'Released from escrow to peer tutor upon mutual lesson completion or dispute settlement.', TRUE) ON CONFLICT (type_code) DO NOTHING;
INSERT INTO Master_Transaction_Types (type_code, name, direction, category, accounting_treatment, is_disputable, is_reversible, trigger_method, min_amount, max_amount, description, is_active) VALUES ('platform_fee', 'Platform Commission Fee', 'debit', 'Institutional Revenue', 'Platform Fee Revenue', FALSE, FALSE, 'Automated (Settlement Engine)', 0.00, 5000.00, 'Micro-commission retained for platform maintenance and escrow operational processing.', FALSE) ON CONFLICT (type_code) DO NOTHING;
INSERT INTO Master_Transaction_Types (type_code, name, direction, category, accounting_treatment, is_disputable, is_reversible, trigger_method, min_amount, max_amount, description, is_active) VALUES ('refund', 'Escrow Bounty Refund', 'credit', 'Dispute & Cancellation', 'Liability Reversal to Student', FALSE, FALSE, 'Automated (Post Close / Dispute)', 0.00, 10000.00, 'Returned to student wallet when a post is closed without completed session or arbitrated.', TRUE) ON CONFLICT (type_code) DO NOTHING;
INSERT INTO Master_Transaction_Types (type_code, name, direction, category, accounting_treatment, is_disputable, is_reversible, trigger_method, min_amount, max_amount, description, is_active) VALUES ('top_up', 'Wallet Deposit / Top-up', 'credit', 'Inflow / Funding', 'Student Wallet Asset', FALSE, FALSE, 'Automated (Payment Gateway)', 50.00, 25000.00, 'Funds loaded into student wallet via mobile financial service (bKash/Nagad) or card.', TRUE) ON CONFLICT (type_code) DO NOTHING;
INSERT INTO Master_Transaction_Types (type_code, name, direction, category, accounting_treatment, is_disputable, is_reversible, trigger_method, min_amount, max_amount, description, is_active) VALUES ('withdrawal', 'Tutor Cashout / Withdrawal', 'debit', 'Outflow / Payout', 'Tutor Asset Withdrawal', FALSE, FALSE, 'Manual / Scheduled Batch', 100.00, 25000.00, 'Peer tutor cashout request from platform wallet to personal bank or mobile wallet.', TRUE) ON CONFLICT (type_code) DO NOTHING;

-- Transaction Disputes
INSERT INTO Transaction_Disputes (dispute_id, post_id, application_id, reporter_id, respondent_id, reporter_role, dispute_type, reason, split_percentage, proposed_refund_amount, proposed_payout_amount, description, status) VALUES (1, 1, 1, 2, 1, 'student', 'split', 'Student missed scheduled session / no-show', 50, 175.00, 175.00, 'jjhiuhuhuhiuihuiuhihiu', 'resolved') ON CONFLICT (dispute_id) DO NOTHING;
INSERT INTO Transaction_Disputes (dispute_id, post_id, application_id, reporter_id, respondent_id, reporter_role, dispute_type, reason, split_percentage, proposed_refund_amount, proposed_payout_amount, description, status) VALUES (2, 7, 11, 13, 12, 'tutor', 'full_refund', 'Tutor missed scheduled session / no-show', 50, 450.00, 0.00, 'hifeoiwofhoeihfoiefohgw2o', 'dismissed') ON CONFLICT (dispute_id) DO NOTHING;
INSERT INTO Transaction_Disputes (dispute_id, post_id, application_id, reporter_id, respondent_id, reporter_role, dispute_type, reason, split_percentage, proposed_refund_amount, proposed_payout_amount, description, status) VALUES (3, 2, NULL, 5, 1, 'student', 'full_refund', 'Tutor missed scheduled session / no-show', 50, 300.00, 0.00, 'The tutor did not show up to our scheduled Discord session and did not respond to messages for over 24 hours.', 'resolved') ON CONFLICT (dispute_id) DO NOTHING;
INSERT INTO Transaction_Disputes (dispute_id, post_id, application_id, reporter_id, respondent_id, reporter_role, dispute_type, reason, split_percentage, proposed_refund_amount, proposed_payout_amount, description, status) VALUES (4, 4, NULL, 5, 2, 'student', 'split', 'Incomplete session or partial delivery', 60, 240.00, 160.00, 'We completed about 35 minutes of the 60 minute session before the tutor had connection issues. We agreed on a 60-40 split.', 'resolved') ON CONFLICT (dispute_id) DO NOTHING;
SELECT setval(pg_get_serial_sequence('transaction_disputes', 'dispute_id'), COALESCE((SELECT MAX(dispute_id) FROM Transaction_Disputes), 1));
