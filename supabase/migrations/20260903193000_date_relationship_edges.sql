-- Step 2 of the attribution work: give relationship edges a lifespan.
--
-- cortex.relationships had created_at and nothing else, so an edge could only
-- ever mean "true right now." Moving a planner from one agency to another meant
-- DELETING the old edge, which is the one operation that actually loses history
-- about a person: after it, nothing anywhere records that they ever worked
-- there, and a past deal can no longer be explained.
--
-- started_at / ended_at make a job change append-only. ended_at IS NULL means
-- current; a set ended_at means "this was true, then it wasn't."
--
-- WHY THE UNIQUE CONSTRAINT HAD TO CHANGE
-- The old UNIQUE (source_entity_id, target_entity_id, relationship_type) made
-- two stints at the same company structurally unrepresentable -- rejoining a
-- former employer collided with the historical row. It is replaced by a partial
-- unique index over CURRENT edges only, which keeps the real guarantee (one
-- live edge per pair per type, so the 23505 handling in the server actions
-- still fires) while allowing any number of ended ones.
--
-- CONSEQUENCE, and the reason this migration is longer than it looks:
-- `ON CONFLICT (cols)` cannot infer a PARTIAL index -- it raises "there is no
-- unique or exclusion constraint matching the ON CONFLICT specification" at
-- RUNTIME, not at deploy. Ten SECURITY DEFINER functions use the bare form
-- (add_books_for_edge, add_co_host_edge, add_contact_to_ghost_org x2,
-- add_ghost_member, add_represents_edge, add_roster_member,
-- create_deal_complete, reset_member_passkey, upsert_relationship). Swapping
-- the index without touching them would have broken ghost creation, roster
-- adds, deal creation and passkey recovery, silently, on the next call.
--
-- They are rewritten from their own live pg_get_functiondef output rather than
-- retyped, so the bodies are preserved exactly -- these are the most
-- security-sensitive functions in the app and hand-transcribing ten of them is
-- how a privilege bug gets introduced. CREATE OR REPLACE retains existing
-- privileges, so the REVOKEs stay intact (asserted at the end).

ALTER TABLE cortex.relationships
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS ended_at   timestamptz;

COMMENT ON COLUMN cortex.relationships.started_at IS
  'When this edge became true. Backfilled from created_at for pre-existing rows.';
COMMENT ON COLUMN cortex.relationships.ended_at IS
  'When this edge stopped being true. NULL = current. Readers of live '
  'relationships MUST filter ended_at IS NULL; historical surfaces read both.';

UPDATE cortex.relationships SET started_at = created_at WHERE started_at IS NULL;

ALTER TABLE cortex.relationships
  DROP CONSTRAINT IF EXISTS relationships_source_entity_id_target_entity_id_relationshi_key;

CREATE UNIQUE INDEX IF NOT EXISTS relationships_current_unique
  ON cortex.relationships (source_entity_id, target_entity_id, relationship_type)
  WHERE ended_at IS NULL;

-- Historical lookups ("who worked here in 2024") scan by target + window.
CREATE INDEX IF NOT EXISTS relationships_target_window_idx
  ON cortex.relationships (target_entity_id, relationship_type, ended_at);

DO $do$
DECLARE r record; n int := 0;
BEGIN
  FOR r IN
    SELECT p.oid, pg_get_functiondef(p.oid) AS def
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
    WHERE p.prokind = 'f'
      AND ns.nspname NOT IN ('pg_catalog','information_schema')
      AND pg_get_functiondef(p.oid)
          LIKE '%ON CONFLICT (source_entity_id, target_entity_id, relationship_type)%'
  LOOP
    EXECUTE replace(
      r.def,
      'ON CONFLICT (source_entity_id, target_entity_id, relationship_type)',
      'ON CONFLICT (source_entity_id, target_entity_id, relationship_type) WHERE ended_at IS NULL');
    n := n + 1;
  END LOOP;
  RAISE NOTICE 'date_relationship_edges: rewrote % ON CONFLICT sites', n;
END $do$;

-- Fail the migration rather than deploy a half-rewritten set.
DO $verify$
DECLARE bare int; leaked int;
BEGIN
  SELECT count(*) INTO bare
  FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
  WHERE p.prokind = 'f' AND ns.nspname NOT IN ('pg_catalog','information_schema')
    AND pg_get_functiondef(p.oid) LIKE '%ON CONFLICT (source_entity_id, target_entity_id, relationship_type)%'
    AND pg_get_functiondef(p.oid) NOT LIKE
        '%ON CONFLICT (source_entity_id, target_entity_id, relationship_type) WHERE ended_at IS NULL%';
  IF bare > 0 THEN
    RAISE EXCEPTION 'date_relationship_edges: % function(s) still use a bare ON CONFLICT and would fail at runtime', bare;
  END IF;

  SELECT count(*) INTO leaked
  FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
  WHERE p.prokind = 'f' AND p.prosecdef
    AND ns.nspname NOT IN ('pg_catalog','information_schema')
    AND pg_get_functiondef(p.oid) LIKE '%ON CONFLICT (source_entity_id%'
    AND has_function_privilege('anon', p.oid, 'EXECUTE');
  IF leaked > 0 THEN
    RAISE EXCEPTION 'date_relationship_edges: % rewritten SECURITY DEFINER function(s) are executable by anon', leaked;
  END IF;
END $verify$;
