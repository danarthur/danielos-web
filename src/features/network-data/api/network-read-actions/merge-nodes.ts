/**
 * Collapse one-node-per-edge into one node per entity.
 *
 * Lives outside stream.ts because that file is 'use server' and may only export
 * async functions -- exporting this helper from there fails the build with
 * "A 'use server' file can only export async functions, found object."
 */

import type { NetworkNode } from '@/entities/network';
import { rolesOf } from '@/entities/network/model/categories';

/** Most-specific-wins ordering when one entity holds several kinds of edge. */
const KIND_RANK: Record<NetworkNode['kind'], number> = {
  internal_employee: 0,
  extended_team: 1,
  external_partner: 2,
};
const GRAVITY_RANK: Record<NetworkNode['gravity'], number> = {
  core: 0,
  inner_circle: 1,
  outer_orbit: 2,
};

/**
 * Collapse one-node-per-edge into one node per entity.
 *
 * Nodes are built from cortex.relationships edges, and an entity can hold more
 * than one: a venue that also sub-rents gear (VENUE_PARTNER + VENDOR), a client
 * whose AV manager freelances (CLIENT + PARTNER). Before this, each edge became
 * its own row, so the same human appeared twice -- often in two different zones,
 * with nothing to indicate they were one person.
 *
 * The most specific node wins for identity and meta (employee over partner,
 * inner circle over outer orbit); `roles` carries the union so downstream code
 * can place an entity in every category it genuinely belongs to.
 */
export function mergeNodesByEntity(nodes: NetworkNode[]): NetworkNode[] {
  const byEntity = new Map<string, NetworkNode>();

  for (const node of nodes) {
    const key = node.entityId;
    const existing = byEntity.get(key);
    const ownRoles: NetworkNode['roles'] = rolesOf(node);

    if (!existing) {
      byEntity.set(key, { ...node, roles: [...ownRoles] });
      continue;
    }

    const merged = new Set<string>([...(existing.roles ?? []), ...ownRoles]);
    const nodeWins =
      KIND_RANK[node.kind] < KIND_RANK[existing.kind]
      || (KIND_RANK[node.kind] === KIND_RANK[existing.kind]
          && GRAVITY_RANK[node.gravity] < GRAVITY_RANK[existing.gravity]);

    const winner = nodeWins ? node : existing;
    byEntity.set(key, {
      ...winner,
      roles: [...merged] as NetworkNode['roles'],
      meta: {
        // Keep whichever side actually found a value -- balance and referral
        // counts are looked up per edge, so the losing node may hold the only
        // copy.
        ...existing.meta,
        ...winner.meta,
        outstanding_balance: winner.meta.outstanding_balance ?? existing.meta.outstanding_balance,
        referral_count: winner.meta.referral_count ?? existing.meta.referral_count,
        email: winner.meta.email ?? existing.meta.email,
      },
    });
  }

  return [...byEntity.values()];
}
