'use server';

/**
 * Quick-edit for deal-header stakeholders — read and patch the handful of
 * fields worth changing without leaving the event page (a venue's address, a
 * planner's website, a contact's phone). Anything deeper lives on the entity
 * page at /network/entity/[id].
 *
 * Reads go through readEntityAttrs and writes go through the per-type Zod
 * schema before patch_entity_attributes, per CLAUDE.md rule 9 — no raw
 * dot/bracket access on entity.attributes, no unvalidated patches.
 */

import 'server-only';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/shared/api/supabase/server';
import {
  readEntityAttrs,
  PersonAttrsSchema,
  CompanyAttrsSchema,
  VenueAttrsSchema,
} from '@/shared/lib/entity-attrs';
import { COMPANY_ATTR } from '@/entities/directory/model/attribute-keys';
import {
  readEntityAddress,
  buildAddressPatch,
  type EntityAddress,
} from '@/shared/lib/entity-address';
import { QUICK_EDIT_FIELDS, type QuickEditKind, type QuickEditData } from './quick-edit-fields';

/** directory.entities.type → the editor shape we render. */
function toKind(entityType: string | null | undefined): QuickEditKind | null {
  if (entityType === 'venue') return 'venue';
  if (entityType === 'company') return 'company';
  if (entityType === 'person') return 'person';
  // 'couple' has its own dedicated editor; anything else is unsupported here.
  return null;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '';
}

/** Load the current values for the quick-edit form. */
export async function getEntityQuickEdit(entityId: string): Promise<QuickEditData | null> {
  if (!entityId) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema('directory')
    .from('entities')
    .select('id, type, display_name, attributes')
    .eq('id', entityId)
    .maybeSingle();
  if (error || !data) return null;

  const kind = toKind(data.type);
  if (!kind) return null;

  const values: Record<string, string> = {};
  // Address fields resolve through readEntityAddress so whatever the contact
  // page (or Aion, or an import) stored shows up here — otherwise the form
  // would open blank and a save would blank the record.
  const raw = (data.attributes ?? {}) as Record<string, unknown>;
  const address = readEntityAddress(raw);
  const ADDRESS_KEYS = new Set(['street', 'city', 'state', 'postal_code']);

  if (kind === 'venue') {
    const attrs = readEntityAttrs(data.attributes, 'venue');
    for (const f of QUICK_EDIT_FIELDS.venue) {
      values[f.key] = ADDRESS_KEYS.has(f.key)
        ? address[f.key as keyof EntityAddress]
        : str((attrs as Record<string, unknown>)[f.key]);
    }
  } else if (kind === 'company') {
    const attrs = readEntityAttrs(data.attributes, 'company');
    for (const f of QUICK_EDIT_FIELDS.company) {
      values[f.key] = f.group === 'address'
        ? address[f.key as keyof EntityAddress]
        : str((attrs as Record<string, unknown>)[f.key]);
    }
  } else {
    const attrs = readEntityAttrs(data.attributes, 'person');
    for (const f of QUICK_EDIT_FIELDS.person) {
      values[f.key] = str((attrs as Record<string, unknown>)[f.key]);
    }
  }

  return {
    entityId: data.id as string,
    kind,
    displayName: (data.display_name as string) ?? '',
    values,
  };
}

type SaveResult = { ok: true } | { ok: false; error: string };

/**
 * Patch the quick-edit fields. Only keys in QUICK_EDIT_FIELDS are accepted,
 * and the assembled patch is validated against the entity's Zod schema before
 * it reaches the RPC.
 */
export async function saveEntityQuickEdit(
  entityId: string,
  kind: QuickEditKind,
  values: Record<string, string>,
): Promise<SaveResult> {
  if (!entityId) return { ok: false, error: 'Missing entity.' };
  const fields = QUICK_EDIT_FIELDS[kind];
  if (!fields) return { ok: false, error: 'Unsupported entity type.' };

  const supabase = await createClient();
  const patch: Record<string, unknown> = {};
  const addressEdits: Record<string, string> = {};
  const ADDRESS_KEYS = new Set(['street', 'city', 'state', 'postal_code']);

  for (const f of fields) {
    if (!(f.key in values)) continue;
    const v = values[f.key]?.trim() ?? '';
    if (f.group === 'address' || (kind === 'venue' && ADDRESS_KEYS.has(f.key))) {
      addressEdits[f.key] = v;
    } else {
      patch[f.key] = v === '' ? null : v;
    }
  }

  if (Object.keys(addressEdits).length > 0) {
    // Merge onto the stored address so fields this form does not show (country)
    // survive, then write every shape the app reads.
    const { data: existing } = await supabase
      .schema('directory')
      .from('entities')
      .select('attributes')
      .eq('id', entityId)
      .maybeSingle();
    const current = readEntityAddress((existing?.attributes ?? {}) as Record<string, unknown>);
    Object.assign(patch, buildAddressPatch({ ...current, ...addressEdits } as EntityAddress));
  }

  if (Object.keys(patch).length === 0) return { ok: true };

  // Validate the patch shape before writing. partial() so we only assert the
  // keys we are actually sending.
  const schema =
    kind === 'venue' ? VenueAttrsSchema : kind === 'company' ? CompanyAttrsSchema : PersonAttrsSchema;
  const parsed = schema.partial().safeParse(patch);
  if (!parsed.success) {
    return { ok: false, error: 'Those values are not valid for this record.' };
  }

  const { error } = await supabase.rpc('patch_entity_attributes', {
    p_entity_id: entityId,
    p_attributes: patch,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath('/events');
  revalidatePath(`/network/entity/${entityId}`);
  return { ok: true };
}
