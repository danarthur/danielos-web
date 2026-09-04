/**
 * LineItemGrid row selection — builder-only opt-in.
 *
 * Regression: the proposal builder passed selectedBlockIdx/onSelectBlock into
 * DocumentBody but never used them, so rows in the proposal preview were inert.
 * Changing a line's price meant switching to the Inspector tab and hunting for
 * the row there.
 *
 * The client-facing proposal must stay inert, so selection is opt-in: pass no
 * onItemClick and nothing changes.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LineItemGrid } from '../LineItemGrid';

const items = [
  { id: 'item-gold', name: 'Gold Package', description: null, quantity: 1, unit_price: 5000, sort_order: 0 },
  { id: 'item-led', name: 'LED Wall', description: null, quantity: 2, unit_price: 900, sort_order: 1 },
] as never[];

describe('<LineItemGrid /> selection', () => {
  it('stays inert for the client when no handler is passed', () => {
    render(<LineItemGrid items={items} disabled layout="row" />);
    expect(screen.queryByRole('button', { name: /Edit Gold Package/ })).toBeNull();
  });

  it('makes each row selectable in the builder', () => {
    const onItemClick = vi.fn();
    render(<LineItemGrid items={items} disabled layout="row" onItemClick={onItemClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Gold Package' }));
    expect(onItemClick).toHaveBeenCalledWith('item-gold');
  });

  it('marks only the selected row as pressed', () => {
    render(
      <LineItemGrid items={items} disabled layout="row" onItemClick={vi.fn()} selectedItemId="item-led" />,
    );
    expect(screen.getByRole('button', { name: 'Edit LED Wall' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Edit Gold Package' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('selects with the keyboard as well as the mouse', () => {
    const onItemClick = vi.fn();
    render(<LineItemGrid items={items} disabled layout="row" onItemClick={onItemClick} />);
    const row = screen.getByRole('button', { name: 'Edit LED Wall' });
    fireEvent.keyDown(row, { key: 'Enter' });
    expect(onItemClick).toHaveBeenCalledWith('item-led');
    fireEvent.keyDown(row, { key: ' ' });
    expect(onItemClick).toHaveBeenCalledTimes(2);
  });
});
