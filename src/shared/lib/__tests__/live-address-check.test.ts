import { describe, it, expect } from 'vitest';
import { readEntityAddress, buildAddressPatch } from '../entity-address';

// Real rows from the live workspace, pasted verbatim.
const PASEA = { address: { city: 'Huntington Beach', state: 'California', street: '21080 CA-1', country: 'USA', postal_code: '92648' }, category: 'venue' };
const NINETEEN09 = { city: 'Topanga', state: 'CA', street: '1909 N Topanga Canyon Blvd', country: 'US', postal_code: '90290', formatted_address: '1909 N Topanga Canyon Blvd, Topanga, CA, 90290, US' };
const HIDDEN = { category: 'venue', is_ghost: true };

describe('live rows prefill correctly', () => {
  it('a top-level-only venue resolves for the contact page (F2)', () => {
    // node-details previously read attributes.address directly, so 1909 --
    // which stores only top-level keys -- rendered a blank address form on its
    // own contact page.
    const a = readEntityAddress(NINETEEN09);
    const hasAny = a.street || a.city || a.state || a.postal_code;
    expect(hasAny).toBeTruthy();
    expect(a.postal_code).toBe('90290');
  });

  it('Pasea (nested only)', () => {
    const a = readEntityAddress(PASEA);
    expect(a.street).toBe('21080 CA-1');
    expect(a.city).toBe('Huntington Beach');
    expect(a.postal_code).toBe('92648');
  });
  it('1909 (top-level only)', () => {
    const a = readEntityAddress(NINETEEN09);
    expect(a.street).toBe('1909 N Topanga Canyon Blvd');
    expect(a.city).toBe('Topanga');
  });
  it('Hidden Estate (empty) stays empty rather than inventing values', () => {
    expect(readEntityAddress(HIDDEN)).toMatchObject({ street: '', city: '' });
  });
  it('editing one field on Pasea preserves the rest, incl. country', () => {
    const current = readEntityAddress(PASEA);
    const patch = buildAddressPatch({ ...current, street: '21080 Pacific Coast Hwy' }) as Record<string, unknown>;
    expect(readEntityAddress(patch)).toMatchObject({
      street: '21080 Pacific Coast Hwy',
      city: 'Huntington Beach',
      country: 'USA',
    });
    // and the shape the contact page reads is updated too
    expect(patch.address).toMatchObject({ street: '21080 Pacific Coast Hwy' });
  });
});
