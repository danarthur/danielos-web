/**
 * mergeNodesByEntity — one node per entity, not one per edge.
 *
 * Regression: network nodes were built one-per-cortex-edge, so an entity holding
 * more than one role rendered as two separate rows, often in two different
 * zones, with nothing to indicate they were the same record. In the live pilot
 * workspace this affected three records: a venue that is also a vendor, a client
 * who is also a partner, and a company that is both partner and vendor.
 */

import { describe, it, expect } from 'vitest';
import { mergeNodesByEntity } from '../merge-nodes';
import type { NetworkNode } from '@/entities/network';

function node(over: Partial<NetworkNode> & { entityId: string }): NetworkNode {
  return {
    id: `edge-${Math.abs(hash(JSON.stringify(over)))}`,
    kind: 'external_partner',
    gravity: 'outer_orbit',
    identity: { name: 'Someone', avatarUrl: null, label: 'Partner' },
    meta: {},
    ...over,
  } as NetworkNode;
}
function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

describe('mergeNodesByEntity', () => {
  it('collapses an entity holding two roles into one node', () => {
    // "1909" in the live workspace: a venue that also sub-rents gear.
    const merged = mergeNodesByEntity([
      node({ entityId: 'venue-1909', relationshipType: 'VENUE_PARTNER', identity: { name: '1909', avatarUrl: null, label: 'Venue' } }),
      node({ entityId: 'venue-1909', relationshipType: 'VENDOR', identity: { name: '1909', avatarUrl: null, label: 'Vendor' } }),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].roles).toEqual(expect.arrayContaining(['VENUE_PARTNER', 'VENDOR']));
    expect(merged[0].roles).toHaveLength(2);
  });

  it('leaves distinct entities alone', () => {
    const merged = mergeNodesByEntity([
      node({ entityId: 'a', relationshipType: 'CLIENT' }),
      node({ entityId: 'b', relationshipType: 'VENDOR' }),
    ]);
    expect(merged).toHaveLength(2);
  });

  it('keeps the most specific node for identity — employee beats partner', () => {
    const merged = mergeNodesByEntity([
      node({ entityId: 'p1', kind: 'external_partner', gravity: 'outer_orbit', relationshipType: 'VENDOR',
             identity: { name: 'Partner view', avatarUrl: null, label: 'Vendor' } }),
      node({ entityId: 'p1', kind: 'internal_employee', gravity: 'core', relationshipType: 'ROSTER_MEMBER',
             identity: { name: 'Employee view', avatarUrl: null, label: 'Staff' } }),
    ]);
    expect(merged[0].identity.name).toBe('Employee view');
    expect(merged[0].kind).toBe('internal_employee');
    expect(merged[0].roles).toEqual(expect.arrayContaining(['ROSTER_MEMBER', 'VENDOR']));
  });

  it('prefers inner circle over outer orbit at the same kind', () => {
    const merged = mergeNodesByEntity([
      node({ entityId: 'x', gravity: 'outer_orbit', identity: { name: 'Outer', avatarUrl: null, label: 'Vendor' } }),
      node({ entityId: 'x', gravity: 'inner_circle', identity: { name: 'Inner', avatarUrl: null, label: 'Client' } }),
    ]);
    expect(merged[0].gravity).toBe('inner_circle');
    expect(merged[0].identity.name).toBe('Inner');
  });

  it('does not lose a balance found only on the losing edge', () => {
    // Balance and referral counts are looked up per edge, so the node that
    // loses on specificity may hold the only copy.
    const merged = mergeNodesByEntity([
      node({ entityId: 'c1', gravity: 'outer_orbit', relationshipType: 'CLIENT', meta: { outstanding_balance: 2500 } }),
      node({ entityId: 'c1', gravity: 'inner_circle', relationshipType: 'PARTNER', meta: {} }),
    ]);
    expect(merged[0].gravity).toBe('inner_circle');
    expect(merged[0].meta.outstanding_balance).toBe(2500);
  });

  it('carries an existing roles array through rather than overwriting it', () => {
    const merged = mergeNodesByEntity([
      node({ entityId: 'z', roles: ['CLIENT', 'PARTNER'], relationshipType: 'CLIENT' }),
      node({ entityId: 'z', relationshipType: 'VENDOR' }),
    ]);
    expect(merged[0].roles).toEqual(expect.arrayContaining(['CLIENT', 'PARTNER', 'VENDOR']));
    expect(merged[0].roles).toHaveLength(3);
  });

  it('handles an empty list', () => {
    expect(mergeNodesByEntity([])).toEqual([]);
  });
});
