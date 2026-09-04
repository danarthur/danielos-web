-- F1 (part 2): keep the denormalized venue snapshots in step with the entity.
--
-- ops.events.venue_name/venue_address and public.deals.venue_name are read by
-- ~25 surfaces (crew portal, client portal, iCal feed, assignment and reminder
-- emails, proposals, pull sheets, run-of-show export). Rewriting every reader to
-- join the entity would be a large, risky change; instead the entity stays the
-- source of truth and these copies are refreshed whenever it changes.
--
-- Scope rule: only rows that actually link to a venue entity are synced. Events
-- with a free-text venue (no venue_entity_id -- EventCommandGrid allows this)
-- keep whatever was typed. For linked rows the entity wins, which is the point.

CREATE OR REPLACE FUNCTION directory.sync_venue_snapshots()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, ops, directory
AS $$
BEGIN
  IF NEW.type IS DISTINCT FROM 'venue' THEN
    RETURN NEW;
  END IF;

  -- Nothing that feeds the snapshot changed.
  IF TG_OP = 'UPDATE'
     AND NEW.display_name IS NOT DISTINCT FROM OLD.display_name
     AND NEW.attributes   IS NOT DISTINCT FROM OLD.attributes THEN
    RETURN NEW;
  END IF;

  UPDATE ops.events e
     SET venue_name    = NEW.display_name,
         venue_address = directory.entity_address_text(NEW.attributes)
   WHERE e.venue_entity_id = NEW.id;

  UPDATE public.deals d
     SET venue_name = NEW.display_name
   WHERE d.venue_id = NEW.id;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION directory.sync_venue_snapshots() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_sync_venue_snapshots ON directory.entities;
CREATE TRIGGER trg_sync_venue_snapshots
AFTER INSERT OR UPDATE ON directory.entities
FOR EACH ROW EXECUTE FUNCTION directory.sync_venue_snapshots();

-- Linking a venue to an event fills the snapshot immediately, so a freshly
-- linked event never shows a blank venue.
CREATE OR REPLACE FUNCTION ops.fill_event_venue_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, ops, directory
AS $$
BEGIN
  IF NEW.venue_entity_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.venue_entity_id IS DISTINCT FROM OLD.venue_entity_id) THEN
    SELECT v.display_name, directory.entity_address_text(v.attributes)
      INTO NEW.venue_name, NEW.venue_address
      FROM directory.entities v
     WHERE v.id = NEW.venue_entity_id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION ops.fill_event_venue_snapshot() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_fill_event_venue_snapshot ON ops.events;
CREATE TRIGGER trg_fill_event_venue_snapshot
BEFORE INSERT OR UPDATE ON ops.events
FOR EACH ROW EXECUTE FUNCTION ops.fill_event_venue_snapshot();

-- Backfill the rows that already drifted.
UPDATE ops.events e
   SET venue_name    = v.display_name,
       venue_address = directory.entity_address_text(v.attributes)
  FROM directory.entities v
 WHERE v.id = e.venue_entity_id;

UPDATE public.deals d
   SET venue_name = v.display_name
  FROM directory.entities v
 WHERE v.id = d.venue_id;
