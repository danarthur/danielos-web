/**
 * Affiliation edges — the relationship kinds that mean "this person is part of
 * this company".
 *
 * This list previously existed as five copies across the codebase and had
 * already drifted: `get-entity-captures` and the Aion capture parser omitted
 * `EMPLOYEE` while the other three included it, so the same person could count
 * as affiliated on one surface and unaffiliated on another. One definition, so
 * that cannot recur.
 *
 * NOTE ON `PARTNER`: it is a genuine catch-all, written by `summonPartner` for
 * both freelance people and partner companies. It counts as affiliation here
 * because a PARTNER edge to a company does describe "belongs to". Category
 * placement resolves it by entity type — see `categoriesOf` in ./categories.
 */
export const AFFILIATION_RELATIONSHIP_TYPES = [
  'MEMBER',
  'ROSTER_MEMBER',
  'PARTNER',
  'EMPLOYEE',
  'WORKS_FOR',
  'EMPLOYED_AT',
] as const;

export type AffiliationRelationshipType =
  (typeof AFFILIATION_RELATIONSHIP_TYPES)[number];

/**
 * Edges carry `started_at` / `ended_at` (migration 20260903193000). A set
 * `ended_at` means the relationship ended and the row is kept as history, so
 * ANY query about a live relationship must add `.is('ended_at', null)` or a
 * departed employee keeps showing up on their old employer's team.
 * Historical surfaces -- "who worked here in 2024", a person's employer
 * timeline -- deliberately do not filter it.
 */
