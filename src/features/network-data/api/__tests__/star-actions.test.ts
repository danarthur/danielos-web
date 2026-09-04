/**
 * Network stars — per-user, never shared.
 *
 * Regression: `context_data.tier = 'preferred'` on the shared relationship edge
 * did double duty as "preferred vendor" (a workspace fact) and "I look at this
 * a lot" (one person's shortcut). Since zone membership keyed off tier, one
 * user starring an entity changed what every colleague saw, and moved the
 * entity between zones.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createMockSupabaseClient, createQueryBuilder } from '../../../../../tests/mocks/supabase';

vi.mock('@/shared/api/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const { createClient } = await import('@/shared/api/supabase/server');
const { starEntity, unstarEntity, listStarredEntityIds } = await import('../star-actions');

let mockClient: ReturnType<typeof createMockSupabaseClient>;
let stars: ReturnType<typeof createQueryBuilder>;

function signedInAs(userId: string | null) {
  mockClient.auth = {
    getUser: vi.fn().mockResolvedValue({ data: { user: userId ? { id: userId } : null } }),
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockClient = createMockSupabaseClient();
  stars = createQueryBuilder();
  mockClient.schema.mockImplementation(() => ({ from: () => stars }) as never);
  vi.mocked(createClient).mockResolvedValue(mockClient as never);
  signedInAs('user-1');
});

describe('starEntity', () => {
  it('writes a row scoped to the signed-in user', async () => {
    const r = await starEntity('ws-1', 'ent-1');
    expect(r).toEqual({ ok: true });
    const row = stars.upsert.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(row).toEqual({ workspace_id: 'ws-1', user_id: 'user-1', entity_id: 'ent-1' });
  });

  it('is idempotent so a double click never errors', async () => {
    await starEntity('ws-1', 'ent-1');
    const opts = stars.upsert.mock.calls.at(-1)?.[1] as Record<string, unknown>;
    expect(opts).toMatchObject({ ignoreDuplicates: true });
  });

  it('refuses when nobody is signed in', async () => {
    signedInAs(null);
    expect(await starEntity('ws-1', 'ent-1')).toEqual({ ok: false, error: 'Not signed in.' });
    expect(stars.upsert).not.toHaveBeenCalled();
  });

  it('refuses without a workspace or entity', async () => {
    expect(await starEntity('', 'ent-1')).toMatchObject({ ok: false });
    expect(await starEntity('ws-1', '')).toMatchObject({ ok: false });
  });
});

describe('unstarEntity', () => {
  it('constrains the delete to this user, workspace and entity', async () => {
    const r = await unstarEntity('ws-1', 'ent-1');
    expect(r).toEqual({ ok: true });
    // Without user_id in the predicate, one person unstarring would clear
    // everyone else's star for that entity.
    const eqKeys = stars.eq.mock.calls.map((c) => c[0]);
    expect(eqKeys).toEqual(expect.arrayContaining(['workspace_id', 'user_id', 'entity_id']));
    expect(stars.delete).toHaveBeenCalled();
  });

  it('refuses when nobody is signed in', async () => {
    signedInAs(null);
    expect(await unstarEntity('ws-1', 'ent-1')).toEqual({ ok: false, error: 'Not signed in.' });
    expect(stars.delete).not.toHaveBeenCalled();
  });
});

describe('listStarredEntityIds', () => {
  it('returns only entity ids', async () => {
    stars.then.mockImplementation((resolve: (v: unknown) => unknown) =>
      resolve({ data: [{ entity_id: 'a' }, { entity_id: 'b' }], error: null }));
    expect(await listStarredEntityIds('ws-1')).toEqual(['a', 'b']);
  });

  it('returns empty rather than throwing when signed out', async () => {
    signedInAs(null);
    expect(await listStarredEntityIds('ws-1')).toEqual([]);
  });

  it('returns empty without a workspace', async () => {
    expect(await listStarredEntityIds('')).toEqual([]);
  });
});
