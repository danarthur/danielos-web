-- Invariants for dated relationship edges (migrations 20260903193000 /
-- 20260903201500).
--
-- Three things must stay true, and each of them broke something real while
-- being built:
--
--   1. Two stints at the same company must be representable. The original
--      UNIQUE (source, target, type) made rejoining a former employer collide
--      with the historical row, which is why a job change used to require
--      DELETING the old edge -- the one operation that actually loses history.
--
--   2. Exactly one CURRENT edge per pair per type. The partial unique index
--      still has to fire, because the server actions read 23505 to say "this
--      connection is already on the deal."
--
--   3. No SECURITY DEFINER function that touches these edges may be executable
--      by anon. Postgres grants EXECUTE to PUBLIC by default, and ten of these
--      functions were rewritten in place to fix ON CONFLICT inference against
--      the partial index -- a rewrite is exactly when a grant gets dropped on
--      the floor.

BEGIN;
SELECT plan(6);

-- 1. Shape.
SELECT has_column('cortex', 'relationships', 'started_at', 'edges record when they began');
SELECT has_column('cortex', 'relationships', 'ended_at',   'edges record when they ended');

-- 2. The partial index exists and is scoped to live edges. A non-partial index
--    here would silently re-forbid two stints.
SELECT is(
  (SELECT count(*)::int FROM pg_indexes
    WHERE schemaname = 'cortex'
      AND indexname  = 'relationships_current_unique'
      AND indexdef ILIKE '%WHERE (ended_at IS NULL)%'),
  1,
  'uniqueness is scoped to current edges only'
);

-- 3. The old blanket constraint must be gone, or history is unrepresentable.
SELECT is(
  (SELECT count(*)::int FROM pg_constraint
    WHERE conrelid = 'cortex.relationships'::regclass
      AND conname  = 'relationships_source_entity_id_target_entity_id_relationshi_key'),
  0,
  'the blanket unique constraint that blocked two stints is gone'
);

-- 4. Every function that writes these edges via ON CONFLICT must use the
--    predicated form. A bare one raises "no unique or exclusion constraint
--    matching the ON CONFLICT specification" at RUNTIME, not at deploy -- it
--    would take out ghost creation, roster adds, deal creation and passkey
--    recovery on the next call, not on the next build.
--    Counted with a whitespace-tolerant regex rather than LIKE: the clause is
--    routinely wrapped across lines, and a LIKE expecting a single space
--    reports a correctly-predicated function as bare.
SELECT is(
  (WITH d AS (
     SELECT pg_get_functiondef(p.oid) AS def
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE p.prokind = 'f'
        AND n.nspname NOT IN ('pg_catalog', 'information_schema')
        AND pg_get_functiondef(p.oid) LIKE '%ON CONFLICT (source_entity_id, target_entity_id, relationship_type)%')
   SELECT count(*)::int FROM d
    WHERE (SELECT count(*) FROM regexp_matches(def,
             'ON CONFLICT \(source_entity_id, target_entity_id, relationship_type\)', 'g'))
       <> (SELECT count(*) FROM regexp_matches(def,
             'ON CONFLICT \(source_entity_id, target_entity_id, relationship_type\)\s*WHERE ended_at IS NULL', 'g'))),
  0,
  'no function uses a bare ON CONFLICT that the partial index cannot satisfy'
);

-- 5. No anon EXECUTE on any of them, including the move RPC.
SELECT is(
  (SELECT count(*)::int
     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.prokind = 'f' AND p.prosecdef
      AND n.nspname NOT IN ('pg_catalog', 'information_schema')
      AND (pg_get_functiondef(p.oid) LIKE '%ON CONFLICT (source_entity_id%'
           OR p.proname = 'move_entity_affiliation')
      AND has_function_privilege('anon', p.oid, 'EXECUTE')),
  0,
  'no edge-writing SECURITY DEFINER function is executable by anon'
);

SELECT * FROM finish();
ROLLBACK;
