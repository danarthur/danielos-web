/**
 * Label packs — workspace vocabulary over immutable category keys.
 *
 * The rule every renaming product enforces: the label changes, the key never
 * does. Attio freezes the slug, HubSpot the Object Type ID, Salesforce the API
 * name. If a label ever reaches a filter, an export or a tool name, the rename
 * has stopped being presentation and become schema.
 */

import { describe, it, expect } from 'vitest';
import {
  LABEL_PACKS,
  LABEL_PACK_OPTIONS,
  DEFAULT_LABEL_PACK,
  categoryLabel,
  categoryLabels,
  toLabelPack,
} from '../label-packs';
import { CATEGORY_ORDER } from '../categories';

describe('label packs', () => {
  it('renames only the roster label', () => {
    // Clients and Venues are already the industry's own words. Renaming them
    // would buy confusion with no upside.
    for (const pack of ['roster', 'crew', 'talent'] as const) {
      expect(categoryLabel(pack, 'clients')).toBe('Clients');
      expect(categoryLabel(pack, 'venues')).toBe('Venues');
      expect(categoryLabel(pack, 'vendors')).toBe('Vendors');
    }
    expect(categoryLabel('roster', 'roster')).toBe('Roster');
    expect(categoryLabel('crew', 'roster')).toBe('Crew');
    expect(categoryLabel('talent', 'roster')).toBe('Talent');
  });

  it('carries singular and plural, because "a Talent" reads badly', () => {
    expect(categoryLabel('crew', 'roster', 'one')).toBe('Crew member');
    expect(categoryLabel('crew', 'roster', 'many')).toBe('Crew');
    expect(categoryLabel('roster', 'roster', 'one')).toBe('Roster member');
  });

  it('covers every category in every pack', () => {
    for (const pack of Object.keys(LABEL_PACKS) as (keyof typeof LABEL_PACKS)[]) {
      for (const cat of CATEGORY_ORDER) {
        const l = LABEL_PACKS[pack][cat];
        expect(l.one.length).toBeGreaterThan(0);
        expect(l.many.length).toBeGreaterThan(0);
      }
    }
  });

  it('falls back to the default for unknown or missing values', () => {
    // A workspace row written before this shipped, or a value from a future
    // pack that has since been removed, must not render blank labels.
    expect(toLabelPack(null)).toBe(DEFAULT_LABEL_PACK);
    expect(toLabelPack(undefined)).toBe(DEFAULT_LABEL_PACK);
    expect(toLabelPack('')).toBe(DEFAULT_LABEL_PACK);
    expect(toLabelPack('squad')).toBe(DEFAULT_LABEL_PACK);
    expect(toLabelPack('talent')).toBe('talent');
  });

  it('offers every pack as a settable option', () => {
    const optionValues = LABEL_PACK_OPTIONS.map((o) => o.value).sort();
    expect(optionValues).toEqual(Object.keys(LABEL_PACKS).sort());
  });

  it('returns the whole set for components rendering all four', () => {
    expect(categoryLabels('talent')).toEqual({
      clients: 'Clients',
      roster: 'Talent',
      vendors: 'Vendors',
      venues: 'Venues',
    });
  });
});
