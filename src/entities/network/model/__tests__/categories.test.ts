/**
 * Category derivation — membership comes from role edges, never from the star.
 *
 * Regression: zones were derived from `gravity`, so starring someone changed
 * which zone they appeared in, and unstarred clients landed in the same
 * undifferentiated bucket as unstarred freelancers.
 */

import { describe, it, expect } from 'vitest';
import { categoriesOf, isInCategory, isUnsorted, CATEGORY_ORDER } from '../categories';
import type { NetworkNode } from '../types';

function node(over: Partial<NetworkNode>): NetworkNode {
  return {
    id: 'e1',
    entityId: 'ent1',
    kind: 'external_partner',
    gravity: 'outer_orbit',
    identity: { name: 'Someone', avatarUrl: null, label: '' },
    meta: {},
    ...over,
  } as NetworkNode;
}

describe('categoriesOf', () => {
  it('places each role edge in its category', () => {
    expect(categoriesOf(node({ roles: ['CLIENT'] }))).toEqual(['clients']);
    expect(categoriesOf(node({ roles: ['VENDOR'] }))).toEqual(['vendors']);
    expect(categoriesOf(node({ roles: ['VENUE_PARTNER'] }))).toEqual(['venues']);
    expect(categoriesOf(node({ roles: ['ROSTER_MEMBER'] }))).toEqual(['roster']);
    expect(categoriesOf(node({ roles: ['PARTNER'] }))).toEqual(['roster']);
  });

  it('puts a multi-role entity in every category it belongs to', () => {
    // "1909" in the live workspace — a venue that also sub-rents gear.
    expect(categoriesOf(node({ roles: ['VENUE_PARTNER', 'VENDOR'] })))
      .toEqual(['vendors', 'venues']);
    // Alex Barnhart — a client who is also a partner.
    expect(categoriesOf(node({ roles: ['CLIENT', 'PARTNER'] })))
      .toEqual(['clients', 'roster']);
  });

  it('returns categories in the fixed order regardless of role order', () => {
    const a = categoriesOf(node({ roles: ['VENUE_PARTNER', 'CLIENT', 'VENDOR'] }));
    expect(a).toEqual(['clients', 'vendors', 'venues']);
    expect(CATEGORY_ORDER.indexOf('clients')).toBe(0);
  });

  it('does not let the star change membership', () => {
    // The whole point: gravity is a preference axis and must not affect category.
    const starred = node({ roles: ['CLIENT'], gravity: 'inner_circle' });
    const plain = node({ roles: ['CLIENT'], gravity: 'outer_orbit' });
    expect(categoriesOf(starred)).toEqual(categoriesOf(plain));
  });

  it('treats employees and extended team as roster even with no role edge', () => {
    expect(categoriesOf(node({ kind: 'internal_employee', roles: [] }))).toEqual(['roster']);
    expect(categoriesOf(node({ kind: 'extended_team', roles: [] }))).toEqual(['roster']);
  });

  it('falls back to relationshipType for nodes built before roles existed', () => {
    expect(categoriesOf(node({ relationshipType: 'CLIENT' }))).toEqual(['clients']);
  });

  it('reports nodes with no recognised role as unsorted, not as a category', () => {
    const orphan = node({ roles: [] });
    expect(categoriesOf(orphan)).toEqual([]);
    expect(isUnsorted(orphan)).toBe(true);
    expect(isUnsorted(node({ roles: ['CLIENT'] }))).toBe(false);
  });

  it('isInCategory matches every category a node holds', () => {
    const n = node({ roles: ['CLIENT', 'PARTNER'] });
    expect(isInCategory(n, 'clients')).toBe(true);
    expect(isInCategory(n, 'roster')).toBe(true);
    expect(isInCategory(n, 'vendors')).toBe(false);
  });
});
