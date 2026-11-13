-- Store newly submitted identity documents only in the private database.
ALTER TABLE public.teacher_application_documents ADD COLUMN IF NOT EXISTS file_data TEXT;
CREATE OR REPLACE VIEW public."Teacher_Application_Documents" AS
  SELECT * FROM public.teacher_application_documents;
REVOKE ALL ON TABLE public.teacher_application_documents FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public."Teacher_Application_Documents" FROM PUBLIC, anon, authenticated;

-- Existing chat routes use these columns for authenticated attachment delivery.
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100);
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS file_data TEXT;
CREATE OR REPLACE VIEW public."Messages" AS SELECT * FROM public.messages;
REVOKE ALL ON TABLE public.messages FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public."Messages" FROM PUBLIC, anon, authenticated;
