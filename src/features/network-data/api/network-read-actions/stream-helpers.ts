/**
 * Small pure/IO helpers lifted out of stream.ts, which had grown past the
 * 300-line file cap. Kept deliberately branch-light so this module stays clean.
 */

import type { NetworkNode } from '@/entities/network';
import { PERSON_ATTR, COUPLE_ATTR } from '../../model/attribute-keys';

export async function fetchStarredEntityIds(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- cross-schema row shape is resolved at runtime; narrowing here would duplicate the generated types.
  supabase: any,
  workspaceId: string | null,
): Promise<Set<string>> {
  if (!workspaceId) return new Set();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id;
  if (!userId) return new Set();

  const { data } = await supabase
    .schema('cortex')
    .from('network_stars')
    .select('entity_id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId);

  return new Set(((data ?? []) as { entity_id: string }[]).map((r) => r.entity_id));
}

export function withStars(starred: Set<string>, nodes: NetworkNode[]): NetworkNode[] {
  if (starred.size === 0) return nodes;
  return nodes.map((n) => (starred.has(n.entityId) ? { ...n, starred: true } : n));
}

export function withCrewRoles(roles: Map<string, string[]>, nodes: NetworkNode[]): NetworkNode[] {
  if (roles.size === 0) return nodes;
  return nodes.map((n) => {
    const r = roles.get(n.entityId);
    return r?.length ? { ...n, crewRoles: r } : n;
  });
}

/**
 * Contact email for a node.
 *
 * Reads through COUPLE_ATTR / PERSON_ATTR rather than a bare key so a couple
 * entity never ghost-reads an email preserved from a prior person -> couple
 * reclassification.
 */
export function readContactEmail(
  entityType: string | undefined,
  attrs: Record<string, unknown>,
): string | undefined {
  if (entityType === 'couple') return (attrs[COUPLE_ATTR.partner_a_email] as string) ?? undefined;
  if (entityType === 'person') return (attrs[PERSON_ATTR.email] as string) ?? undefined;
  return undefined;
}

/**
 * Display label: clients (couple or individual) label as 'Client'; freelancer
 * persons fall back to job_title -> 'Freelancer'; everyone else uses the
 * cortex-type label ('Vendor' / 'Venue' / 'Partner').
 */
export function resolveNodeLabel(
  relType: string | undefined,
  entityType: string | undefined,
  personJobTitle: string | null | undefined,
  cortexLabel: string,
): string {
  if (relType === 'CLIENT') return 'Client';
  if (entityType === 'person') return personJobTitle || 'Freelancer';
  return cortexLabel;
}

/**
 * Crew skills and roles from ops.crew_skills rows.
 *
 * role_tag is the controlled value that grouping reads, while skill_tag keeps
 * whatever was originally typed -- which is what lets historic 'dj' and 'DJ'
 * rows group as one role.
 */
export function indexCrewSkills(
  rows: { entity_id: string; skill_tag: string; role_tag?: string | null }[] | null | undefined,
): { crewSkillsByEntityId: Map<string, string[]>; crewRolesByEntityId: Map<string, string[]> } {
  const crewSkillsByEntityId = new Map<string, string[]>();
  const crewRolesByEntityId = new Map<string, string[]>();

  for (const row of rows ?? []) {
    const list = crewSkillsByEntityId.get(row.entity_id) ?? [];
    list.push(row.skill_tag);
    crewSkillsByEntityId.set(row.entity_id, list);

    const roleTag = row.role_tag;
    if (!roleTag) continue;
    const roles = crewRolesByEntityId.get(row.entity_id) ?? [];
    if (!roles.includes(roleTag)) roles.push(roleTag);
    crewRolesByEntityId.set(row.entity_id, roles);
  }
  return { crewSkillsByEntityId, crewRolesByEntityId };
}

/** Group one string column per entity_id. */
export function indexByEntity(
  rows: unknown[] | null | undefined,
  field: string,
): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const raw of (rows ?? []) as Record<string, string>[]) {
    const list = out.get(raw.entity_id) ?? [];
    list.push(raw[field]);
    out.set(raw.entity_id, list);
  }
  return out;
}

/** Sum `valueField` per `keyField`. */
export function sumBy(
  rows: unknown[] | null | undefined,
  keyField: string,
  valueField: string,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const raw of (rows ?? []) as Record<string, string | number | null>[]) {
    const key = raw[keyField] as string;
    out.set(key, (out.get(key) ?? 0) + ((raw[valueField] as number) ?? 0));
  }
  return out;
}

/** Count rows per `keyField`. */
export function countBy(
  rows: unknown[] | null | undefined,
  keyField: string,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const raw of (rows ?? []) as Record<string, string>[]) {
    const key = raw[keyField];
    out.set(key, (out.get(key) ?? 0) + 1);
  }
  return out;
}
