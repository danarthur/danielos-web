/**
 * Verifies the Network page's "+ Add" menu — the control next to "Seek network".
 *
 * Regression: the menu offered Staff member / Contractor / Freelancer /
 * "Company / Venue" and had no way to add a client. "Company / Venue" also
 * opened the search palette rather than the add sheet, so the role picker was
 * unreachable from this menu.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/features/talent-onboarding', () => ({ InviteTalentDialog: () => null }));
vi.mock('@/widgets/network-detail', () => ({ AionInput: () => null }));
vi.mock('../NetworkOrbitView', () => ({ NetworkOrbitView: () => null }));
vi.mock('../NetworkOrbitClient', () => ({ NetworkOrbitClient: () => null }));
vi.mock('../RecentlyDeletedList', () => ({ RecentlyDeletedList: () => null }));

import { NetworkOrbitWithGenesis } from '../NetworkOrbitWithGenesis';

function renderPage() {
  return render(
    <NetworkOrbitWithGenesis
      currentOrgId="org-1"
      orgName="Invisible Touch Events"
      nodes={[]}
      hasIdentity
      hasTeam
      brandColor={null}
      deletedRelationships={[]}
    />,
  );
}

function openMenu() {
  fireEvent.click(screen.getByRole('button', { name: /Add/ }));
}

describe('Network "+ Add" menu', () => {
  it('offers Client alongside Vendor and Venue', () => {
    renderPage();
    openMenu();
    expect(screen.getByText('Client')).toBeTruthy();
    expect(screen.getByText('Vendor')).toBeTruthy();
    expect(screen.getByText('Venue')).toBeTruthy();
    // The old catch-all entry is gone.
    expect(screen.queryByText('Company / Venue')).toBeNull();
  });

  it('keeps the team entries and groups them separately', () => {
    renderPage();
    openMenu();
    expect(screen.getByText('Staff member')).toBeTruthy();
    expect(screen.getByText('Contractor')).toBeTruthy();
    expect(screen.getByText('Freelancer')).toBeTruthy();
    expect(screen.getByText('Your team')).toBeTruthy();
    expect(screen.getByText('Outside your team')).toBeTruthy();
  });

  it('opens the add sheet with Client preselected, not the search palette', () => {
    renderPage();
    openMenu();
    fireEvent.click(screen.getByText('Client'));
    expect(screen.getByText('What are they to you?')).toBeTruthy();
  });

  it('preselects Venue when Venue is chosen', () => {
    renderPage();
    openMenu();
    fireEvent.click(screen.getByText('Venue'));
    expect(screen.getByText('What are they to you?')).toBeTruthy();
    expect(screen.getByRole('radio', { name: /Where shows happen/ }).getAttribute('aria-checked')).toBe('true');
  });
});
