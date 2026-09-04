-- Tables that shipped with RLS policies but no GRANTs: every call failed with
-- "permission denied" before RLS was ever consulted. Same class as the
-- aion_insights gap (2026-06-11) and directory.entity_documents.
--
-- Each table is granted exactly the commands its own policies already gate --
-- no more. RLS continues to enforce workspace isolation on every one.
--
-- cortex.aion_refusal_log is deliberately excluded: it has a SELECT policy but
-- no direct .from() caller in app code (written via service role), so it stays
-- ungranted rather than widening surface for an unused path.

-- ops: event-flow features (call-time rules, ROS templates, expenses, gear drift)
GRANT SELECT, INSERT, UPDATE, DELETE ON ops.workspace_call_time_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ops.workspace_ros_templates  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ops.event_expenses            TO authenticated;
GRANT SELECT, INSERT                 ON ops.gear_drift_dismissals     TO authenticated;

GRANT ALL ON ops.workspace_call_time_rules TO service_role;
GRANT ALL ON ops.workspace_ros_templates   TO service_role;
GRANT ALL ON ops.event_expenses            TO service_role;
GRANT ALL ON ops.gear_drift_dismissals     TO service_role;

-- cortex: read-only for authenticated, preserving cortex write protection.
-- ui_notices additionally has an UPDATE policy (dismissing a notice).
GRANT SELECT         ON cortex.aion_memory             TO authenticated;
GRANT SELECT         ON cortex.memory                  TO authenticated;
GRANT SELECT         ON cortex.consent_log             TO authenticated;
GRANT SELECT         ON cortex.feature_access_requests TO authenticated;
GRANT SELECT, UPDATE ON cortex.ui_notices              TO authenticated;

GRANT ALL ON cortex.aion_memory             TO service_role;
GRANT ALL ON cortex.memory                  TO service_role;
GRANT ALL ON cortex.consent_log             TO service_role;
GRANT ALL ON cortex.feature_access_requests TO service_role;
GRANT ALL ON cortex.ui_notices              TO service_role;
