-- Invariants for referral attribution (migration 20260904030000).
--
-- A referral credits the PERSON who made the judgement and freezes the ORG they
-- were at. The split follows from this being a recognition ledger rather than a
-- payables one: an organization cannot exercise judgement, so the human is
-- named, while the org is recorded for roll-up and never re-resolved.
--
-- *** If a payout is ever attached to finance.referrals, the payee must be
-- ORG-bound (counterparty_org_entity_id), not the person. Every domain where
-- money actually moves resolves to the entity. ***

BEGIN;
SELECT plan(5);

SELECT has_column('finance', 'referrals', 'counterparty_org_entity_id',
  'referrals record the org alongside the person');
SELECT has_column('finance', 'referrals', 'counterparty_name_at_referral',
  'the credited party name is frozen, so a rename cannot rewrite history');
SELECT has_column('finance', 'referrals', 'counterparty_org_name_at_referral',
  'the org name is frozen for the same reason');

-- Exactly one log_referral. Two overloads would make every existing 7-named-arg
-- call ambiguous at runtime -- the old signature is dropped precisely because
-- the wider one absorbs those calls through its default.
SELECT is(
  (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'finance' AND p.proname = 'log_referral'),
  1,
  'exactly one log_referral overload, so old callers resolve unambiguously'
);

-- Postgres grants EXECUTE to PUBLIC by default; these read and write
-- workspace-scoped financial rows.
SELECT is(
  (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'finance'
      AND p.proname IN ('log_referral', 'delete_referral', 'current_employer_entity_id')
      AND has_function_privilege('anon', p.oid, 'EXECUTE')),
  0,
  'no referral function is executable by anon'
);

SELECT * FROM finish();
ROLLBACK;
