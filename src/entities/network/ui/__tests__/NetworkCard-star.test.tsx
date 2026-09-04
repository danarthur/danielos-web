/**
 * NetworkCard — the star and the Preferred badge are different things.
 *
 * Regression: one flag (`gravity === 'inner_circle'`, written from
 * context_data.tier) rendered as a star AND decided category membership, so a
 * personal shortcut was indistinguishable from a shared business judgement.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NetworkCard } from '../NetworkCard';
import type { NetworkNode } from '../../model/types';

function node(over: Partial<NetworkNode>): NetworkNode {
  return {
    id: 'edge-1',
    entityId: 'ent-1',
    kind: 'external_partner',
    gravity: 'outer_orbit',
    identity: { name: 'Waterfront Hilton', avatarUrl: null, label: 'Venue', entityType: 'venue' },
    meta: {},
    ...over,
  } as NetworkNode;
}

describe('<NetworkCard /> star vs preferred', () => {
  it('reflects the user’s own star, not the relationship tier', () => {
    render(<NetworkCard node={node({ starred: true })} onTogglePreferred={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Remove star' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('offers to star an unstarred entity', () => {
    const onToggle = vi.fn();
    render(<NetworkCard node={node({})} onTogglePreferred={onToggle} />);
    const btn = screen.getByRole('button', { name: 'Star for quick access' });
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(btn);
    expect(onToggle).toHaveBeenCalledWith('edge-1');
  });

  it('shows Preferred as a badge, not as the star', () => {
    // A preferred relationship the user has NOT starred: badge present, star
    // still unpressed. These must not track each other.
    render(
      <NetworkCard node={node({ gravity: 'inner_circle', starred: false })} onTogglePreferred={vi.fn()} />,
    );
    expect(screen.getByText('Preferred')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Star for quick access' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('shows no Preferred badge on a standard relationship', () => {
    render(<NetworkCard node={node({ starred: true })} onTogglePreferred={vi.fn()} />);
    expect(screen.queryByText('Preferred')).toBeNull();
  });

  it('offers the star on any node, not just partners', () => {
    // Anyone can be someone you look at a lot, including your own crew.
    render(
      <NetworkCard
        node={node({
          kind: 'internal_employee',
          gravity: 'core',
          identity: { name: 'Sam', avatarUrl: null, label: 'A1', entityType: 'person' },
        })}
        onTogglePreferred={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Star for quick access' })).toBeTruthy();
  });
});
