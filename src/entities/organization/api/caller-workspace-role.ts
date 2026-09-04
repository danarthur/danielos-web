import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * The signed-in user's role in the workspace that owns an org.
 *
 * WHY THIS EXISTS
 * Five separate call sites had independently written "read the caller's
 * ROSTER_MEMBER edge and check context_data.role". That is the wrong source of
 * truth and it locked real owners out of their own workspace: an owner's entity
 * carries a MEMBER edge, not ROSTER_MEMBER, so the lookup found nothing, the
 * role read as empty, and the gate denied them. On the pilot workspace NOBODY
 * could manage the roster -- the only record holding role='admin' was an
 * unclaimed ghost that no one can sign in as.
 *
 * `public.workspace_members.role` is the authority. A cortex.relationships edge
 * is a fact about the graph, written by ghost and invite flows that never
 * intended to grant anything; it drifts from real membership silently.
 *
 * Deliberately does NOT require the caller to have a directory entity of their
 * own. Administering a workspace is not the same as appearing in its contacts,
 * and requiring both is what made a legitimate member fail with
 * "Account not linked".
 */
export async function getCallerWorkspaceRole(
  // The three clients differ structurally; only .schema()/.from() are used here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- accepts any of the three Supabase clients.
  supabase: SupabaseClient<any, any, any>,
  org: { entityId: string } | { legacyOrgId: string },
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const query = supabase
    .schema('directory')
    .from('entities')
    .select('owner_workspace_id');

  const { data: orgEnt } =
    'entityId' in org
      ? await query.eq('id', org.entityId).maybeSingle()
      : await query.eq('legacy_org_id', org.legacyOrgId).maybeSingle();

  const workspaceId = (orgEnt as { owner_workspace_id: string | null } | null)
    ?.owner_workspace_id;
  if (!workspaceId) return null;

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  return (membership as { role: string } | null)?.role ?? null;
}

/** Convenience wrapper: owner or admin of the workspace that owns this org. */
export async function callerIsWorkspaceAdmin(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- accepts any of the three Supabase clients.
  supabase: SupabaseClient<any, any, any>,
  org: { entityId: string } | { legacyOrgId: string },
): Promise<boolean> {
  const role = await getCallerWorkspaceRole(supabase, org);
  return role === 'owner' || role === 'admin';
}
