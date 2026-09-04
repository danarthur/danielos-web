/**
 * Network stars — per-user pins on entities.
 *
 * A star is personal and silent: it never changes which category an entity
 * belongs to, and colleagues cannot see it. That separation is the whole point
 * of Phase 2 -- the old `context_data.tier = 'preferred'` flag conflated "I
 * look at this a lot" with "this is a preferred vendor", and because zone
 * membership keyed off it, starring someone changed what kind of thing they
 * were.
 *
 * The shared judgement still lives on the relationship edge as tier; see
 * setRelationshipTier in relationship-actions.ts.
 *
 * @module features/network-data/api/star-actions
 */

'use server';

import 'server-only';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/shared/api/supabase/server';

type StarResult = { ok: true } | { ok: false; error: string };

/** Entity ids the current user has starred in this workspace. */
export async function listStarredEntityIds(workspaceId: string): Promise<string[]> {
  if (!workspaceId) return [];
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return [];

  const { data, error } = await supabase
    .schema('cortex')
    .from('network_stars')
    .select('entity_id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId);

  if (error || !data) return [];
  return data.map((r) => r.entity_id as string);
}

/**
 * Star an entity for the current user. Idempotent -- starring twice is not an
 * error, so a double click never surfaces one.
 */
export async function starEntity(workspaceId: string, entityId: string): Promise<StarResult> {
  if (!workspaceId || !entityId) return { ok: false, error: 'Missing workspace or entity.' };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return { ok: false, error: 'Not signed in.' };

  const { error } = await supabase
    .schema('cortex')
    .from('network_stars')
    .upsert(
      { workspace_id: workspaceId, user_id: userId, entity_id: entityId },
      { onConflict: 'workspace_id,user_id,entity_id', ignoreDuplicates: true },
    );

  if (error) return { ok: false, error: error.message };
  revalidatePath('/network');
  return { ok: true };
}

/** Remove the current user's star. Removing one that isn't there is a no-op. */
export async function unstarEntity(workspaceId: string, entityId: string): Promise<StarResult> {
  if (!workspaceId || !entityId) return { ok: false, error: 'Missing workspace or entity.' };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return { ok: false, error: 'Not signed in.' };

  const { error } = await supabase
    .schema('cortex')
    .from('network_stars')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .eq('entity_id', entityId);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/network');
  return { ok: true };
}
