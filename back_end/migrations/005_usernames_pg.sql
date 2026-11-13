-- Existing accounts keep a NULL username until they choose one in a future profile flow.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS username VARCHAR(30);
CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique
  ON public.users (LOWER(username)) WHERE username IS NOT NULL;

-- The API writes through this compatibility view. Include the new column.
CREATE OR REPLACE VIEW public."Users" AS SELECT * FROM public.users;
REVOKE ALL ON TABLE public.users FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public."Users" FROM PUBLIC, anon, authenticated;
