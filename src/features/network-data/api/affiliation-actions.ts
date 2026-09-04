/**
 * Affiliation moves — recording that someone changed employers.
 *
 * The point of this file is that a job change is APPEND-ONLY. The old edge is
 * ended, never deleted, so the person keeps their history and their former
 * employer keeps theirs. Deleting the edge -- what the app did before -- was
 * the one operation that actually destroyed information about a person: after
 * it, nothing recorded that they had ever worked there, and a past deal could
 * no longer explain itself.
 *
 * Writes go through cortex.move_entity_affiliation because cortex.relationships
 * is SELECT-only under RLS (CLAUDE.md core pattern 3).
 *
 * @module features/network-data/api/affiliation-actions
 */

'use server';

import 'server-only';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/shared/api/supabase/server';

export type MoveAffiliationResult =
  | {
      ok: true;
      /** Affiliation edges ended at the previous employer. */
      ended: number;
      /**
       * ROSTER_MEMBER edges left untouched. Roster membership has its own
       * lifecycle (archiveRosterMember) with anti-lockout rules, so this RPC
       * refuses to end one. Non-zero means the caller should say so rather
       * than imply the move was complete.
       */
      rosterEdgesLeft: number;
      newEdgeId: string | null;
    }
  | { ok: false; error: string };

/**
 * Move a person from one company to another, or out of one with no destination
 * (pass `toCompanyEntityId: null` — "left, don't know where yet", which is a
 * real state and shouldn't force a placeholder company).
 *
 * `effectiveAt` defaults to now. Pass a real date when backfilling a move that
 * already happened, so the history reads correctly.
 */
export async function moveAffiliation(input: {
  personEntityId: string;
  fromCompanyEntityId: string;
  toCompanyEntityId?: string | null;
  effectiveAt?: string | null;
  relationshipType?: 'MEMBER' | 'EMPLOYEE' | 'WORKS_FOR' | 'EMPLOYED_AT' | 'PARTNER';
}): Promise<MoveAffiliationResult> {
  const { personEntityId, fromCompanyEntityId } = input;
  if (!personEntityId || !fromCompanyEntityId) {
    return { ok: false, error: 'Person and current company are both required.' };
  }
  if (input.toCompanyEntityId && input.toCompanyEntityId === fromCompanyEntityId) {
    return { ok: false, error: 'That is already where they work.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.schema('cortex').rpc('move_entity_affiliation', {
    p_person_entity_id: personEntityId,
    p_from_company_entity_id: fromCompanyEntityId,
    p_to_company_entity_id: input.toCompanyEntityId ?? undefined,
    p_effective_at: input.effectiveAt ?? undefined,
    p_new_relationship_type: input.relationshipType ?? undefined,
  });

  if (error) return { ok: false, error: error.message };

  const r = (data ?? {}) as {
    ended?: number;
    roster_edges_left?: number;
    new_edge_id?: string | null;
  };

  revalidatePath('/network');

  return {
    ok: true,
    ended: r.ended ?? 0,
    rosterEdgesLeft: r.roster_edges_left ?? 0,
    newEdgeId: r.new_edge_id ?? null,
  };
}
