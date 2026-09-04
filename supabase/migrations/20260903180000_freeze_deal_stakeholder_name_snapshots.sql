-- Step 1 of the attribution work: stop deal history from rewriting itself.
--
-- ops.deal_stakeholders stores only entity ids. Every reader resolves the
-- display name live from directory.entities at read time (see
-- src/app/(dashboard)/(features)/events/actions/deal-stakeholders.ts). So
-- renaming or merging a company silently relabels every historical deal it
-- ever touched -- a 2024 wedding booked through "Pure Lavish Events" starts
-- claiming it was booked through whatever that entity is called today.
--
-- The owner-facing failure is worse than a wrong label: an all-time total that
-- changes on its own reads as "the software lost my data," and that distrust
-- spreads to the invoices. So we capture what the parties were CALLED at the
-- time, the same way an invoice freezes its bill-to block at issue.
--
-- CONTRAST WITH THE VENUE SNAPSHOTS (20260901233007), which deliberately do the
-- opposite and re-sync from the entity on every change. That is correct there:
-- a pull sheet and a crew reminder need TODAY's address, because they are
-- operational documents about a show that has not happened yet. These columns
-- are a historical record of who the parties were. Operational surfaces follow
-- the entity; historical surfaces follow the stamp. Do not "fix" one to match
-- the other.
--
-- Purely additive: nothing reads these columns yet. Readers move over to them
-- deliberately, per surface, in a later step. The point of landing this first
-- is that a rename between now and then is currently unrecoverable -- no row
-- anywhere records the old name -- and after this it is not.

ALTER TABLE ops.deal_stakeholders
  ADD COLUMN IF NOT EXISTS organization_name_at_deal text,
  ADD COLUMN IF NOT EXISTS contact_name_at_deal      text;

COMMENT ON COLUMN ops.deal_stakeholders.organization_name_at_deal IS
  'Frozen display_name of organization_id as of the moment this stakeholder was '
  'attached. Historical record -- never re-synced when the entity is renamed. '
  'Re-stamped only if organization_id itself is repointed at a different entity.';

COMMENT ON COLUMN ops.deal_stakeholders.contact_name_at_deal IS
  'Frozen display_name of entity_id as of the moment this stakeholder was '
  'attached. See organization_name_at_deal.';

-- Stamping happens in a trigger rather than at the call sites because there are
-- seven writers -- two server actions plus five INSERTs inside the
-- create_deal_complete RPC (20260427120000) -- and a future eighth would
-- silently skip the stamp. The trigger cannot be bypassed.
CREATE OR REPLACE FUNCTION ops.stamp_deal_stakeholder_names()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, ops, directory
AS $$
BEGIN
  -- Re-stamp when the row starts pointing at a DIFFERENT entity (someone
  -- corrected which company is on the deal). Never when the entity is merely
  -- renamed -- that is the whole point of the column.
  IF TG_OP = 'UPDATE'
     AND NEW.organization_id IS NOT DISTINCT FROM OLD.organization_id
     AND NEW.entity_id       IS NOT DISTINCT FROM OLD.entity_id THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    NEW.organization_name_at_deal := NULL;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.entity_id IS DISTINCT FROM OLD.entity_id THEN
    NEW.contact_name_at_deal := NULL;
  END IF;

  -- An explicitly supplied value wins, so a backfill or an import can assert a
  -- historical name the entity no longer carries. Mirrors the NPSP affiliation
  -- bug worth not repeating, where automation clobbered hand-entered dates.
  IF NEW.organization_name_at_deal IS NULL AND NEW.organization_id IS NOT NULL THEN
    SELECT e.display_name INTO NEW.organization_name_at_deal
      FROM directory.entities e WHERE e.id = NEW.organization_id;
  END IF;

  IF NEW.contact_name_at_deal IS NULL AND NEW.entity_id IS NOT NULL THEN
    SELECT e.display_name INTO NEW.contact_name_at_deal
      FROM directory.entities e WHERE e.id = NEW.entity_id;
  END IF;

  RETURN NEW;
END;
$$;

-- SECURITY DEFINER so the stamp is guaranteed rather than silently NULL when
-- the caller cannot SELECT the entity under RLS. Trigger functions are not
-- callable through PostgREST, but the repo rule is that every SECURITY DEFINER
-- function revokes explicitly (see 20260410160000) -- no exceptions, so nobody
-- has to audit which ones were judged safe.
REVOKE ALL ON FUNCTION ops.stamp_deal_stakeholder_names() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_stamp_deal_stakeholder_names ON ops.deal_stakeholders;
CREATE TRIGGER trg_stamp_deal_stakeholder_names
BEFORE INSERT OR UPDATE ON ops.deal_stakeholders
FOR EACH ROW EXECUTE FUNCTION ops.stamp_deal_stakeholder_names();

-- Backfill. Current names are the best evidence available for rows written
-- before the stamp existed; any rename that already happened is gone.
UPDATE ops.deal_stakeholders s
   SET organization_name_at_deal = e.display_name
  FROM directory.entities e
 WHERE s.organization_id = e.id
   AND s.organization_name_at_deal IS NULL;

UPDATE ops.deal_stakeholders s
   SET contact_name_at_deal = e.display_name
  FROM directory.entities e
 WHERE s.entity_id = e.id
   AND s.contact_name_at_deal IS NULL;
