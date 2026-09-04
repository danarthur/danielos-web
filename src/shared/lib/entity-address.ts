/**
 * One address, three storage shapes.
 *
 * A venue or company address has historically been stored three ways, and no
 * single writer kept them together:
 *
 *   - `attributes.address`   — nested object. Read by the contact page
 *                              (EntityStudioClient / DossierEditor /
 *                              NetworkDetailSheet) and preferred by venue search.
 *   - top-level `street` / `city` / `state` / `postal_code`
 *                            — venue search falls back to these.
 *   - `formatted_address`    — single line. Read by the CLIENT-FACING proposal
 *                              (get-public-proposal), the event's venue address
 *                              (update-event-venue) and the venue specs panel.
 *
 * An edit that touched only one shape was invisible everywhere else. These
 * helpers make every writer read with the same precedence and write all three,
 * so an address edited anywhere shows up everywhere.
 */

export type EntityAddress = {
  street: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
};

export const EMPTY_ADDRESS: EntityAddress = {
  street: '',
  city: '',
  state: '',
  postal_code: '',
  country: '',
};

function str(v: unknown): string {
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') return String(v);
  return '';
}

/**
 * Best-known address for an entity, in precedence order:
 * nested object → top-level fields → parsed `formatted_address`.
 *
 * Precedence is per-field, not all-or-nothing: a record with a nested object
 * holding only a city still picks up a top-level street.
 */
export function readEntityAddress(attrs: Record<string, unknown> | null | undefined): EntityAddress {
  const a = attrs ?? {};
  const nested = (a.address && typeof a.address === 'object' ? a.address : {}) as Record<string, unknown>;

  // `address` is occasionally a plain string on older rows.
  const nestedIsString = typeof a.address === 'string';
  const formatted = str(a.formatted_address) || (nestedIsString ? str(a.address) : '');
  const parts = formatted ? formatted.split(',').map((p) => p.trim()) : [];

  const pick = (key: keyof EntityAddress, fallbackIdx: number): string =>
    str(nested[key]) || str(a[key]) || str(parts[fallbackIdx]);

  return {
    street: pick('street', 0),
    city: pick('city', 1),
    state: pick('state', 2),
    postal_code: pick('postal_code', 3),
    country: str(nested.country) || str(a.country),
  };
}

/** Single-line rendering used for `formatted_address`. */
export function formatEntityAddress(address: EntityAddress): string {
  return [address.street, address.city, address.state, address.postal_code]
    .map((p) => p.trim())
    .filter(Boolean)
    .join(', ');
}

/**
 * Build the attribute patch for an address, writing all three shapes so every
 * reader in the app sees the same value.
 *
 * Pass the address you want stored — callers should merge onto
 * `readEntityAddress(current)` first so untouched fields are preserved rather
 * than blanked.
 */
export function buildAddressPatch(address: EntityAddress): Record<string, unknown> {
  const formatted = formatEntityAddress(address);
  const nested: Record<string, string> = {};
  for (const [k, v] of Object.entries(address)) {
    if (v.trim()) nested[k] = v.trim();
  }
  return {
    address: nested,
    street: address.street.trim() || null,
    city: address.city.trim() || null,
    state: address.state.trim() || null,
    postal_code: address.postal_code.trim() || null,
    formatted_address: formatted || null,
  };
}
