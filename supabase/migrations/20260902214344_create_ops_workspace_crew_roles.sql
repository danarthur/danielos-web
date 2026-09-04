-- Phase 4: a controlled craft vocabulary for roster members.
--
-- NOT to be confused with ops.workspace_roles, which is the PERMISSION role
-- table (owner / admin / member / employee / observer / client) managed by the
-- Role Builder. Craft and access are different axes: someone being a DJ says
-- nothing about what they may read, and most of a roster are ghosts with no
-- login at all.
--
-- Assignments reuse the existing ops.crew_skills.role_tag column, which was
-- added for exactly this and had never been populated (NULL on every row).
-- ops.archetype_role_requirements and get-role-pools.ts already read role_tag,
-- so those features were dark for want of a vocabulary.
--
-- skill_tag stays free-form -- what a person CAN DO. role_tag is controlled --
-- what they ARE. skill_tag already held both 'dj' and 'DJ' as separate values,
-- which is the fragmentation a controlled vocabulary exists to prevent.

CREATE TABLE IF NOT EXISTS ops.workspace_crew_roles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  slug         text NOT NULL,
  label        text NOT NULL,
  sort_order   integer NOT NULL DEFAULT 0,
  archived_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_crew_roles_slug_chk
    CHECK (slug ~ '^[a-z0-9_]+$' AND length(slug) BETWEEN 1 AND 60),
  CONSTRAINT workspace_crew_roles_label_chk
    CHECK (length(btrim(label)) BETWEEN 1 AND 60),
  CONSTRAINT workspace_crew_roles_unique_slug UNIQUE (workspace_id, slug)
);

COMMENT ON TABLE ops.workspace_crew_roles IS
  'Per-workspace craft vocabulary for roster members (DJ, Audio, Rigging). Assignments live in ops.crew_skills.role_tag. Distinct from ops.workspace_roles, which governs permissions. Archive rather than delete so existing assignments never dangle.';

CREATE INDEX IF NOT EXISTS workspace_crew_roles_active_idx
  ON ops.workspace_crew_roles (workspace_id, sort_order)
  WHERE archived_at IS NULL;

ALTER TABLE ops.workspace_crew_roles ENABLE ROW LEVEL SECURITY;

-- Any member reads the vocabulary; only owners and admins change it, matching
-- how the event-archetype taxonomy is governed.
DROP POLICY IF EXISTS workspace_crew_roles_select ON ops.workspace_crew_roles;
CREATE POLICY workspace_crew_roles_select ON ops.workspace_crew_roles
  FOR SELECT USING (workspace_id IN (SELECT get_my_workspace_ids()));

DROP POLICY IF EXISTS workspace_crew_roles_insert ON ops.workspace_crew_roles;
CREATE POLICY workspace_crew_roles_insert ON ops.workspace_crew_roles
  FOR INSERT WITH CHECK (user_has_workspace_role(workspace_id, ARRAY['owner','admin']));

DROP POLICY IF EXISTS workspace_crew_roles_update ON ops.workspace_crew_roles;
CREATE POLICY workspace_crew_roles_update ON ops.workspace_crew_roles
  FOR UPDATE USING (user_has_workspace_role(workspace_id, ARRAY['owner','admin']));

DROP POLICY IF EXISTS workspace_crew_roles_delete ON ops.workspace_crew_roles;
CREATE POLICY workspace_crew_roles_delete ON ops.workspace_crew_roles
  FOR DELETE USING (user_has_workspace_role(workspace_id, ARRAY['owner','admin']));

GRANT SELECT, INSERT, UPDATE, DELETE ON ops.workspace_crew_roles TO authenticated;
GRANT ALL ON ops.workspace_crew_roles TO service_role;
