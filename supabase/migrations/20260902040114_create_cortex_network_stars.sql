-- Phase 2: split the star from the tier.
--
-- context_data.tier = 'preferred' on a cortex.relationships edge used to do two
-- unrelated jobs: "this is a preferred vendor" (a shared business fact) and
-- "I look at this one a lot" (one person's shortcut). Because zone membership
-- keyed off it, starring someone changed what kind of thing they were.
--
-- Tier stays on the edge. The star moves here, per-user.
--
-- Placed in cortex alongside the other per-user UX state (ui_notices,
-- aion_user_signal_mutes) rather than in directory, which holds entity
-- metadata shared by the whole workspace.

CREATE TABLE IF NOT EXISTS cortex.network_stars (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES auth.users(id)         ON DELETE CASCADE,
  entity_id    uuid NOT NULL REFERENCES directory.entities(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id, entity_id)
);

COMMENT ON TABLE cortex.network_stars IS
  'Per-user pins on network entities. Personal and silent: invisible to colleagues and never affects category membership. The shared "preferred" judgement lives on the relationship edge as context_data.tier.';

CREATE INDEX IF NOT EXISTS network_stars_user_workspace_idx
  ON cortex.network_stars (user_id, workspace_id);

ALTER TABLE cortex.network_stars ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS network_stars_select ON cortex.network_stars;
CREATE POLICY network_stars_select ON cortex.network_stars
  FOR SELECT USING (
    user_id = auth.uid()
    AND workspace_id IN (SELECT get_my_workspace_ids())
  );

DROP POLICY IF EXISTS network_stars_insert ON cortex.network_stars;
CREATE POLICY network_stars_insert ON cortex.network_stars
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND workspace_id IN (SELECT get_my_workspace_ids())
  );

DROP POLICY IF EXISTS network_stars_delete ON cortex.network_stars;
CREATE POLICY network_stars_delete ON cortex.network_stars
  FOR DELETE USING (
    user_id = auth.uid()
    AND workspace_id IN (SELECT get_my_workspace_ids())
  );

-- No UPDATE policy or grant: a star has no mutable fields. Add or remove it.
GRANT SELECT, INSERT, DELETE ON cortex.network_stars TO authenticated;
GRANT ALL ON cortex.network_stars TO service_role;
