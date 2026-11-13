-- MicroTeach uses its Express API for authorization. Block direct reads/writes
-- through Supabase's anon/authenticated Data API roles, including legacy views.
-- The server's PostgreSQL owner role keeps access to these relations.
DO $$
DECLARE relation_name text;
BEGIN
  FOREACH relation_name IN ARRAY ARRAY[
    'users', 'auth_sessions', 'skills', 'user_skills', 'posts', 'sessions',
    'teacher_applications', 'teacher_application_documents', 'reports',
    'post_applications', 'transactions', 'reviews', 'conversations',
    'conversation_members', 'messages', 'transaction_disputes',
    'master_transaction_types'
  ] LOOP
    IF to_regclass(format('public.%I', relation_name)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', relation_name);
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', relation_name);
    END IF;
  END LOOP;

  FOREACH relation_name IN ARRAY ARRAY[
    'Users', 'Skills', 'User_Skills', 'Posts', 'Sessions',
    'Teacher_Applications', 'Teacher_Application_Documents', 'Reports',
    'Post_Applications', 'Transactions', 'Reviews', 'Conversations',
    'Conversation_Members', 'Messages', 'Transaction_Disputes',
    'Master_Transaction_Types'
  ] LOOP
    IF to_regclass(format('public.%I', relation_name)) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', relation_name);
    END IF;
  END LOOP;
END $$;
