-- F1: venue name/address on events were stale snapshots.
--
-- ops.events.venue_name / venue_address are copies written at link time and
-- never refreshed. 9 of 11 deals and 2 of 3 linked events were missing them, so
-- the crew portal showed no address and no map link while the venue record held
-- a complete one.
--
-- directory.entity_address_text mirrors readEntityAddress + formatEntityAddress
-- in src/shared/lib/entity-address.ts. If you change one, change the other:
-- per-field precedence nested object -> top-level key, then formatted_address
-- as a whole-string fallback.

CREATE OR REPLACE FUNCTION directory.entity_address_text(p_attrs jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  WITH a AS (
    SELECT
      NULLIF(btrim(COALESCE(p_attrs->'address'->>'street',      p_attrs->>'street',      '')), '') AS street,
      NULLIF(btrim(COALESCE(p_attrs->'address'->>'city',        p_attrs->>'city',        '')), '') AS city,
      NULLIF(btrim(COALESCE(p_attrs->'address'->>'state',       p_attrs->>'state',       '')), '') AS state,
      NULLIF(btrim(COALESCE(p_attrs->'address'->>'postal_code', p_attrs->>'postal_code', '')), '') AS postal,
      NULLIF(btrim(COALESCE(p_attrs->>'formatted_address', '')), '') AS formatted
  )
  SELECT COALESCE(NULLIF(concat_ws(', ', street, city, state, postal), ''), formatted)
  FROM a;
$$;

COMMENT ON FUNCTION directory.entity_address_text(jsonb) IS
  'Single-line address for a directory entity. Mirrors readEntityAddress/formatEntityAddress in src/shared/lib/entity-address.ts.';

-- CREATE FUNCTION grants EXECUTE to PUBLIC by default.
REVOKE ALL ON FUNCTION directory.entity_address_text(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION directory.entity_address_text(jsonb) TO authenticated, service_role;

-- Resolve venue live from the linked entity; the stored snapshot stays only as a
-- fallback for rows with no venue_entity_id. security_invoker=true is preserved,
-- so the caller's RLS still governs which venue rows are visible.
CREATE OR REPLACE VIEW ops.entity_crew_schedule AS
 SELECT ca.id AS assignment_id,
    ca.entity_id,
    ca.event_id,
    ca.role,
    ca.status,
    ca.assignee_name,
    ca.call_time_slot_id,
    ca.call_time_override,
    ca.workspace_id,
    ca.pay_rate,
    ca.pay_rate_type,
    ca.scheduled_hours,
    ca.payment_status,
    ca.payment_date,
    ca.travel_stipend,
    ca.per_diem,
    ca.kit_fee,
    ca.overtime_hours,
    ca.overtime_rate,
    ca.bonus,
    e.title AS event_title,
    e.starts_at,
    e.ends_at,
    COALESCE(v.display_name, e.venue_name) AS venue_name,
    COALESCE(directory.entity_address_text(v.attributes), e.venue_address) AS venue_address,
    e.location_address,
    e.deal_id,
    e.event_archetype
   FROM ops.crew_assignments ca
     JOIN ops.events e ON e.id = ca.event_id
     LEFT JOIN directory.entities v ON v.id = e.venue_entity_id;
