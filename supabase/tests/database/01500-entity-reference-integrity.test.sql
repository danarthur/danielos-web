-- Every column pointing at directory.entities must have a foreign key, and no
-- orphaned reference may exist.
--
-- Seven columns had no FK, so deleting an entity silently stranded whatever
-- referenced it. Thirteen orphans had accumulated by the time anyone looked --
-- including five crew slots on real deals, some of them CONFIRMED, whose person
-- no longer existed. That renders as a blank name on a show and nothing reports
-- it.
--
-- The orphan check is the load-bearing half: a future column added without a FK
-- fails here the first time a row is stranded, rather than in a year.

BEGIN;
SELECT plan(4);

-- 1. No stranded references anywhere they can occur.
SELECT is(
  (SELECT count(*)::int FROM (
     SELECT 1 FROM ops.deal_crew t
      WHERE t.entity_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM directory.entities e WHERE e.id = t.entity_id)
     UNION ALL SELECT 1 FROM ops.crew_skills t
      WHERE NOT EXISTS (SELECT 1 FROM directory.entities e WHERE e.id = t.entity_id)
     UNION ALL SELECT 1 FROM ops.deal_stakeholders t
      WHERE t.entity_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM directory.entities e WHERE e.id = t.entity_id)
     UNION ALL SELECT 1 FROM ops.deal_stakeholders t
      WHERE t.organization_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM directory.entities e WHERE e.id = t.organization_id)
     UNION ALL SELECT 1 FROM public.deals t
      WHERE t.organization_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM directory.entities e WHERE e.id = t.organization_id)
     UNION ALL SELECT 1 FROM public.deals t
      WHERE t.referrer_entity_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM directory.entities e WHERE e.id = t.referrer_entity_id)
     UNION ALL SELECT 1 FROM public.deals t
      WHERE t.main_contact_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM directory.entities e WHERE e.id = t.main_contact_id)
   ) q),
  0,
  'no orphaned entity references'
);

-- 2. The seven columns that were unguarded now carry a FK.
SELECT is(
  (SELECT count(*)::int
     FROM (VALUES
       ('ops.deal_crew'::regclass,         'entity_id'),
       ('ops.crew_skills'::regclass,       'entity_id'),
       ('ops.deal_stakeholders'::regclass, 'entity_id'),
       ('ops.deal_stakeholders'::regclass, 'organization_id'),
       ('public.deals'::regclass,          'organization_id'),
       ('public.deals'::regclass,          'referrer_entity_id'),
       ('public.deals'::regclass,          'main_contact_id')
     ) AS want(tbl, col)
    WHERE NOT EXISTS (
      SELECT 1 FROM pg_constraint c
       WHERE c.contype = 'f'
         AND c.conrelid = want.tbl
         AND c.confrelid = 'directory.entities'::regclass
         AND want.col = ANY (
           SELECT a.attname FROM pg_attribute a
            WHERE a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)))),
  0,
  'every entity-referencing column has a foreign key'
);

-- 3. History-bearing references BLOCK deletion. Salesforce's rule: deleting a
--    record with history orphans rows and loses business information, so the
--    offboarding path is archive, never delete.
SELECT is(
  (SELECT count(*)::int FROM pg_constraint c
    WHERE c.contype = 'f' AND c.confrelid = 'directory.entities'::regclass
      AND c.conrelid IN ('ops.deal_stakeholders'::regclass, 'ops.deal_crew'::regclass)
      AND c.confdeltype <> 'r'),
  0,
  'stakeholder and crew references restrict deletion rather than stranding rows'
);

-- 4. deal_crew must NOT use SET NULL: deal_crew_deal_role_uniq is UNIQUE
--    (deal_id, role_note) WHERE entity_id IS NULL, so nulling collides whenever
--    the deal already has an open slot for that role, and the delete raises.
SELECT is(
  (SELECT count(*)::int FROM pg_constraint c
    WHERE c.contype = 'f' AND c.conrelid = 'ops.deal_crew'::regclass
      AND c.confrelid = 'directory.entities'::regclass
      AND c.confdeltype = 'n'),
  0,
  'deal_crew does not use SET NULL, which its partial unique index forbids'
);

SELECT * FROM finish();
ROLLBACK;
