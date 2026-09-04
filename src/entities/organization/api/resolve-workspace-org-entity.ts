import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Resolve the directory entity that represents the workspace's OWN organization.
 *
 * Why this exists: call sites used to do
 *
 *   .eq('owner_workspace_id', ws).eq('type', 'company')
 *   .or('attributes->>is_ghost.is.null,attributes->>is_ghost.neq.true')
 *   .maybeSingle()
 *
 * The `is_ghost IS NULL` arm is there to catch pre-Ghost-Protocol orgs, but it
 * also matches any ghost company written without the flag. As soon as a
 * workspace has one of those, the filter returns two rows and `.maybeSingle()`
 * fails outright — callers that ignored the error silently skipped whatever
 * they were doing. That is how venues created from the events page ended up
 * with no cortex edge and invisible on the network page.
 *
 * The real workspace org is distinguishable: it carries a `legacy_org_id` and
 * is not flagged as a ghost. Rather than assume exactly one row, order so the
 * real org sorts first and take it.
 *
 * @returns the entity id, or null when the workspace genuinely has no org.
 */
export async function resolveWorkspaceOrgEntityId(
  // The three clients differ structurally; only .schema().from() is used here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  workspaceId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .schema('directory')
    .from('entities')
    .select('id')
    .eq('owner_workspace_id', workspaceId)
    .eq('type', 'company')
    // NULL-safe: keep pre-ghost-protocol orgs, which have no is_ghost flag.
    .or('attributes->>is_ghost.is.null,attributes->>is_ghost.neq.true')
    // Real orgs carry legacy_org_id; ghosts do not. Oldest wins any remaining tie.
    .order('legacy_org_id', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
    .limit(1);

  if (error || !data || data.length === 0) {
    // Callers guard on null and skip writing their cortex edge, which is how
    // entities end up orphaned and invisible on the network page. Leave a trace
    // so the next occurrence is diagnosable instead of silent.
    console.error(
      '[resolveWorkspaceOrgEntityId] no org entity for workspace',
      workspaceId,
      error?.message ?? '(no rows)',
    );
    return null;
  }
  return (data[0] as { id: string }).id;
}
