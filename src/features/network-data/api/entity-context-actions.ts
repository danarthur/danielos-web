'use server';

import 'server-only';
import { createClient } from '@/shared/api/supabase/server';
import { VENUE_ATTR } from '@/features/network-data/model/attribute-keys';

// ─── Deals ────────────────────────────────────────────────────────────────────

export type EntityDeal = {
  id: string;
  proposed_date: string;
  event_archetype: string | null;
  status: string;
  budget_estimated: number | null;
  /**
   * Set when this deal reaches the entity through one of its PEOPLE rather than
   * the company itself — "Brandi Jane Events, via Brandi Jane". Labelled rather
   * than merged, for the same reason referral credit keeps the two apart: they
   * are two views of overlapping events and adding them double-counts.
   */
  viaPersonName?: string;
};

/**
 * Deals connected to an entity, by every route that actually connects them.
 *
 * This used to query ONLY `deal_stakeholders.entity_id`, which is the person
 * column. Companies are stored in `organization_id`, so a company reliably
 * returned nothing: Brandi Jane Events showed no deals at all while carrying one
 * as organization_id and two more through Brandi herself.
 *
 * Three routes now:
 *   1. stakeholder by entity_id      the person
 *   2. stakeholder by organization_id the company on the row
 *   3. deals.organization_id          the company as the deal's client
 *
 * Plus, for a company, deals reached through its current people — returned with
 * `viaPersonName` set so the provenance stays visible instead of being silently
 * merged into the company's own count.
 *
 * Two-step throughout: ops.deal_stakeholders → public.deals. Cross-schema
 * PostgREST joins are fragile; explicit two-step is safer. RLS on
 * deal_stakeholders chains through deals.workspace_id → get_my_workspace_ids().
 */
export async function getEntityDeals(entityId: string): Promise<EntityDeal[]> {
  const supabase = await createClient();

  const [directRes, clientRes, affiliateRes] = await Promise.all([
    supabase.schema('ops').from('deal_stakeholders')
      .select('deal_id')
      .or(`entity_id.eq.${entityId},organization_id.eq.${entityId}`)
      .limit(50),
    supabase.from('deals').select('id').eq('organization_id', entityId).limit(50),
    // Current people at this company. Empty for a person, which is what makes
    // the through-the-team pass a no-op for them.
    supabase.schema('cortex').from('relationships')
      .select('source_entity_id')
      .eq('target_entity_id', entityId)
      .is('ended_at', null)
      .in('relationship_type', [
        'MEMBER', 'EMPLOYEE', 'WORKS_FOR', 'EMPLOYED_AT', 'PARTNER', 'ROSTER_MEMBER',
      ]),
  ]);

  const directIds = new Set<string>([
    ...((directRes.data ?? []) as { deal_id: string | null }[])
      .map((r) => r.deal_id).filter((x): x is string => Boolean(x)),
    ...((clientRes.data ?? []) as { id: string }[]).map((r) => r.id),
  ]);

  const personIds = ((affiliateRes.data ?? []) as { source_entity_id: string }[])
    .map((r) => r.source_entity_id)
    .filter((id) => id !== entityId);

  const viaPersonByDeal = await resolveDealsViaTeam(supabase, personIds, directIds);

  const allIds = [...new Set([...directIds, ...viaPersonByDeal.keys()])];
  if (allIds.length === 0) return [];

  const { data, error } = await supabase
    .from('deals')
    .select('id, proposed_date, event_archetype, status, budget_estimated')
    .in('id', allIds)
    .order('proposed_date', { ascending: false });

  if (error) {
    console.error('[network] getEntityDeals:', error.message);
    return [];
  }

  return ((data ?? []) as EntityDeal[]).map((d) => {
    const via = viaPersonByDeal.get(d.id);
    return via ? { ...d, viaPersonName: via } : d;
  });
}

// ─── Financial summary ────────────────────────────────────────────────────────

export type EntityInvoiceSummary = {
  id: string;
  status: string | null;
  total_amount: number;
  due_date: string | null;
};

/**
 * Returns open invoices for this entity from finance.invoices.
 * Scoped by bill_to_entity_id. RLS handles workspace isolation.
 */
export async function getEntityFinancialSummary(entityId: string): Promise<EntityInvoiceSummary[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .schema('finance')
    .from('invoices')
    .select('id, status, total_amount, due_date')
    .eq('bill_to_entity_id', entityId)
    .order('due_date', { ascending: true })
    .limit(10);

  if (error) {
    console.error('[finance] getEntityFinancialSummary:', error.message);
    return [];
  }

  return (data ?? []) as EntityInvoiceSummary[];
}

// ─── Venue technical specs ────────────────────────────────────────────────────

export type VenueTechSpecsResult = { ok: true } | { ok: false; error: string };

export type VenueTechSpecs = {
  capacity?: number | null;
  load_in_notes?: string | null;
  power_notes?: string | null;
  stage_notes?: string | null;
};

/**
 * Merges venue technical specs into directory.entities.attributes
 * via patch_entity_attributes RPC (safe jsonb merge, no race condition).
 */
export async function updateVenueTechnicalSpecs(
  entityId: string,
  specs: VenueTechSpecs,
): Promise<VenueTechSpecsResult> {
  if (!entityId) return { ok: false, error: 'Missing entity ID.' };

  // Build payload — only include defined keys (using VENUE_ATTR constants for key safety)
  const payload: Record<string, unknown> = {};
  if (specs.capacity !== undefined) payload[VENUE_ATTR.capacity] = specs.capacity;
  if (specs.load_in_notes !== undefined) payload[VENUE_ATTR.load_in_notes] = specs.load_in_notes;
  if (specs.power_notes !== undefined) payload[VENUE_ATTR.power_notes] = specs.power_notes;
  if (specs.stage_notes !== undefined) payload[VENUE_ATTR.stage_notes] = specs.stage_notes;

  if (Object.keys(payload).length === 0) return { ok: true };

  const supabase = await createClient();
  const { error } = await supabase.rpc('patch_entity_attributes', {
    p_entity_id: entityId,
    p_attributes: payload,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Deals reached through a company's people, mapped to the person who brought
 * them. A deal the company is already on directly is its own, not "through"
 * anyone, so those are skipped rather than relabelled.
 */
async function resolveDealsViaTeam(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the server client's generics vary; only .schema()/.from() are used.
  supabase: any,
  personIds: string[],
  directIds: Set<string>,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (personIds.length === 0) return out;

  const [teamRes, peopleRes] = await Promise.all([
    supabase.schema('ops').from('deal_stakeholders')
      .select('deal_id, entity_id').in('entity_id', personIds).limit(50),
    supabase.schema('directory').from('entities')
      .select('id, display_name').in('id', personIds),
  ]);

  const nameById = new Map(
    ((peopleRes.data ?? []) as { id: string; display_name: string | null }[])
      .map((p) => [p.id, p.display_name ?? 'Unnamed']),
  );

  for (const r of ((teamRes.data ?? []) as { deal_id: string | null; entity_id: string | null }[])) {
    if (!r.deal_id || !r.entity_id || directIds.has(r.deal_id) || out.has(r.deal_id)) continue;
    out.set(r.deal_id, nameById.get(r.entity_id) ?? 'a team member');
  }
  return out;
}
