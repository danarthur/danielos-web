'use client';

/**
 * Workspace vocabulary picker for network categories.
 *
 * Changing a pack changes displayed words only. The underlying category keys
 * are immutable, so filters, exports, reporting and Aion keep working and a
 * teammate in another workspace still sees a coherent product.
 *
 * @module features/network-data/ui/LabelPackPicker
 */

import * as React from 'react';
import { useTransition } from 'react';
import { toast } from 'sonner';

import { setWorkspaceLabelPack } from '../api/label-pack-actions';
import {
  LABEL_PACK_OPTIONS,
  categoryLabels,
  type LabelPack,
} from '@/entities/network/model/label-packs';
import { CATEGORY_ORDER } from '@/entities/network/model/categories';
import { cn } from '@/shared/lib/utils';

export function LabelPackPicker({
  workspaceId,
  initialPack,
}: {
  workspaceId: string;
  initialPack: LabelPack;
}) {
  const [pack, setPack] = React.useState<LabelPack>(initialPack);
  const [isPending, startTransition] = useTransition();

  const choose = (next: LabelPack) => {
    if (next === pack || isPending) return;
    const previous = pack;
    setPack(next);
    startTransition(async () => {
      const result = await setWorkspaceLabelPack(workspaceId, next);
      if (!result.ok) {
        setPack(previous);
        toast.error(result.error);
        return;
      }
      toast.success('Vocabulary updated.');
    });
  };

  const preview = categoryLabels(pack);

  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="Category vocabulary" className="grid gap-2 sm:grid-cols-3">
        {LABEL_PACK_OPTIONS.map((o) => {
          const active = pack === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={isPending}
              onClick={() => choose(o.value)}
              className={cn(
                'flex flex-col items-start gap-0.5 rounded-[var(--stage-radius-input,6px)] px-3 py-2.5 text-left transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--stage-accent)] disabled:opacity-60',
                active
                  ? 'bg-[var(--ctx-card)] text-[var(--stage-text-primary)] border border-[oklch(1_0_0_/_0.12)] shadow-sm'
                  : 'text-[var(--stage-text-secondary)] hover:text-[var(--stage-text-primary)] hover:bg-[oklch(1_0_0_/_0.05)] border border-transparent',
              )}
            >
              <span className="text-[13px] font-medium tracking-tight">{o.label}</span>
              <span className="text-[11px] text-[var(--stage-text-tertiary)]">{o.hint}</span>
            </button>
          );
        })}
      </div>

      <div className="rounded-[var(--stage-radius-nested,8px)] border border-[var(--stage-edge-subtle)] bg-[var(--ctx-well)] p-3">
        <span className="block stage-label mb-2">Your network will read</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {CATEGORY_ORDER.map((c) => (
            <span
              key={c}
              className="rounded-[var(--stage-radius-input,6px)] border border-[var(--stage-edge-subtle)] bg-[oklch(1_0_0_/_0.05)] px-2 py-0.5 text-[12px] text-[var(--stage-text-secondary)]"
            >
              {preview[c]}
            </span>
          ))}
        </div>
        <p className="mt-2.5 stage-label text-[var(--stage-text-tertiary)] normal-case tracking-normal">
          Display only. Reports, exports and Aion keep using the same underlying categories,
          so nothing else changes.
        </p>
      </div>
    </div>
  );
}
