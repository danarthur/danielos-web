/**
 * addCustomItemToProposal — one-off line items with no catalog entry.
 *
 * Regression: the proposal builder could only insert catalog packages, so
 * anything not already in the gear catalog (a client-specific build, a
 * subrental, a negotiated fee) could not be quoted without first creating a
 * permanent catalog entry for it.
 *
 * Also covers resolveDraftInsertPoint, the draft guard extracted out of
 * addPackageToProposal so both paths share one implementation.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createMockSupabaseClient, createQueryBuilder } from '../../../../../tests/mocks/supabase';

vi.mock('@/shared/api/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/shared/lib/workspace', () => ({ getActiveWorkspaceId: vi.fn() }));
vi.mock('@/app/api/aion/lib/embeddings', () => ({
  upsertEmbedding: vi.fn(), observeUpsert: vi.fn(), buildContextHeader: vi.fn(),
}));

const { createClient } = await import('@/shared/api/supabase/server');
const { addCustomItemToProposal, resolveDraftInsertPoint } = await import('../proposal-actions/main');

type Builder = ReturnType<typeof createQueryBuilder>;
let mockClient: ReturnType<typeof createMockSupabaseClient>;
let builders: Record<string, Builder>;

/** Route .from(table) to a per-table builder so assertions are unambiguous. */
function routeTables(overrides: Record<string, Builder> = {}) {
  builders = {};
  mockClient.from.mockImplementation((table: string) => {
    if (overrides[table]) return overrides[table] as never;
    if (!builders[table]) builders[table] = createQueryBuilder();
    return builders[table] as never;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockClient = createMockSupabaseClient();
  vi.mocked(createClient).mockResolvedValue(mockClient as never);
});

/** deals lookup used by resolveWorkspaceIdFromDeal. */
function dealsBuilder(workspaceId: string | null) {
  const b = createQueryBuilder();
  b.maybeSingle.mockResolvedValue({
    data: workspaceId ? { workspace_id: workspaceId } : null,
    error: null,
  });
  return b;
}

describe('addCustomItemToProposal — validation', () => {
  it('rejects a blank name before touching the database', async () => {
    routeTables();
    const r = await addCustomItemToProposal('deal-1', { name: '   ', unitPrice: 10 });
    expect(r).toEqual({ success: false, error: 'Give the item a name.' });
    expect(mockClient.from).not.toHaveBeenCalled();
  });

  it('rejects a negative or non-numeric price', async () => {
    routeTables();
    const neg = await addCustomItemToProposal('deal-1', { name: 'Custom truss', unitPrice: -5 });
    expect(neg).toEqual({ success: false, error: 'Enter a price of zero or more.' });
    const nan = await addCustomItemToProposal('deal-1', {
      name: 'Custom truss', unitPrice: Number.NaN,
    });
    expect(nan).toEqual({ success: false, error: 'Enter a price of zero or more.' });
  });

  it('accepts a zero price — comped items are legitimate', async () => {
    const proposals = createQueryBuilder();
    proposals.then.mockImplementation((resolve: (v: unknown) => unknown) =>
      resolve({ data: [{ id: 'prop-1', status: 'draft', superseded_at: null }], error: null }));
    const items = createQueryBuilder();
    items.maybeSingle.mockResolvedValue({ data: { sort_order: 2 }, error: null });
    items.single.mockResolvedValue({ data: { id: 'item-9' }, error: null });
    routeTables({ deals: dealsBuilder('ws-1'), proposals, proposal_items: items });

    const r = await addCustomItemToProposal('deal-1', { name: 'Comped rider', unitPrice: 0 });
    expect(r).toMatchObject({ success: true, itemId: 'item-9' });
  });
});

describe('addCustomItemToProposal — the written row', () => {
  it('stores no catalog origin and lands after the last item', async () => {
    const proposals = createQueryBuilder();
    proposals.then.mockImplementation((resolve: (v: unknown) => unknown) =>
      resolve({ data: [{ id: 'prop-1', status: 'draft', superseded_at: null }], error: null }));
    const items = createQueryBuilder();
    items.maybeSingle.mockResolvedValue({ data: { sort_order: 4 }, error: null });
    items.single.mockResolvedValue({ data: { id: 'item-1' }, error: null });
    routeTables({ deals: dealsBuilder('ws-1'), proposals, proposal_items: items });

    const r = await addCustomItemToProposal('deal-1', {
      name: '  Custom LED wall  ',
      description: '  4m x 3m  ',
      quantity: 2,
      unitPrice: 1250.5,
    });

    expect(r).toMatchObject({ success: true, proposalId: 'prop-1' });
    const row = items.insert.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    // No catalog entry behind it — this is what makes it "custom".
    expect(row.origin_package_id).toBeNull();
    expect(row.package_id).toBeNull();
    expect(row.is_package_header).toBe(false);
    // Trimmed, and appended after the current maximum sort_order.
    expect(row.name).toBe('Custom LED wall');
    expect(row.description).toBe('4m x 3m');
    expect(row.quantity).toBe(2);
    expect(row.unit_price).toBe(1250.5);
    expect(row.sort_order).toBe(5);
    expect(row.proposal_id).toBe('prop-1');
  });

  it('coerces a fractional quantity to a whole number of at least one', async () => {
    const proposals = createQueryBuilder();
    proposals.then.mockImplementation((resolve: (v: unknown) => unknown) =>
      resolve({ data: [{ id: 'prop-1', status: 'draft', superseded_at: null }], error: null }));
    const items = createQueryBuilder();
    items.maybeSingle.mockResolvedValue({ data: null, error: null });
    items.single.mockResolvedValue({ data: { id: 'item-2' }, error: null });
    routeTables({ deals: dealsBuilder('ws-1'), proposals, proposal_items: items });

    await addCustomItemToProposal('deal-1', { name: 'Cable', quantity: 0, unitPrice: 5 });
    const row = items.insert.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(row.quantity).toBe(1);
    // First row in an empty proposal.
    expect(row.sort_order).toBe(0);
  });

  it('records the taxable flag, defaulting to taxable', async () => {
    const proposals = createQueryBuilder();
    proposals.then.mockImplementation((resolve: (v: unknown) => unknown) =>
      resolve({ data: [{ id: 'prop-1', status: 'draft', superseded_at: null }], error: null }));
    const items = createQueryBuilder();
    items.maybeSingle.mockResolvedValue({ data: null, error: null });
    items.single.mockResolvedValue({ data: { id: 'item-3' }, error: null });
    routeTables({ deals: dealsBuilder('ws-1'), proposals, proposal_items: items });

    await addCustomItemToProposal('deal-1', { name: 'Permit', unitPrice: 200, isTaxable: false });
    let snap = (items.insert.mock.calls.at(-1)?.[0] as Record<string, unknown>)
      .definition_snapshot as Record<string, unknown>;
    expect(snap.tax_meta).toEqual({ is_taxable: false });

    await addCustomItemToProposal('deal-1', { name: 'Truss', unitPrice: 100 });
    snap = (items.insert.mock.calls.at(-1)?.[0] as Record<string, unknown>)
      .definition_snapshot as Record<string, unknown>;
    expect(snap.tax_meta).toEqual({ is_taxable: true });
  });

  it('records the chosen category, falling back to custom', async () => {
    const proposals = createQueryBuilder();
    proposals.then.mockImplementation((resolve: (v: unknown) => unknown) =>
      resolve({ data: [{ id: 'prop-1', status: 'draft', superseded_at: null }], error: null }));
    const items = createQueryBuilder();
    items.maybeSingle.mockResolvedValue({ data: null, error: null });
    items.single.mockResolvedValue({ data: { id: 'item-5' }, error: null });
    routeTables({ deals: dealsBuilder('ws-1'), proposals, proposal_items: items });

    await addCustomItemToProposal('deal-1', {
      name: 'LED wall', unitPrice: 900, category: 'rental',
    });
    let snap = (items.insert.mock.calls.at(-1)?.[0] as Record<string, unknown>)
      .definition_snapshot as Record<string, unknown>;
    // Margin reporting groups by this, same as a catalog-sourced row.
    expect(snap.margin_meta).toEqual({ category: 'rental' });

    await addCustomItemToProposal('deal-1', { name: 'Odd job', unitPrice: 50 });
    snap = (items.insert.mock.calls.at(-1)?.[0] as Record<string, unknown>)
      .definition_snapshot as Record<string, unknown>;
    expect(snap.margin_meta).toEqual({ category: 'custom' });
  });

  it('carries a catalog origin when the item was also saved to the catalog', async () => {
    const proposals = createQueryBuilder();
    proposals.then.mockImplementation((resolve: (v: unknown) => unknown) =>
      resolve({ data: [{ id: 'prop-1', status: 'draft', superseded_at: null }], error: null }));
    const items = createQueryBuilder();
    items.maybeSingle.mockResolvedValue({ data: null, error: null });
    items.single.mockResolvedValue({ data: { id: 'item-4' }, error: null });
    routeTables({ deals: dealsBuilder('ws-1'), proposals, proposal_items: items });

    await addCustomItemToProposal('deal-1', {
      name: 'Custom LED wall', unitPrice: 900, originPackageId: 'pkg-new',
    });
    const row = items.insert.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    // With an origin the row joins normal catalog behaviour downstream
    // (gear planning, crew roles, variance) instead of being invisible to it.
    expect(row.origin_package_id).toBe('pkg-new');
    expect(row.package_id).toBeNull();
  });

  it('fails cleanly when the deal has no resolvable workspace', async () => {
    routeTables({ deals: dealsBuilder(null) });
    const r = await addCustomItemToProposal('deal-x', { name: 'Thing', unitPrice: 1 });
    expect(r).toEqual({
      success: false,
      error: 'Deal not found or workspace could not be resolved.',
    });
  });
});

describe('resolveDraftInsertPoint — shared draft guard', () => {
  it('refuses to touch a proposal that has already been sent', async () => {
    const proposals = createQueryBuilder();
    proposals.then.mockImplementation((resolve: (v: unknown) => unknown) =>
      resolve({ data: [{ id: 'p-sent', status: 'sent', superseded_at: null }], error: null }));
    routeTables({ proposals });

    const r = await resolveDraftInsertPoint(mockClient, 'deal-1', 'ws-1', null, 1);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('already has a sent proposal');
  });

  it('creates a fresh draft when nothing live exists', async () => {
    const proposals = createQueryBuilder();
    proposals.then.mockImplementation((resolve: (v: unknown) => unknown) =>
      resolve({ data: [], error: null }));
    proposals.single.mockResolvedValue({ data: { id: 'new-prop' }, error: null });
    routeTables({ proposals });

    const r = await resolveDraftInsertPoint(mockClient, 'deal-1', 'ws-1', null, 1);
    expect(r).toEqual({ ok: true, proposalId: 'new-prop', nextSortOrder: 0 });
  });

  it('shifts later rows down when inserting into the middle', async () => {
    const proposals = createQueryBuilder();
    proposals.then.mockImplementation((resolve: (v: unknown) => unknown) =>
      resolve({ data: [{ id: 'prop-1', status: 'draft', superseded_at: null }], error: null }));
    const items = createQueryBuilder();
    items.then.mockImplementation((resolve: (v: unknown) => unknown) =>
      resolve({ data: [{ id: 'a', sort_order: 3 }, { id: 'b', sort_order: 2 }], error: null }));
    routeTables({ proposals, proposal_items: items });

    const r = await resolveDraftInsertPoint(mockClient, 'deal-1', 'ws-1', 1, 1);
    expect(r).toMatchObject({ ok: true, proposalId: 'prop-1', nextSortOrder: 2 });
    // Both trailing rows were pushed down by the row count.
    const shifted = items.update.mock.calls.map((c) => (c[0] as { sort_order: number }).sort_order);
    expect(shifted).toEqual([4, 3]);
  });
});
