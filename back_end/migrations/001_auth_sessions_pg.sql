BEGIN;
CREATE TABLE IF NOT EXISTS public.auth_sessions (
  token_hash CHAR(64) PRIMARY KEY,
  user_id INT NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS auth_sessions_user_id ON public.auth_sessions(user_id);
ALTER TABLE public.auth_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.auth_sessions FROM PUBLIC, anon, authenticated;
COMMIT;
