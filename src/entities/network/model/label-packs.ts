/**
 * Category label packs — workspace vocabulary over a fixed category set.
 *
 * The category KEYS are immutable and are what everything behaves on: filters,
 * exports, API payloads, telemetry, and Aion's tools all speak `clients` /
 * `roster` / `vendors` / `venues`. Only the displayed words change per
 * workspace. Every product that ships renaming draws this line -- Attio freezes
 * the slug, HubSpot the Object Type ID, Salesforce the API name.
 *
 * The set of packs is CLOSED rather than free text. A finite vocabulary keeps
 * help docs, screenshots and support answerable, and keeps Aion's synonym map
 * (Phase 5) small enough to test. Free-text renaming makes both unbounded.
 *
 * Only the roster label actually varies. "Crew" is production vocabulary and
 * demotes performers to labour in an agency; "Talent" means the act the client
 * hired to a production company, so it misfires symmetrically. Clients and
 * Venues are already the industry's own words and stay frozen.
 */

import type { NetworkCategory } from './categories';

export type LabelPack = 'roster' | 'crew' | 'talent';

export const DEFAULT_LABEL_PACK: LabelPack = 'roster';

/** Singular and plural, because "a Talent" reads badly and both are needed. */
export type CategoryLabel = { one: string; many: string };

const FROZEN = {
  clients: { one: 'Client', many: 'Clients' },
  vendors: { one: 'Vendor', many: 'Vendors' },
  venues: { one: 'Venue', many: 'Venues' },
} as const;

export const LABEL_PACKS: Record<LabelPack, Record<NetworkCategory, CategoryLabel>> = {
  // Neutral default: native to agencies, understood by production and touring,
  // implies no employment status so freelancers fit, and takes no side.
  roster: { ...FROZEN, roster: { one: 'Roster member', many: 'Roster' } },
  // Production companies, staging and AV.
  crew: { ...FROZEN, roster: { one: 'Crew member', many: 'Crew' } },
  // Talent and entertainment agencies, where the performer is the product.
  talent: { ...FROZEN, roster: { one: 'Talent', many: 'Talent' } },
};

/** Human-readable pack names for the workspace setting. */
export const LABEL_PACK_OPTIONS: { value: LabelPack; label: string; hint: string }[] = [
  { value: 'roster', label: 'Roster', hint: 'Neutral — works for most companies' },
  { value: 'crew',   label: 'Crew',   hint: 'Production, staging and AV' },
  { value: 'talent', label: 'Talent', hint: 'Talent and entertainment agencies' },
];

/** Narrow an arbitrary stored value to a known pack. */
export function toLabelPack(value: string | null | undefined): LabelPack {
  return value === 'crew' || value === 'talent' || value === 'roster'
    ? value
    : DEFAULT_LABEL_PACK;
}

/**
 * The one place a category turns into words.
 *
 * Everything user-facing goes through here. A label must never reach a filter
 * value, an export column, an event payload or a tool name -- the moment it
 * does, the rename stops being presentation and starts being schema.
 */
export function categoryLabel(
  pack: LabelPack,
  category: NetworkCategory,
  form: 'one' | 'many' = 'many',
): string {
  return LABEL_PACKS[pack][category][form];
}

/** All four labels for a pack, for components that render the whole set. */
export function categoryLabels(pack: LabelPack): Record<NetworkCategory, string> {
  const p = LABEL_PACKS[pack];
  return {
    clients: p.clients.many,
    roster: p.roster.many,
    vendors: p.vendors.many,
    venues: p.venues.many,
  };
}
