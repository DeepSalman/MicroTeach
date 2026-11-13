-- Apply after 001 and 002 on an existing Supabase database.
BEGIN;
CREATE TABLE IF NOT EXISTS public.escrow_settlements (
  post_id INT PRIMARY KEY,
  outcome VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Existing refunds and payouts must not become eligible for settlement again.
INSERT INTO public.escrow_settlements (post_id, outcome)
SELECT DISTINCT reference_id, 'legacy'
FROM public.transactions
WHERE reference_id IS NOT NULL
  AND type IN ('refund', 'bounty_received', 'bounty_payment')
ON CONFLICT (post_id) DO NOTHING;

ALTER TABLE public.escrow_settlements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.escrow_settlements FROM PUBLIC, anon, authenticated;

UPDATE public.master_transaction_types SET is_active = FALSE
WHERE type_code IN ('top_up', 'bounty_payment');
COMMIT;
