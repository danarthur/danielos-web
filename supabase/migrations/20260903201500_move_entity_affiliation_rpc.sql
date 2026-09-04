-- Step 2, part 2: the write path for a job change.
--
-- cortex.relationships is SELECT-only under RLS by design (CLAUDE.md core
-- pattern 3 -- no INSERT/UPDATE/DELETE policies, ever, because that is the
-- privilege-escalation surface). So ending an affiliation has to go through a
-- SECURITY DEFINER RPC like every other cortex write.
--
-- The whole point is that this ENDS an edge instead of deleting it. After a
-- move, "Brandi worked at Brandi Jane Events until March" is still a fact the
-- database can state, and every deal she is stamped on still explains itself.
--
-- ROSTER_MEMBER IS DELIBERATELY NOT MOVABLE. It means "on someone's roster",
-- which has its own lifecycle and its own anti-lockout rules in
-- archiveRosterMember / removeRosterMember -- quietly ending one here would
-- drop a person off a team with none of those checks. The RPC reports any it
-- left behind as `roster_edges_left` rather than failing or silently skipping,
-- so the caller can surface it. On the current data that is exactly how the
-- mis-modelled ROSTER_MEMBER-to-an-external-company rows show up.

CREATE OR REPLACE FUNCTION cortex.move_entity_affiliation(
  p_person_entity_id       uuid,
  p_from_company_entity_id uuid,
  p_to_company_entity_id   uuid        DEFAULT NULL,  -- NULL = just leave, no new employer
  p_effective_at           timestamptz DEFAULT now(),
  p_new_relationship_type  text        DEFAULT 'MEMBER'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, cortex, directory
AS $$
DECLARE v_ws uuid; v_ended int; v_roster_left int; v_new_id uuid;
BEGIN
  IF p_new_relationship_type NOT IN ('MEMBER','EMPLOYEE','WORKS_FOR','EMPLOYED_AT','PARTNER') THEN
    RAISE EXCEPTION 'unsupported affiliation type: %', p_new_relationship_type;
  END IF;

  SELECT owner_workspace_id INTO v_ws FROM directory.entities WHERE id = p_person_entity_id;
  IF v_ws IS NULL THEN RAISE EXCEPTION 'person entity not found'; END IF;

  -- Dual-context guard: cron/webhook callers run as service_role with no
  -- auth.uid(), so a naive membership check would fail them silently.
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.workspace_members m
       WHERE m.workspace_id = v_ws AND m.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'access denied: entity not in caller workspace';
  END IF;

  IF p_to_company_entity_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM directory.entities
       WHERE id = p_to_company_entity_id AND owner_workspace_id = v_ws) THEN
    RAISE EXCEPTION 'target company not in the same workspace';
  END IF;

  UPDATE cortex.relationships
     SET ended_at = p_effective_at
   WHERE source_entity_id = p_person_entity_id
     AND target_entity_id = p_from_company_entity_id
     AND ended_at IS NULL
     AND relationship_type IN ('MEMBER','EMPLOYEE','WORKS_FOR','EMPLOYED_AT','PARTNER');
  GET DIAGNOSTICS v_ended = ROW_COUNT;

  SELECT count(*) INTO v_roster_left FROM cortex.relationships
   WHERE source_entity_id = p_person_entity_id
     AND target_entity_id = p_from_company_entity_id
     AND ended_at IS NULL AND relationship_type = 'ROSTER_MEMBER';

  IF p_to_company_entity_id IS NOT NULL THEN
    INSERT INTO cortex.relationships
      (source_entity_id, target_entity_id, relationship_type, started_at, context_data)
    VALUES (p_person_entity_id, p_to_company_entity_id, p_new_relationship_type,
            p_effective_at, '{}'::jsonb)
    -- Rejoining a former employer is legitimate; the partial index only blocks
    -- a duplicate CURRENT edge, which here means "already works there".
    ON CONFLICT (source_entity_id, target_entity_id, relationship_type)
      WHERE ended_at IS NULL DO NOTHING
    RETURNING id INTO v_new_id;
  END IF;

  RETURN jsonb_build_object(
    'ended', v_ended,
    'roster_edges_left', v_roster_left,
    'new_edge_id', v_new_id);
END $$;

-- Postgres grants EXECUTE to PUBLIC by default; every SECURITY DEFINER
-- function in this repo revokes explicitly (see 20260410160000).
REVOKE ALL ON FUNCTION cortex.move_entity_affiliation(uuid,uuid,uuid,timestamptz,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION cortex.move_entity_affiliation(uuid,uuid,uuid,timestamptz,text)
  TO authenticated, service_role;
