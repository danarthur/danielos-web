-- Step 3: referral credit records the PERSON and freezes the ORG.
--
-- finance.referrals had one `counterparty_entity_id`, holding a person OR a
-- company depending on which card happened to be open when the referral was
-- logged. So "which planner sends us business" was unanswerable: the same
-- human referring twice from two agencies produced two unrelated rows, and a
-- planner changing agencies made their history unattributable either way.
--
-- WHY THE PERSON IS NAMED AND THE ORG IS FROZEN
-- Research (2026-09-03) landed on the axis being whether the credit is a
-- PAYABLE or RECOGNITION, not person-vs-company in the abstract:
--   * Where credit is money, it is org-bound and does not travel. Law-firm
--     origination credit is person-KEYED but firm-OWNED and explicitly
--     non-portable; on departure it shifts to whoever retains the client.
--   * Where credit is identification/judgment, the individual is named --
--     healthcare records a Type 1 (individual) NPI as the referring provider
--     precisely as an audit trail, while the Anti-Kickback Statute makes
--     PAYING that individual for the referral a felony. Naming a referrer and
--     crediting one are different acts.
--
-- This table's own header calls it "a lightweight working ledger, not a
-- compliance surface" -- a reciprocity ledger. That is the recognition bucket,
-- so the person is named and the org is recorded alongside, frozen.
--
-- *** CONSTRAINT FOR WHOEVER EXTENDS THIS ***
-- If a commission, payout or any payable is ever attached to this table, the
-- PAYEE MUST BE ORG-BOUND (counterparty_org_entity_id), not the person. Every
-- domain where money actually moves resolves to the entity. Hanging a payout
-- off counterparty_entity_id would invert established practice.
--
-- And never SUM person-credit with org-credit. They are two named buckets over
-- the same events (the industry terms are sourced vs influenced, or NPSP's
-- hard vs soft credit); adding them double-counts and produces attributed
-- revenue exceeding total revenue.

ALTER TABLE finance.referrals
  ADD COLUMN IF NOT EXISTS counterparty_org_entity_id      uuid,
  ADD COLUMN IF NOT EXISTS counterparty_name_at_referral   text,
  ADD COLUMN IF NOT EXISTS counterparty_org_name_at_referral text;

COMMENT ON COLUMN finance.referrals.counterparty_org_entity_id IS
  'Organization the counterparty belonged to WHEN THE REFERRAL HAPPENED. NULL when '
  'the counterparty is itself an org, or had no recorded employer. Frozen: never '
  're-resolved when they change jobs, so a past referral keeps explaining itself.';

COMMENT ON COLUMN finance.referrals.counterparty_name_at_referral IS
  'Frozen display_name of the counterparty at referral time. Same rule as '
  'ops.deal_stakeholders name snapshots (20260903180000): renaming an entity must '
  'never relabel history.';

COMMENT ON COLUMN finance.referrals.counterparty_org_name_at_referral IS
  'Frozen display_name of counterparty_org_entity_id at referral time.';

-- Roll-ups run per person and, separately, per org. Two buckets, never summed.
CREATE INDEX IF NOT EXISTS referrals_counterparty_org_idx
  ON finance.referrals (workspace_id, counterparty_org_entity_id)
  WHERE counterparty_org_entity_id IS NOT NULL;

/*
 * Current employer of a person entity, as an affiliation edge to a company.
 *
 * Depends on the dated edges from 20260903193000: `ended_at IS NULL` is what
 * makes "current" answerable at all. Before that, a person who had left still
 * looked employed, and this would have frozen the wrong org onto the referral.
 *
 * Explicit employment beats the PARTNER/ROSTER_MEMBER catch-alls, then oldest
 * edge wins, so the result is deterministic rather than whichever row Postgres
 * happened to return.
 */
CREATE OR REPLACE FUNCTION finance.current_employer_entity_id(p_person_entity_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, cortex, directory
AS $$
  SELECT r.target_entity_id
    FROM cortex.relationships r
    JOIN directory.entities e ON e.id = r.target_entity_id
   WHERE r.source_entity_id = p_person_entity_id
     AND r.ended_at IS NULL
     AND e.type = 'company'
     AND r.relationship_type IN
         ('MEMBER','EMPLOYEE','WORKS_FOR','EMPLOYED_AT','PARTNER','ROSTER_MEMBER')
   ORDER BY
     CASE r.relationship_type
       WHEN 'EMPLOYED_AT'   THEN 1
       WHEN 'EMPLOYEE'      THEN 2
       WHEN 'WORKS_FOR'     THEN 3
       WHEN 'MEMBER'        THEN 4
       WHEN 'ROSTER_MEMBER' THEN 5
       ELSE 6
     END,
     r.started_at NULLS LAST,
     r.created_at
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION finance.current_employer_entity_id(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION finance.current_employer_entity_id(uuid) TO authenticated, service_role;

-- log_referral gains the org dimension. The org argument is optional: when the
-- caller does not pass one and the counterparty is a person, their current
-- employer is resolved and frozen. Both names are stamped either way.
CREATE OR REPLACE FUNCTION finance.log_referral(
  p_workspace_id             uuid,
  p_direction                text,
  p_counterparty_entity_id   uuid,
  p_client_name              text DEFAULT NULL::text,
  p_client_entity_id         uuid DEFAULT NULL::uuid,
  p_related_deal_id          uuid DEFAULT NULL::uuid,
  p_note                     text DEFAULT NULL::text,
  p_counterparty_org_entity_id uuid DEFAULT NULL::uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'finance', 'public'
AS $function$
DECLARE
  v_user_id  uuid := auth.uid();
  v_id       uuid;
  v_type     text;
  v_org_id   uuid;
  v_name     text;
  v_org_name text;
BEGIN
  IF v_user_id IS NULL THEN RETURN NULL; END IF;
  IF p_direction NOT IN ('received', 'sent') THEN RETURN NULL; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE user_id = v_user_id AND workspace_id = p_workspace_id
  ) THEN RETURN NULL; END IF;

  SELECT type, display_name INTO v_type, v_name
    FROM directory.entities
   WHERE id = p_counterparty_entity_id AND owner_workspace_id = p_workspace_id;
  IF v_type IS NULL THEN RETURN NULL; END IF;

  IF p_client_entity_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM directory.entities
    WHERE id = p_client_entity_id AND owner_workspace_id = p_workspace_id
  ) THEN RETURN NULL; END IF;

  IF p_related_deal_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.deals
    WHERE id = p_related_deal_id AND workspace_id = p_workspace_id
  ) THEN RETURN NULL; END IF;

  -- An org counterparty is its own org context; nothing to resolve.
  IF v_type = 'company' THEN
    v_org_id := NULL;
  ELSE
    v_org_id := COALESCE(
      p_counterparty_org_entity_id,
      finance.current_employer_entity_id(p_counterparty_entity_id));
  END IF;

  -- Same-workspace guard on an explicitly supplied org.
  IF v_org_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM directory.entities
    WHERE id = v_org_id AND owner_workspace_id = p_workspace_id
  ) THEN RETURN NULL; END IF;

  SELECT display_name INTO v_org_name FROM directory.entities WHERE id = v_org_id;

  INSERT INTO finance.referrals (
    workspace_id, direction, counterparty_entity_id,
    counterparty_org_entity_id,
    counterparty_name_at_referral, counterparty_org_name_at_referral,
    client_name, client_entity_id, related_deal_id, note,
    created_by
  ) VALUES (
    p_workspace_id, p_direction, p_counterparty_entity_id,
    v_org_id,
    v_name, v_org_name,
    NULLIF(p_client_name, ''), p_client_entity_id, p_related_deal_id,
    NULLIF(p_note, ''),
    v_user_id
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION finance.log_referral(uuid,text,uuid,text,uuid,uuid,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION finance.log_referral(uuid,text,uuid,text,uuid,uuid,text,uuid)
  TO authenticated, service_role;

-- The 7-arg original would otherwise linger as an overload and keep writing
-- rows with no org context.
DROP FUNCTION IF EXISTS finance.log_referral(uuid,text,uuid,text,uuid,uuid,text);
