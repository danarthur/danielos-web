/**
 * Quick-edit sheet for deal-header stakeholders.
 *
 * Regression: the header had no way to edit a stakeholder's basic details —
 * a venue with no address could only be fixed by leaving the event page, and
 * the chip link was broken anyway. The sheet covers the basic tier and links
 * through for the rest.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const saveEntityQuickEdit = vi.fn(async () => ({ ok: true }));

vi.mock('../../actions/quick-edit-entity', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../../actions/quick-edit-entity');
  return { ...actual, saveEntityQuickEdit: (...a: unknown[]) => saveEntityQuickEdit(...(a as [])) };
});
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { DealHeaderQuickEditSheet } from '../deal-header-quick-edit-sheet';
import type { QuickEditData } from '../../actions/quick-edit-fields';

const venue: QuickEditData = {
  entityId: 'venue-1',
  kind: 'venue',
  displayName: 'Hidden Estate',
  values: { street: '', city: '', state: '', postal_code: '', venue_contact_phone: '', website: '' },
};

function renderSheet(data: QuickEditData | null = venue) {
  return render(
    <DealHeaderQuickEditSheet open data={data} onOpenChange={() => {}} onSaved={() => {}} />,
  );
}

describe('<DealHeaderQuickEditSheet />', () => {
  beforeEach(() => saveEntityQuickEdit.mockClear());

  it('offers the venue address fields', () => {
    renderSheet();
    expect(screen.getByText('Hidden Estate')).toBeTruthy();
    for (const label of ['Street', 'City', 'State', 'Postal code']) {
      expect(screen.getByLabelText(label)).toBeTruthy();
    }
  });

  it('saves the edited values for the right entity', async () => {
    renderSheet();
    fireEvent.change(screen.getByLabelText('Street'), { target: { value: '1 Vineyard Ln' } });
    fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Napa' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => expect(saveEntityQuickEdit).toHaveBeenCalled());
    const [entityId, kind, values] = saveEntityQuickEdit.mock.calls.at(-1) as unknown as [
      string, string, Record<string, string>,
    ];
    expect(entityId).toBe('venue-1');
    expect(kind).toBe('venue');
    expect(values.street).toBe('1 Vineyard Ln');
    expect(values.city).toBe('Napa');
  });

  it('links through to the full profile for anything deeper', () => {
    renderSheet();
    const link = screen.getByRole('link', { name: /Open full profile/ });
    expect(link.getAttribute('href')).toBe('/network/entity/venue-1');
  });

  it('shows person fields for a person, not venue fields', () => {
    renderSheet({
      entityId: 'p-1',
      kind: 'person',
      displayName: 'Cassidy',
      values: { phone: '', email: '', job_title: '' },
    });
    expect(screen.getByLabelText('Phone')).toBeTruthy();
    expect(screen.queryByLabelText('Street')).toBeNull();
  });
});
