/**
 * Crew role vocabulary — the controlled craft list for roster members.
 *
 * Distinct from ops.workspace_roles, which governs PERMISSIONS via the Role
 * Builder. Craft and access are different axes: a ghost freelancer with no
 * login is still a DJ.
 *
 * Assignments annotate ops.crew_skills.role_tag. That table is uniquely keyed
 * on (entity_id, workspace_id, skill_tag) with skill_tag NOT NULL, so a role is
 * recorded by tagging a skill row rather than as a row of its own. skill_tag
 * keeps whatever was typed; role_tag carries the normalised value that grouping
 * and get-role-pools read.
 *
 * @module features/network-data/api/crew-role-actions
 */

'use server';

import 'server-only';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/shared/api/supabase/server';
import {
  roleSeedsFor,
  normalizeRoleLabel,
} from '@/entities/network/model/role-vocabulary';
import type { LabelPack } from '@/entities/network/model/label-packs';

export interface CrewRole {
  id: string;
  slug: string;
  label: string;
  sortOrder: number;
}

type Result = { ok: true } | { ok: false; error: string };

/** The workspace's active crew roles, in display order. */
export async function listCrewRoles(workspaceId: string): Promise<CrewRole[]> {
  if (!workspaceId) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema('ops')
    .from('workspace_crew_roles')
    .select('id, slug, label, sort_order')
    .eq('workspace_id', workspaceId)
    .is('archived_at', null)
    .order('sort_order', { ascending: true })
    .order('label', { ascending: true });

  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id as string,
    slug: r.slug as string,
    label: r.label as string,
    sortOrder: (r.sort_order as number) ?? 0,
  }));
}

/**
 * Seed the vocabulary from the workspace's label pack.
 *
 * Idempotent, and never overwrites: existing slugs are left exactly as they
 * are. Seeding is what makes this cheap to adopt -- nobody curates a list they
 * had to invent from scratch.
 */
export async function seedCrewRoles(workspaceId: string, pack: LabelPack): Promise<Result> {
  if (!workspaceId) return { ok: false, error: 'Missing workspace.' };
  const supabase = await createClient();
  const seeds = roleSeedsFor(pack);

  const { error } = await supabase
    .schema('ops')
    .from('workspace_crew_roles')
    .upsert(
      seeds.map((s, i) => ({
        workspace_id: workspaceId,
        slug: s.slug,
        label: s.label,
        sort_order: i,
      })),
      { onConflict: 'workspace_id,slug', ignoreDuplicates: true },
    );

  if (error) return { ok: false, error: error.message };
  revalidatePath('/settings/network-tags');
  revalidatePath('/network');
  return { ok: true };
}

/** Add one role. The slug is normalised so "DJ" and "dj" cannot both exist. */
export async function createCrewRole(workspaceId: string, label: string): Promise<Result> {
  const trimmed = label?.trim();
  if (!workspaceId || !trimmed) return { ok: false, error: 'Give the role a name.' };
  const slug = normalizeRoleLabel(trimmed);
  if (!slug) return { ok: false, error: 'That name has no usable characters.' };

  const supabase = await createClient();
  const { error } = await supabase
    .schema('ops')
    .from('workspace_crew_roles')
    .upsert(
      { workspace_id: workspaceId, slug, label: trimmed, sort_order: 100 },
      { onConflict: 'workspace_id,slug', ignoreDuplicates: true },
    );

  if (error) return { ok: false, error: error.message };
  revalidatePath('/settings/network-tags');
  return { ok: true };
}

/**
 * Archive a role rather than deleting it, so people already tagged with it keep
 * a meaningful value instead of pointing at nothing.
 */
export async function archiveCrewRole(workspaceId: string, slug: string): Promise<Result> {
  if (!workspaceId || !slug) return { ok: false, error: 'Missing role.' };
  const supabase = await createClient();
  const { error } = await supabase
    .schema('ops')
    .from('workspace_crew_roles')
    .update({ archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('workspace_id', workspaceId)
    .eq('slug', slug);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/settings/network-tags');
  revalidatePath('/network');
  return { ok: true };
}

/** Role slugs currently recorded for a person. */
export async function getEntityRoles(workspaceId: string, entityId: string): Promise<string[]> {
  if (!workspaceId || !entityId) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .schema('ops')
    .from('crew_skills')
    .select('role_tag')
    .eq('workspace_id', workspaceId)
    .eq('entity_id', entityId)
    .not('role_tag', 'is', null);

  const tags = ((data ?? []) as { role_tag: string | null }[])
    .map((r) => r.role_tag)
    .filter((t): t is string => !!t);
  return [...new Set(tags)];
}

/**
 * Replace a person's roles.
 *
 * Roles are multi-value on purpose: in live events dual-role is the norm -- the
 * DJ who also MCs, the tech who also drives. A single-value field forces a false
 * choice and the person then goes missing from a search they should match.
 *
 * Rows whose skill_tag already matches a role keep that skill and are simply
 * re-tagged; roles with no matching skill row get one whose skill_tag is the
 * role label, since skill_tag is NOT NULL.
 */
export async function setEntityRoles(
  workspaceId: string,
  entityId: string,
  slugs: string[],
): Promise<Result> {
  if (!workspaceId || !entityId) return { ok: false, error: 'Missing workspace or person.' };
  const supabase = await createClient();

  const valid = new Set((await listCrewRoles(workspaceId)).map((r) => r.slug));
  const wanted = [...new Set(slugs.filter((s) => valid.has(s)))];

  const { data: existingRows } = await supabase
    .schema('ops')
    .from('crew_skills')
    .select('id, skill_tag, role_tag')
    .eq('workspace_id', workspaceId)
    .eq('entity_id', entityId);

  const rows = (existingRows ?? []) as { id: string; skill_tag: string; role_tag: string | null }[];

  // Clear role_tag on rows whose role is no longer wanted. The skill itself is
  // left alone -- losing a role should not erase what someone can do.
  const toClear = rows.filter((r) => r.role_tag && !wanted.includes(r.role_tag));
  for (const row of toClear) {
    await supabase.schema('ops').from('crew_skills')
      .update({ role_tag: null, updated_at: new Date().toISOString() })
      .eq('id', row.id);
  }

  for (const slug of wanted) {
    if (rows.some((r) => r.role_tag === slug)) continue;

    // Prefer re-tagging an existing skill row that clearly means this role,
    // which is also how the historic "dj" / "DJ" split gets reconciled.
    const match = rows.find((r) => normalizeRoleLabel(r.skill_tag) === slug && !r.role_tag);
    if (match) {
      await supabase.schema('ops').from('crew_skills')
        .update({ role_tag: slug, updated_at: new Date().toISOString() })
        .eq('id', match.id);
      continue;
    }

    const label = (await listCrewRoles(workspaceId)).find((r) => r.slug === slug)?.label ?? slug;
    const { error } = await supabase.schema('ops').from('crew_skills').upsert(
      { workspace_id: workspaceId, entity_id: entityId, skill_tag: label, role_tag: slug, verified: false },
      { onConflict: 'entity_id,workspace_id,skill_tag', ignoreDuplicates: false },
    );
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath('/network');
  return { ok: true };
}
