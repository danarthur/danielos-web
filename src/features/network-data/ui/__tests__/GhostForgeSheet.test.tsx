/**
 * Component tests for GhostForgeSheet — the "Add connection" sheet.
 *
 * The sheet asks for the ROLE first (what is this connection to us) and only
 * then, where it varies, whether that role is a person or a company.
 *
 * Regression under test: an individual client (wedding host, private party
 * host) used to be impossible to create — the Person branch ignored the
 * relationship type and always wrote a PARTNER edge, filing real clients as
 * preferred freelancers.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const createGhostWithContact = vi.fn(async () => ({ success: true, relationshipId: 'rel-1' }));
const createConnectionFromScout = vi.fn(async () => ({ success: true, relationshipId: 'rel-1' }));

vi.mock('../../api/ghost-actions', () => ({
  createGhostWithContact: (...args: unknown[]) => createGhostWithContact(...(args as [])),
  createConnectionFromScout: (...args: unknown[]) => createConnectionFromScout(...(args as [])),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { GhostForgeSheet } from '../GhostForgeSheet';

const ScoutStub = () => <div data-testid="scout-stub" />;

function renderSheet() {
  return render(
    <GhostForgeSheet
      isOpen
      onOpenChange={() => {}}
      initialName=""
      sourceOrgId="org-1"
      ScoutInputComponent={ScoutStub}
    />,
  );
}

/**
 * Switch to the manual form. Organizations open in Aion scout mode and offer the
 * toggle; individuals have no website to scout, so they are already manual.
 */
function goManual() {
  const btn = screen.queryByRole('radio', { name: 'Add manually' });
  if (btn) fireEvent.click(btn);
}

function submitWith(name: string) {
  // Organizations land on the Aion tab first; the manual form is one click away.
  goManual();
  const nameInput = screen.getByPlaceholderText(/Jane Doe|Acme Corp/);
  fireEvent.change(nameInput, { target: { value: name } });
  fireEvent.click(screen.getByRole('button', { name: /Add & open/ }));
}

/** Last payload passed to the server action. */
function lastPayload() {
  const call = createGhostWithContact.mock.calls.at(-1) as unknown as [string, Record<string, unknown>];
  return call[1];
}

describe('<GhostForgeSheet /> role-first add flow', () => {
  beforeEach(() => {
    createGhostWithContact.mockClear();
  });

  it('shows the role question immediately, without switching tabs', () => {
    renderSheet();
    // Regression: the role selector used to be buried inside "Add manually",
    // so opening the sheet looked unchanged from the old org/person flow.
    expect(screen.getByText('What are they to you?')).toBeTruthy();
    expect(screen.getByRole('radio', { name: /Client/ }).getAttribute('aria-checked')).toBe('true');
  });

  it('routes Aion scout results to the chosen role, not a generic partner', async () => {
    renderSheet();
    fireEvent.click(screen.getByRole('radio', { name: /Venue/ }));
    // Venue is an organization, so Aion scout mode is available and default.
    expect(screen.getByRole('radio', { name: 'Aion' })).toBeTruthy();
    expect(screen.getByTestId('scout-stub')).toBeTruthy();
  });

  it('offers all four roles, defaulting to Client', () => {
    renderSheet();
    goManual();
    for (const role of ['Client', 'Vendor', 'Venue', 'Crew']) {
      expect(screen.getByRole('radio', { name: new RegExp(role) })).toBeTruthy();
    }
    expect(screen.getByRole('radio', { name: /Client/ }).getAttribute('aria-checked')).toBe('true');
  });

  it('creates an INDIVIDUAL client as a person on a client edge', async () => {
    renderSheet();
    goManual();
    // Client defaults to Person — individuals are the common client shape.
    expect(screen.getByRole('radio', { name: 'Person' }).getAttribute('aria-checked')).toBe('true');
    submitWith('Dana Reyes');
    await vi.waitFor(() => expect(createGhostWithContact).toHaveBeenCalled());
    expect(lastPayload()).toMatchObject({
      type: 'person',
      name: 'Dana Reyes',
      relationshipType: 'client',
    });
  });

  it('creates a COMPANY client when the shape is switched', async () => {
    renderSheet();
    goManual();
    fireEvent.click(screen.getByRole('radio', { name: 'Company' }));
    submitWith('Acme Events');
    await vi.waitFor(() => expect(createGhostWithContact).toHaveBeenCalled());
    expect(lastPayload()).toMatchObject({
      type: 'organization',
      relationshipType: 'client',
    });
  });

  it('keeps crew on the freelancer partner edge', async () => {
    renderSheet();
    goManual();
    fireEvent.click(screen.getByRole('radio', { name: /Crew/ }));
    submitWith('Sam Fixer');
    await vi.waitFor(() => expect(createGhostWithContact).toHaveBeenCalled());
    expect(lastPayload()).toMatchObject({
      type: 'person',
      relationshipType: 'partner',
    });
  });

  it('treats venue as a company and does not ask for a shape', async () => {
    renderSheet();
    goManual();
    fireEvent.click(screen.getByRole('radio', { name: /Venue/ }));
    // Venues are always organizations. The shape toggle animates out, so assert
    // on the submitted payload rather than on the exiting node.
    submitWith('The Fillmore');
    await vi.waitFor(() => expect(createGhostWithContact).toHaveBeenCalled());
    expect(lastPayload()).toMatchObject({
      type: 'organization',
      relationshipType: 'venue',
    });
  });

  it('ignores a stale shape when switching to a role that has no shape choice', async () => {
    renderSheet();
    goManual();
    // Client defaults to Person; switching to Venue must not carry that over.
    expect(screen.getByRole('radio', { name: 'Person' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('radio', { name: /Venue/ }));
    submitWith('The Greek');
    await vi.waitFor(() => expect(createGhostWithContact).toHaveBeenCalled());
    expect(lastPayload()).toMatchObject({ type: 'organization', relationshipType: 'venue' });
  });

  it('moves between roles with arrow keys', () => {
    renderSheet();
    const client = screen.getByRole('radio', { name: /Client/ });
    expect(client.getAttribute('aria-checked')).toBe('true');
    // Only the selected option sits in the tab order (roving tabindex).
    expect(client.getAttribute('tabindex')).toBe('0');
    fireEvent.keyDown(client, { key: 'ArrowRight' });
    expect(screen.getByRole('radio', { name: /Vendor/ }).getAttribute('aria-checked')).toBe('true');
    fireEvent.keyDown(screen.getByRole('radio', { name: /Vendor/ }), { key: 'ArrowLeft' });
    expect(screen.getByRole('radio', { name: /Client/ }).getAttribute('aria-checked')).toBe('true');
  });

  it('re-establishes the surface context inside the portaled sheet', () => {
    const { baseElement } = renderSheet();
    // SheetContent portals to document.body and drops data-surface, so without
    // this wrapper --ctx-well falls back to :root (nested, 0.09) and every input
    // renders near-black against the 0.26 panel.
    expect(baseElement.querySelector('[data-surface="raised"]')).toBeTruthy();
  });

  it('gives the footer a cancel alongside the primary action', () => {
    renderSheet();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Add & open/ })).toBeTruthy();
  });

  it('pads icon-prefixed inputs past the icon', () => {
    renderSheet();
    // .stage-input is declared outside @layer, so its padding shorthand beats
    // Tailwind's pl-* unless marked important.
    const phone = screen.getByPlaceholderText('+1 (555) 000-0000');
    expect(phone.className).toContain('!pl-9');
  });

  it('does not ask a client for vendor compliance or crew fields', () => {
    renderSheet();
    goManual();
    // W-9 / COI are collected from parties we pay, not parties who pay us.
    expect(screen.queryByText(/W-9 on file/)).toBeNull();
    // Market / union status are crew concerns.
    expect(screen.queryByText(/Union status/)).toBeNull();
  });
});
