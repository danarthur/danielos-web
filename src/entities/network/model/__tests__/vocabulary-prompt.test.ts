/**
 * Aion vocabulary block — renames are synonyms, never substitutions.
 *
 * Regression risk: a workspace renames Roster to Talent, the UI updates, and
 * Aion keeps saying "crew" while failing to understand "my talent list"
 * because no tool knows that word. Power BI documents the same failure for
 * renamed columns, which is why it auto-registers the old name as a synonym.
 */

import { describe, it, expect } from 'vitest';
import { buildVocabularyBlock, resolveCategoryWord } from '../vocabulary-prompt';

describe('buildVocabularyBlock', () => {
  it('tells Aion the workspace’s words', () => {
    const block = buildVocabularyBlock({ pack: 'talent' });
    expect(block).toContain('"Talent"');
    expect(block).toContain('"Clients"');
  });

  it('always states the canonical keys and forbids passing labels to tools', () => {
    // The load-bearing instruction: the moment a label reaches a tool argument,
    // the rename has become schema.
    const block = buildVocabularyBlock({ pack: 'talent' });
    expect(block).toContain('clients, roster, vendors, venues');
    expect(block).toContain('Never pass a display');
  });

  it('registers the other packs’ words as synonyms, not replacements', () => {
    // A workspace on "talent" must still understand a user who says "crew".
    const block = buildVocabularyBlock({ pack: 'talent' });
    expect(block).toMatch(/roster: .*crew/);
    expect(block).toMatch(/roster: .*talent/);
  });

  it('lists crew roles and warns they are multi-value', () => {
    const block = buildVocabularyBlock({ pack: 'talent', crewRoleLabels: ['DJ', 'MC'] });
    expect(block).toContain('DJ, MC');
    expect(block).toContain('several at once');
  });

  it('omits the roles line entirely when no vocabulary exists', () => {
    const block = buildVocabularyBlock({ pack: 'roster', crewRoleLabels: [] });
    expect(block).not.toContain('Crew roles in this workspace');
  });
});

describe('resolveCategoryWord', () => {
  it('maps every pack’s word for the roster to one key', () => {
    for (const w of ['roster', 'crew', 'talent', 'team', 'staff', 'freelancers']) {
      expect(resolveCategoryWord(w)).toBe('roster');
    }
  });

  it('maps the other categories', () => {
    expect(resolveCategoryWord('customers')).toBe('clients');
    expect(resolveCategoryWord('suppliers')).toBe('vendors');
    expect(resolveCategoryWord('rooms')).toBe('venues');
  });

  it('is forgiving about case, spacing and punctuation', () => {
    expect(resolveCategoryWord('  Talent ')).toBe('roster');
    expect(resolveCategoryWord('Sub-contractors')).toBe('vendors');
  });

  it('returns null rather than guessing at an unrelated word', () => {
    expect(resolveCategoryWord('invoices')).toBeNull();
    expect(resolveCategoryWord('')).toBeNull();
  });
});
