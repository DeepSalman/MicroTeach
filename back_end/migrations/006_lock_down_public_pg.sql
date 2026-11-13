-- The application authorizes access through its Express API. Legacy public
-- tables and compatibility views must not remain available to Supabase's
-- anonymous or authenticated Data API roles.
--
-- Re-runnable and data-preserving. This also covers legacy objects such as
-- post_comments that are absent from the current fresh-install schema.
DO $$
DECLARE relation_name text;
BEGIN
  FOR relation_name IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', relation_name);
  END LOOP;
END $$;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;
