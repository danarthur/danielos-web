/**
 * getReferralsForEntity — the reciprocity ledger for one person / company.
 *
 * Returns two directional lists:
 *   • received — leads this counterparty referred TO us
 *   • sent     — leads we referred TO this counterparty
 *
 * Plus aggregate counts surfaced on the PromotedMetricsRow. See
 * docs/reference/network-page-ia-redesign.md §10.3 — referrals are the
 * reciprocity metric User Advocate flagged as load-bearing for long-term
 * vendor / planner relationships.
 */

'use server';

import 'server-only';
import { createClient } from '@/shared/api/supabase/server';

export type ReferralDirection = 'received' | 'sent';

export type Referral = {
  id: string;
  direction: ReferralDirection;
  /** Who was credited, as named at the time. */
  counterparty: { id: string; nameAtReferral: string | null };
  /**
   * The org they belonged to WHEN THE REFERRAL HAPPENED, frozen. Not
   * re-resolved when they change jobs -- a past referral keeps explaining
   * itself. Null when the counterparty is itself an org.
   */
  orgAtReferral: { id: string; nameAtReferral: string | null } | null;
  clientName: string | null;
  clientEntity: { id: string; name: string | null } | null;
  relatedDeal: { id: string; title: string | null } | null;
  note: string | null;
  createdAt: string;
  createdByName: string | null;
};

export type EntityReferrals = {
  received: Referral[];
  sent: Referral[];
  receivedCount: number;
  sentCount: number;
  /**
   * Company entities only: referrals credited to PEOPLE who were at this org
   * at the time. Deliberately a separate bucket from received/sent, which
   * count only what this entity was credited with directly.
   *
   * DO NOT SUM these with receivedCount/sentCount. They are two views of
   * overlapping events (the industry framing is sourced vs influenced, or
   * NPSP's hard vs soft credit); adding them double-counts. Label the scope
   * wherever either number is rendered.
   */
  throughTeam: Referral[];
  throughTeamCount: number;
};

export type GetReferralsResult =
  | { ok: true; referrals: EntityReferrals }
  | { ok: false; error: string };

type RawRow = {
  id: string;
  direction: string;
  counterparty_entity_id: string;
  counterparty_org_entity_id: string | null;
  counterparty_name_at_referral: string | null;
  counterparty_org_name_at_referral: string | null;
  client_name: string | null;
  client_entity_id: string | null;
  related_deal_id: string | null;
  note: string | null;
  created_at: string;
  created_by: string | null;
};

const EMPTY: EntityReferrals = {
  received: [],
  sent: [],
  receivedCount: 0,
  sentCount: 0,
  throughTeam: [],
  throughTeamCount: 0,
};

export async function getReferralsForEntity(
  workspaceId: string,
  entityId: string,
): Promise<GetReferralsResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Unauthorized.' };

  const { data, error } = await supabase
    .schema('finance')
    .from('referrals')
    .select(
      'id, direction, counterparty_entity_id, counterparty_org_entity_id, counterparty_name_at_referral, counterparty_org_name_at_referral, client_name, client_entity_id, related_deal_id, note, created_at, created_by',
    )
    .eq('workspace_id', workspaceId)
    // Direct credit OR credit through someone who was at this org at the time.
    // Partitioned below -- the two are never merged into one count.
    .or(`counterparty_entity_id.eq.${entityId},counterparty_org_entity_id.eq.${entityId}`)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return { ok: false, error: (error as { message: string }).message };

  const rows: RawRow[] = (data ?? []) as RawRow[];
  if (rows.length === 0) return { ok: true, referrals: EMPTY };

  const { nameByEntityId, titleByDealId, nameByUserId } = await hydrateLookups(supabase, rows);

  const received: Referral[] = [];
  const sent: Referral[] = [];
  const throughTeam: Referral[] = [];

  for (const r of rows) {
    const ref: Referral = {
      id: r.id,
      direction: r.direction as ReferralDirection,
      counterparty: {
        id: r.counterparty_entity_id,
        nameAtReferral: r.counterparty_name_at_referral,
      },
      orgAtReferral: r.counterparty_org_entity_id
        ? {
            id: r.counterparty_org_entity_id,
            nameAtReferral: r.counterparty_org_name_at_referral,
          }
        : null,
      clientName: r.client_name,
      clientEntity: r.client_entity_id
        ? { id: r.client_entity_id, name: nameByEntityId.get(r.client_entity_id) ?? null }
        : null,
      relatedDeal: r.related_deal_id
        ? { id: r.related_deal_id, title: titleByDealId.get(r.related_deal_id) ?? null }
        : null,
      note: r.note,
      createdAt: r.created_at,
      createdByName: r.created_by ? (nameByUserId.get(r.created_by) ?? null) : null,
    };
    // Credit through a team member is its own bucket. A row can only land in
    // one of these, so nothing is counted twice within a single view.
    if (r.counterparty_entity_id !== entityId) {
      throughTeam.push(ref);
    } else if (ref.direction === 'received') {
      received.push(ref);
    } else if (ref.direction === 'sent') {
      sent.push(ref);
    }
  }

  return {
    ok: true,
    referrals: {
      received,
      sent,
      receivedCount: received.length,
      sentCount: sent.length,
      throughTeam,
      throughTeamCount: throughTeam.length,
    },
  };
}

/**
 * Resolve the display names a referral row references: client entity, related
 * deal, and the user who logged it.
 *
 * Note these are LIVE lookups, and deliberately so -- they name things the
 * referral points AT. The counterparty and their org are different: those come
 * off the frozen `*_at_referral` columns on the row itself, because renaming or
 * reassigning them must not rewrite what a past referral says.
 */
async function hydrateLookups(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the server client's generic parameters vary; only .from()/.schema() are used.
  supabase: any,
  rows: RawRow[],
): Promise<{
  nameByEntityId: Map<string, string | null>;
  titleByDealId: Map<string, string | null>;
  nameByUserId: Map<string, string | null>;
}> {
  const clientEntityIds = Array.from(
    new Set(rows.map((r) => r.client_entity_id).filter((x): x is string => !!x)),
  );
  const dealIds = Array.from(
    new Set(rows.map((r) => r.related_deal_id).filter((x): x is string => !!x)),
  );
  const userIds = Array.from(
    new Set(rows.map((r) => r.created_by).filter((x): x is string => !!x)),
  );

  const [clientEnts, deals, profiles] = await Promise.all([
    clientEntityIds.length > 0
      ? supabase.schema('directory').from('entities').select('id, display_name').in('id', clientEntityIds)
      : Promise.resolve({ data: [] as { id: string; display_name: string | null }[] }),
    dealIds.length > 0
      ? supabase.from('deals').select('id, title').in('id', dealIds)
      : Promise.resolve({ data: [] as { id: string; title: string | null }[] }),
    userIds.length > 0
      ? supabase.from('profiles').select('id, full_name').in('id', userIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
  ]);

  const nameByEntityId = new Map<string, string | null>();
  for (const e of (clientEnts.data ?? []) as { id: string; display_name: string | null }[]) {
    nameByEntityId.set(e.id, e.display_name);
  }
  const titleByDealId = new Map<string, string | null>();
  for (const d of (deals.data ?? []) as { id: string; title: string | null }[]) {
    titleByDealId.set(d.id, d.title);
  }
  const nameByUserId = new Map<string, string | null>();
  for (const pr of (profiles.data ?? []) as { id: string; full_name: string | null }[]) {
    nameByUserId.set(pr.id, pr.full_name);
  }

  return { nameByEntityId, titleByDealId, nameByUserId };
}
