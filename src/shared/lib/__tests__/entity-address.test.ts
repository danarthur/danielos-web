/**
 * Address read/write precedence.
 *
 * Regression: an address had three storage shapes and no writer kept them
 * together, so an edit on the event page was invisible on the contact page and
 * an edit on the contact page left the client-facing proposal stale.
 */

import { describe, it, expect } from 'vitest';
import {
  readEntityAddress,
  buildAddressPatch,
  formatEntityAddress,
} from '../entity-address';

describe('readEntityAddress', () => {
  it('prefers the nested object the contact page writes', () => {
    const a = readEntityAddress({
      address: { street: '1 Vineyard Ln', city: 'Napa', state: 'CA', postal_code: '94558' },
    });
    expect(a.street).toBe('1 Vineyard Ln');
    expect(a.city).toBe('Napa');
  });

  it('falls back to the top-level fields Aion and venue search use', () => {
    const a = readEntityAddress({ street: '5 Dock Rd', city: 'Austin', state: 'TX' });
    expect(a.street).toBe('5 Dock Rd');
    expect(a.city).toBe('Austin');
  });

  it('parses formatted_address when nothing structured exists', () => {
    const a = readEntityAddress({ formatted_address: '9 Hill St, Nashville, TN, 37201' });
    expect(a.street).toBe('9 Hill St');
    expect(a.city).toBe('Nashville');
    expect(a.state).toBe('TN');
    expect(a.postal_code).toBe('37201');
  });

  it('fills per-field, so a partial object still picks up top-level values', () => {
    // The bug this guards: a record with only a nested city would otherwise
    // open the form with a blank street and blank it on save.
    const a = readEntityAddress({ address: { city: 'Napa' }, street: '1 Vineyard Ln' });
    expect(a.city).toBe('Napa');
    expect(a.street).toBe('1 Vineyard Ln');
  });

  it('tolerates a legacy string address and empty input', () => {
    expect(readEntityAddress({ address: '9 Hill St, Nashville' }).street).toBe('9 Hill St');
    expect(readEntityAddress(null).street).toBe('');
    expect(readEntityAddress({}).city).toBe('');
  });
});

describe('buildAddressPatch', () => {
  const address = {
    street: '1 Vineyard Ln',
    city: 'Napa',
    state: 'CA',
    postal_code: '94558',
    country: 'US',
  };

  it('writes all three shapes so every reader agrees', () => {
    const patch = buildAddressPatch(address) as Record<string, unknown>;
    // nested object — contact page + venue search
    expect(patch.address).toMatchObject({ street: '1 Vineyard Ln', city: 'Napa' });
    // top-level — venue search fallback
    expect(patch.street).toBe('1 Vineyard Ln');
    expect(patch.city).toBe('Napa');
    // single line — client-facing proposal, event venue address
    expect(patch.formatted_address).toBe('1 Vineyard Ln, Napa, CA, 94558');
  });

  it('round-trips through readEntityAddress', () => {
    const patch = buildAddressPatch(address) as Record<string, unknown>;
    expect(readEntityAddress(patch)).toEqual(address);
  });

  it('nulls empty fields rather than writing blank strings', () => {
    const patch = buildAddressPatch({
      street: '', city: 'Napa', state: '', postal_code: '', country: '',
    }) as Record<string, unknown>;
    expect(patch.street).toBeNull();
    expect(patch.city).toBe('Napa');
    expect(patch.formatted_address).toBe('Napa');
  });
});

describe('formatEntityAddress', () => {
  it('skips missing parts instead of leaving empty commas', () => {
    expect(
      formatEntityAddress({ street: '', city: 'Napa', state: 'CA', postal_code: '', country: '' }),
    ).toBe('Napa, CA');
  });
});
