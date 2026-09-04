/**
 * Workspace label pack — the display vocabulary for network categories.
 *
 * Presentation only. Category keys stay immutable and are what filters,
 * exports, telemetry and Aion tools speak; this decides the words a workspace
 * sees for them.
 *
 * @module features/network-data/api/label-pack-actions
 */

'use server';

import 'server-only';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/shared/api/supabase/server';
import { toLabelPack, type LabelPack } from '@/entities/network/model/label-packs';

/** The workspace's chosen pack, falling back to the default for any unknown value. */
export async function getWorkspaceLabelPack(workspaceId: string | null): Promise<LabelPack> {
  if (!workspaceId) return toLabelPack(null);
  const supabase = await createClient();
  const { data } = await supabase
    .from('workspaces')
    .select('network_label_pack')
    .eq('id', workspaceId)
    .maybeSingle();
  return toLabelPack((data as { network_label_pack?: string } | null)?.network_label_pack ?? null);
}

/**
 * Change the workspace's vocabulary.
 *
 * The value is constrained by a CHECK on the column, so an unknown pack is
 * rejected by the database rather than silently rendering blank labels.
 */
export async function setWorkspaceLabelPack(
  workspaceId: string,
  pack: LabelPack,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!workspaceId) return { ok: false, error: 'Missing workspace.' };
  const supabase = await createClient();
  const { error } = await supabase
    .from('workspaces')
    .update({ network_label_pack: pack })
    .eq('id', workspaceId);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/network');
  revalidatePath('/settings');
  return { ok: true };
}
