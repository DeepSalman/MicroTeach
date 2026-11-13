-- ============================================================
-- MicroTeach Platform — Supabase (PostgreSQL) Production Schema
-- ============================================================
-- Instructions:
-- 1. Open your Supabase Dashboard: https://supabase.com/dashboard
-- 2. Select your Project -> Click on 'SQL Editor' in the left menu
-- 3. Click 'New query', paste this ENTIRE script, and click 'RUN'.
-- ============================================================

-- Set search path to public
SET search_path TO public;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Clean drop of existing views and tables
DROP VIEW IF EXISTS public."Messages", public."Conversation_Members", public."Conversations", public."Reviews", public."Transactions", public."Post_Applications", public."Reports", public."Teacher_Application_Documents", public."Teacher_Applications", public."Sessions", public."Posts", public."User_Skills", public."Skills", public."Transaction_Disputes", public."Master_Transaction_Types", public."Users" CASCADE;

DROP TABLE IF EXISTS public.messages, public."Messages" CASCADE;
DROP TABLE IF EXISTS public.auth_sessions CASCADE;
DROP TABLE IF EXISTS public.conversation_members, public."Conversation_Members" CASCADE;
DROP TABLE IF EXISTS public.conversations, public."Conversations" CASCADE;
DROP TABLE IF EXISTS public.reviews, public."Reviews" CASCADE;
DROP TABLE IF EXISTS public.transactions, public."Transactions" CASCADE;
DROP TABLE IF EXISTS public.escrow_settlements CASCADE;
DROP TABLE IF EXISTS public.post_applications, public."Post_Applications" CASCADE;
DROP TABLE IF EXISTS public.reports, public."Reports" CASCADE;
DROP TABLE IF EXISTS public.teacher_application_documents, public."Teacher_Application_Documents" CASCADE;
DROP TABLE IF EXISTS public.teacher_applications, public."Teacher_Applications" CASCADE;
DROP TABLE IF EXISTS public.sessions, public."Sessions" CASCADE;
DROP TABLE IF EXISTS public.posts, public."Posts" CASCADE;
DROP TABLE IF EXISTS public.user_skills, public."User_Skills" CASCADE;
DROP TABLE IF EXISTS public.skills, public."Skills" CASCADE;
DROP TABLE IF EXISTS public.transaction_disputes, public."Transaction_Disputes" CASCADE;
DROP TABLE IF EXISTS public.master_transaction_types, public."Master_Transaction_Types" CASCADE;
DROP TABLE IF EXISTS public.users, public."Users" CASCADE;

-- 1. Users
CREATE TABLE public.users (
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
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  username VARCHAR(30)
);
CREATE UNIQUE INDEX users_username_unique ON public.users (LOWER(username)) WHERE username IS NOT NULL;

-- Opaque, server-side login sessions. Only a hash of each cookie token is stored.
CREATE TABLE public.auth_sessions (
  token_hash CHAR(64) PRIMARY KEY,
  user_id INT NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX auth_sessions_user_id ON public.auth_sessions(user_id);

-- 2. Skills
CREATE TABLE public.skills (
  skill_id SERIAL PRIMARY KEY,
  skill_name VARCHAR(100) NOT NULL,
  category VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. User_Skills
CREATE TABLE public.user_skills (
  user_skill_id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  skill_id INT NOT NULL REFERENCES public.skills(skill_id) ON DELETE CASCADE,
  proficiency_level VARCHAR(20) DEFAULT 'Intermediate',
  hourly_rate DECIMAL(8,2) DEFAULT 0.00
);

-- 4. Posts
CREATE TABLE public.posts (
  post_id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
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
CREATE TABLE public.sessions (
  session_id SERIAL PRIMARY KEY,
  tutor_id INT NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  student_id INT NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  skill_id INT NOT NULL REFERENCES public.skills(skill_id) ON DELETE CASCADE,
  scheduled_time TIMESTAMPTZ NOT NULL,
  duration_minutes INT DEFAULT 60,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 6. Teacher_Applications
CREATE TABLE public.teacher_applications (
  application_id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  student_id VARCHAR(50),
  reason TEXT,
  expertise TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  reviewed_by INT REFERENCES public.users(user_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMPTZ NULL
);

-- 7. Teacher_Application_Documents
CREATE TABLE public.teacher_application_documents (
  document_id SERIAL PRIMARY KEY,
  application_id INT NOT NULL REFERENCES public.teacher_applications(application_id) ON DELETE CASCADE,
  document_type VARCHAR(50) NOT NULL,
  file_path VARCHAR(512) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size INT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_data TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 8. Reports
CREATE TABLE public.reports (
  report_id SERIAL PRIMARY KEY,
  post_id INT NOT NULL REFERENCES public.posts(post_id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
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
CREATE TABLE public.post_applications (
  application_id SERIAL PRIMARY KEY,
  post_id INT NOT NULL REFERENCES public.posts(post_id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  message TEXT,
  status VARCHAR(30) DEFAULT 'pending',
  completion_requested_by INT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (post_id, user_id)
);

-- 10. Transactions
CREATE TABLE public.transactions (
  transaction_id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  balance_after DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  reference_id INT NULL,
  description VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- One settlement per post, retained after post deletion for audit and replay protection.
CREATE TABLE public.escrow_settlements (
  post_id INT PRIMARY KEY,
  outcome VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 11. Reviews
CREATE TABLE public.reviews (
  review_id SERIAL PRIMARY KEY,
  reviewer_id INT NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  reviewee_id INT NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  post_id INT NOT NULL REFERENCES public.posts(post_id) ON DELETE CASCADE,
  rating DECIMAL(2,1) NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (reviewer_id, post_id)
);

-- 12. Conversations
CREATE TABLE public.conversations (
  conversation_id SERIAL PRIMARY KEY,
  post_id INT NULL REFERENCES public.posts(post_id) ON DELETE SET NULL,
  last_message_preview VARCHAR(255) DEFAULT '',
  last_message_at TIMESTAMPTZ NULL DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 13. Conversation_Members
CREATE TABLE public.conversation_members (
  conversation_id INT NOT NULL REFERENCES public.conversations(conversation_id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  last_read_seq INT NOT NULL DEFAULT 0,
  last_delivered_seq INT NOT NULL DEFAULT 0,
  muted SMALLINT NOT NULL DEFAULT 0,
  PRIMARY KEY (conversation_id, user_id)
);

-- 14. Messages
CREATE TABLE public.messages (
  conversation_id INT NOT NULL REFERENCES public.conversations(conversation_id) ON DELETE CASCADE,
  seq INT NOT NULL,
  sender_id INT NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  kind VARCHAR(30) NOT NULL DEFAULT 'text',
  body TEXT NOT NULL,
  client_msg_id VARCHAR(64) NULL,
  file_path VARCHAR(512) NULL,
  file_type VARCHAR(50) NULL,
  file_name VARCHAR(255) NULL,
  file_size INT NULL,
  mime_type VARCHAR(100) NULL,
  file_data TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (conversation_id, seq)
);

-- 15. Transaction_Disputes
CREATE TABLE public.transaction_disputes (
  dispute_id SERIAL PRIMARY KEY,
  post_id INT NOT NULL REFERENCES public.posts(post_id) ON DELETE CASCADE,
  application_id INT NULL,
  reporter_id INT NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
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
CREATE TABLE public.master_transaction_types (
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
-- Backward Compatibility Views (Supports quoted "Users", "Posts", etc.)
-- ============================================================
CREATE OR REPLACE VIEW public."Users" AS SELECT * FROM public.users;
CREATE OR REPLACE VIEW public."Skills" AS SELECT * FROM public.skills;
CREATE OR REPLACE VIEW public."User_Skills" AS SELECT * FROM public.user_skills;
CREATE OR REPLACE VIEW public."Posts" AS SELECT * FROM public.posts;
CREATE OR REPLACE VIEW public."Sessions" AS SELECT * FROM public.sessions;
CREATE OR REPLACE VIEW public."Teacher_Applications" AS SELECT * FROM public.teacher_applications;
CREATE OR REPLACE VIEW public."Teacher_Application_Documents" AS SELECT * FROM public.teacher_application_documents;
CREATE OR REPLACE VIEW public."Reports" AS SELECT * FROM public.reports;
CREATE OR REPLACE VIEW public."Post_Applications" AS SELECT * FROM public.post_applications;
CREATE OR REPLACE VIEW public."Transactions" AS SELECT * FROM public.transactions;
CREATE OR REPLACE VIEW public."Reviews" AS SELECT * FROM public.reviews;
CREATE OR REPLACE VIEW public."Conversations" AS SELECT * FROM public.conversations;
CREATE OR REPLACE VIEW public."Conversation_Members" AS SELECT * FROM public.conversation_members;
CREATE OR REPLACE VIEW public."Messages" AS SELECT * FROM public.messages;
CREATE OR REPLACE VIEW public."Transaction_Disputes" AS SELECT * FROM public.transaction_disputes;
CREATE OR REPLACE VIEW public."Master_Transaction_Types" AS SELECT * FROM public.master_transaction_types;

-- Restrict direct Supabase Data API access; the Express API enforces ownership
-- and administrator checks. Keep this in sync with migration 002.
DO $$
DECLARE relation_name text;
BEGIN
  FOREACH relation_name IN ARRAY ARRAY[
    'users', 'auth_sessions', 'skills', 'user_skills', 'posts', 'sessions',
    'teacher_applications', 'teacher_application_documents', 'reports',
    'post_applications', 'transactions', 'escrow_settlements', 'reviews', 'conversations',
    'conversation_members', 'messages', 'transaction_disputes',
    'master_transaction_types'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', relation_name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', relation_name);
  END LOOP;

  FOREACH relation_name IN ARRAY ARRAY[
    'Users', 'Skills', 'User_Skills', 'Posts', 'Sessions',
    'Teacher_Applications', 'Teacher_Application_Documents', 'Reports',
    'Post_Applications', 'Transactions', 'Reviews', 'Conversations',
    'Conversation_Members', 'Messages', 'Transaction_Disputes',
    'Master_Transaction_Types'
  ] LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', relation_name);
  END LOOP;
END $$;
