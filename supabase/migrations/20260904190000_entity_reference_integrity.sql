-- Referential integrity for entity references, and cleanup of what their
-- absence already allowed.
--
-- Seven columns pointed at directory.entities with NO foreign key, so deleting
-- an entity silently stranded whatever referenced it. Thirteen orphaned rows
-- had accumulated, found only by sweeping every entity-referencing column by
-- hand after a delete:
--
--   ops.deal_crew.entity_id              5   DJ slots on real deals, some confirmed
--   ops.crew_skills.entity_id            4   skills belonging to nobody
--   ops.deal_stakeholders.organization_id 2  bill_to and venue_contact
--   public.deals.organization_id         1   "Bond Wedding" -- client unknown
--   public.deals.referrer_entity_id      1   "Matt & Amanda Wedding"
--
-- The deal_crew ones are the reason this matters rather than being tidy-up: a
-- confirmed DJ slot whose person no longer exists renders as a blank name on a
-- show, and nothing anywhere reports it.
--
-- ON DELETE IS CHOSEN PER COLUMN, by what the row means without the entity:
--
--   RESTRICT  the reference IS the history; losing it corrupts the record, so
--             deletion must fail loudly instead. This is the rule every mature
--             vendor enforces -- Salesforce: "You can deactivate users, but you
--             can't delete them outright. Deleting a user can result in orphaned
--             records and the loss of critical business information." Deputy,
--             QuickBooks and Zoho all block at the pay-run boundary the same way.
--             Archiving, not deletion, is the offboarding path.
--
--   SET NULL  the row still means something without the entity, and nothing
--             stops it becoming null.
--
--   CASCADE   the row is a pure attribute of the person and cannot outlive them.
--
-- TWO TABLES CANNOT USE SET NULL AT ALL, which is what decided them:
--
--   deal_stakeholders  `deal_stakeholders_node_check` requires at least one of
--                      (organization_id, entity_id) to be NOT NULL. SET NULL
--                      would violate the CHECK and make entity deletion raise.
--
--   deal_crew          `deal_crew_deal_role_uniq` is UNIQUE (deal_id, role_note)
--                      WHERE entity_id IS NULL -- at most one UNASSIGNED slot per
--                      role per deal. So nulling a crew row collides whenever the
--                      deal already has an open slot for that role. A blanket
--                      SET NULL would raise a unique violation at delete time.
--                      Found by testing the migration, not by reading it.
--
-- For both, blocking is not merely the better policy, it is the only coherent
-- one -- and it agrees with the vendor rule above.
--
-- Safe against existing flows: the twelve entity deletes in app code are all
-- onboarding-rollback and summoning cleanup paths acting on entities created
-- moments earlier, which by construction carry no deal history.

-- ── 1. Clean what is already stranded ────────────────────────────────────────

-- Crew slots: keep the slot where we can (role_note, catalog item, rates and
-- status all survive as an unassigned slot the UI shows as needing a name), but
-- the partial unique index allows only ONE unassigned slot per (deal, role), so
-- a redundant orphan has to go instead.

-- (a) An open slot for that role already exists -- the orphan adds nothing.
DELETE FROM ops.deal_crew dc
 WHERE dc.entity_id IS NOT NULL
   AND dc.role_note IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM directory.entities e WHERE e.id = dc.entity_id)
   AND EXISTS (SELECT 1 FROM ops.deal_crew o
                WHERE o.deal_id = dc.deal_id AND o.role_note = dc.role_note
                  AND o.entity_id IS NULL);

-- (b) Two orphans share a (deal, role); only the earliest can become the slot.
DELETE FROM ops.deal_crew dc
 WHERE dc.entity_id IS NOT NULL
   AND dc.role_note IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM directory.entities e WHERE e.id = dc.entity_id)
   AND EXISTS (SELECT 1 FROM ops.deal_crew o
                WHERE o.deal_id = dc.deal_id AND o.role_note = dc.role_note
                  AND o.entity_id IS NOT NULL
                  AND NOT EXISTS (SELECT 1 FROM directory.entities e2 WHERE e2.id = o.entity_id)
                  AND (o.created_at, o.id) < (dc.created_at, dc.id));

-- (c) Survivors keep the show staffed, minus a name.
UPDATE ops.deal_crew dc
   SET entity_id = NULL
 WHERE dc.entity_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM directory.entities e WHERE e.id = dc.entity_id);

-- Both ids already dangle or are null on these, and the node CHECK means a row
-- with neither is not a stakeholder at all. Their frozen name columns are also
-- null -- they predate 20260903180000, so nothing is recoverable from them.
DELETE FROM ops.deal_stakeholders s
 WHERE (s.organization_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM directory.entities e WHERE e.id = s.organization_id))
   AND (s.entity_id IS NULL
        OR NOT EXISTS (SELECT 1 FROM directory.entities e WHERE e.id = s.entity_id));

-- entity_id is NOT NULL here, so there is nothing to null: a skill with no
-- person is not a fact about anything.
DELETE FROM ops.crew_skills cs
 WHERE NOT EXISTS (SELECT 1 FROM directory.entities e WHERE e.id = cs.entity_id);

UPDATE public.deals d
   SET organization_id = NULL
 WHERE d.organization_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM directory.entities e WHERE e.id = d.organization_id);

UPDATE public.deals d
   SET referrer_entity_id = NULL
 WHERE d.referrer_entity_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM directory.entities e WHERE e.id = d.referrer_entity_id);

UPDATE public.deals d
   SET main_contact_id = NULL
 WHERE d.main_contact_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM directory.entities e WHERE e.id = d.main_contact_id);

-- ── 2. Stop it happening again ───────────────────────────────────────────────

ALTER TABLE ops.deal_crew
  DROP CONSTRAINT IF EXISTS deal_crew_entity_id_fkey,
  ADD CONSTRAINT deal_crew_entity_id_fkey
    FOREIGN KEY (entity_id) REFERENCES directory.entities(id) ON DELETE RESTRICT;

ALTER TABLE ops.crew_skills
  DROP CONSTRAINT IF EXISTS crew_skills_entity_id_fkey,
  ADD CONSTRAINT crew_skills_entity_id_fkey
    FOREIGN KEY (entity_id) REFERENCES directory.entities(id) ON DELETE CASCADE;

ALTER TABLE ops.deal_stakeholders
  DROP CONSTRAINT IF EXISTS deal_stakeholders_entity_id_fkey,
  ADD CONSTRAINT deal_stakeholders_entity_id_fkey
    FOREIGN KEY (entity_id) REFERENCES directory.entities(id) ON DELETE RESTRICT,
  DROP CONSTRAINT IF EXISTS deal_stakeholders_organization_id_fkey,
  ADD CONSTRAINT deal_stakeholders_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES directory.entities(id) ON DELETE RESTRICT;

ALTER TABLE public.deals
  DROP CONSTRAINT IF EXISTS deals_organization_id_entity_fkey,
  ADD CONSTRAINT deals_organization_id_entity_fkey
    FOREIGN KEY (organization_id) REFERENCES directory.entities(id) ON DELETE RESTRICT,
  DROP CONSTRAINT IF EXISTS deals_referrer_entity_id_fkey,
  ADD CONSTRAINT deals_referrer_entity_id_fkey
    FOREIGN KEY (referrer_entity_id) REFERENCES directory.entities(id) ON DELETE SET NULL,
  DROP CONSTRAINT IF EXISTS deals_main_contact_id_fkey,
  ADD CONSTRAINT deals_main_contact_id_fkey
    FOREIGN KEY (main_contact_id) REFERENCES directory.entities(id) ON DELETE SET NULL;

-- Fail the migration rather than deploy with orphans still present.
DO $verify$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM (
    SELECT 1 FROM ops.deal_crew t WHERE t.entity_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM directory.entities e WHERE e.id = t.entity_id)
    UNION ALL SELECT 1 FROM ops.crew_skills t
      WHERE NOT EXISTS (SELECT 1 FROM directory.entities e WHERE e.id = t.entity_id)
    UNION ALL SELECT 1 FROM ops.deal_stakeholders t WHERE t.entity_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM directory.entities e WHERE e.id = t.entity_id)
    UNION ALL SELECT 1 FROM ops.deal_stakeholders t WHERE t.organization_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM directory.entities e WHERE e.id = t.organization_id)
    UNION ALL SELECT 1 FROM public.deals t WHERE t.organization_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM directory.entities e WHERE e.id = t.organization_id)
  ) q;
  IF n > 0 THEN
    RAISE EXCEPTION 'entity_reference_integrity: % orphaned entity reference(s) remain', n;
  END IF;
END $verify$;
