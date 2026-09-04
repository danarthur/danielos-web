-- Drop the legacy enum whitelist on public.deals.event_archetype.
--
-- Context: event archetypes moved from a hardcoded enum to the workspace-scoped
-- taxonomy in ops.workspace_event_archetypes (owners extend it via
-- ops.upsert_workspace_event_archetype). The app model was unbound from the
-- legacy enum at that point (see src/app/(dashboard)/(features)/events/actions/
-- deal-model.ts), and ops.events was created without an equivalent constraint --
-- but deals_event_archetype_check was never dropped.
--
-- Result: creating a deal failed for 4 of the 11 archetypes the picker offers --
-- three *system* slugs the whitelist spells differently (awards_show vs
-- awards_ceremony, birthday vs birthday_party, charity_gala vs fundraiser) and
-- every custom workspace type.
--
-- Replace the whitelist with the same slug-format guard that
-- ops.workspace_event_archetypes already enforces on its own slug column, so the
-- column keeps a shape check without pinning a closed value set. The taxonomy
-- table remains the source of truth for which slugs are offered.

ALTER TABLE public.deals
  DROP CONSTRAINT IF EXISTS deals_event_archetype_check;

ALTER TABLE public.deals
  ADD CONSTRAINT deals_event_archetype_check
  CHECK (
    event_archetype IS NULL
    OR (event_archetype ~ '^[a-z0-9_]+$' AND length(event_archetype) BETWEEN 1 AND 80)
  );

COMMENT ON CONSTRAINT deals_event_archetype_check ON public.deals IS
  'Slug-format guard only. Allowed values are governed by ops.workspace_event_archetypes, not by this constraint.';
