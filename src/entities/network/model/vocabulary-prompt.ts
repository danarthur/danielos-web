/**
 * Vocabulary block for Aion's system prompt.
 *
 * The rule, borrowed from how Power BI's Copilot handles renamed columns: a
 * rename is a SYNONYM REGISTRATION, not a substitution. The canonical term
 * stays the identity that tools, filters and stored data use; the workspace's
 * chosen words are registered alongside it and used only when speaking.
 *
 * Without this, a workspace that renamed Roster to Talent gets an assistant
 * whose UI says "Talent" while its own sentences say "crew" -- and which fails
 * to understand "who's on my talent list" because no tool knows that word.
 */

import { categoryLabels, type LabelPack } from './label-packs';
import { CATEGORY_ORDER, type NetworkCategory } from './categories';

/**
 * Every word that can mean a given category, across all packs. Used so a user
 * utterance in any vocabulary resolves to the same canonical key.
 */
const CATEGORY_SYNONYMS: Record<NetworkCategory, string[]> = {
  clients: ['clients', 'customers', 'buyers', 'hosts'],
  roster: ['roster', 'crew', 'talent', 'team', 'staff', 'freelancers'],
  vendors: ['vendors', 'suppliers', 'subs', 'subcontractors'],
  venues: ['venues', 'rooms', 'locations'],
};

export interface VocabularyPromptInput {
  pack: LabelPack;
  /** Active crew role labels, so Aion can speak them rather than raw slugs. */
  crewRoleLabels?: string[];
}

/**
 * The block injected into the system prompt.
 *
 * Deliberately explicit about the boundary: labels are for prose only. If a
 * label ever reaches a tool argument the rename has stopped being presentation
 * and become schema, which is the failure this whole design avoids.
 */
export function buildVocabularyBlock({ pack, crewRoleLabels }: VocabularyPromptInput): string {
  const labels = categoryLabels(pack);

  const lines: string[] = [
    '=== WORKSPACE VOCABULARY ===',
    'This workspace uses its own words for the people and companies it works with.',
    'Use these words when you speak:',
    ...CATEGORY_ORDER.map((c) => `- ${c} -> "${labels[c]}"`),
    '',
    'These are display names only. Tool arguments, filters, and stored data always',
    `use the canonical keys (${CATEGORY_ORDER.join(', ')}). Never pass a display`,
    'name to a tool.',
    '',
    'Treat these as the same thing when the user says them:',
    ...CATEGORY_ORDER.map((c) => `- ${c}: ${CATEGORY_SYNONYMS[c].join(', ')}`),
  ];

  if (crewRoleLabels && crewRoleLabels.length > 0) {
    lines.push(
      '',
      `Crew roles in this workspace: ${crewRoleLabels.join(', ')}.`,
      'A person can hold several at once, so do not assume one role each.',
    );
  }

  return lines.join('\n');
}

/**
 * Resolve a word the user typed to a canonical category key, or null.
 *
 * Kept next to the prompt block so the synonym list has exactly one definition
 * -- a second copy would drift and the two would disagree about what "talent"
 * means.
 */
export function resolveCategoryWord(word: string): NetworkCategory | null {
  const w = word.trim().toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return null;
  for (const cat of CATEGORY_ORDER) {
    if (CATEGORY_SYNONYMS[cat].some((s) => s.replace(/[^a-z]/g, '') === w)) return cat;
  }
  return null;
}
