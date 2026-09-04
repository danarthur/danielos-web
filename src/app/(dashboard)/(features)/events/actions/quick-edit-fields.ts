/**
 * Field definitions for the deal-header quick-edit sheet.
 *
 * Kept out of quick-edit-entity.ts because that file is 'use server', which may
 * only export async functions — exporting this object from there fails the
 * build with "A 'use server' file can only export async functions, found
 * object." Both the server action and the client sheet import from here.
 */

import {
  PERSON_ATTR,
  COMPANY_ATTR,
  VENUE_ATTR,
} from '@/entities/directory/model/attribute-keys';

/** Entity shapes this editor knows how to render. */
export type QuickEditKind = 'venue' | 'company' | 'person';

export type QuickEditField = {
  key: string;
  label: string;
  placeholder?: string;
  /** Company addresses live in a nested `address` object; venues are top-level. */
  group?: 'address';
};

export type QuickEditData = {
  entityId: string;
  kind: QuickEditKind;
  displayName: string;
  values: Record<string, string>;
};

/**
 * The editable field set per entity kind. Deliberately short: this is the
 * "basic information" tier, not the full entity studio.
 */
export const QUICK_EDIT_FIELDS: Record<QuickEditKind, QuickEditField[]> = {
  venue: [
    { key: VENUE_ATTR.street, label: 'Street' },
    { key: VENUE_ATTR.city, label: 'City' },
    { key: VENUE_ATTR.state, label: 'State' },
    { key: VENUE_ATTR.postal_code, label: 'Postal code' },
    { key: VENUE_ATTR.venue_contact_phone, label: 'House contact phone' },
    { key: VENUE_ATTR.website, label: 'Website' },
  ],
  company: [
    { key: 'street', label: 'Street', group: 'address' },
    { key: 'city', label: 'City', group: 'address' },
    { key: 'state', label: 'State', group: 'address' },
    { key: 'postal_code', label: 'Postal code', group: 'address' },
    { key: COMPANY_ATTR.support_email, label: 'Email' },
    { key: COMPANY_ATTR.website, label: 'Website' },
  ],
  person: [
    { key: PERSON_ATTR.phone, label: 'Phone' },
    { key: PERSON_ATTR.email, label: 'Email' },
    { key: PERSON_ATTR.job_title, label: 'Role / title' },
  ],
};
