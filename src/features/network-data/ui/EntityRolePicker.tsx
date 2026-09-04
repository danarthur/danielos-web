'use client';

/**
 * Assign crew roles to a person.
 *
 * Multi-select on purpose: in live events dual-role is the norm rather than the
 * exception -- the DJ who also MCs, the tech who also drives the truck. Forcing
 * one role means the person goes missing from a search they should match.
 *
 * @module features/network-data/ui/EntityRolePicker
 */

import * as React from 'react';
import { useTransition } from 'react';
import { toast } from 'sonner';

import { listCrewRoles, getEntityRoles, setEntityRoles } from '../api/crew-role-actions';
import type { CrewRole } from '../api/crew-role-actions';
import { cn } from '@/shared/lib/utils';

export function EntityRolePicker({
  workspaceId,
  entityId,
}: {
  workspaceId: string | null;
  entityId: string | null;
}) {
  const [roles, setRoles] = React.useState<CrewRole[]>([]);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [loading, setLoading] = React.useState(true);
  const [isPending, startTransition] = useTransition();

  React.useEffect(() => {
    if (!workspaceId || !entityId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    Promise.all([listCrewRoles(workspaceId), getEntityRoles(workspaceId, entityId)]).then(
      ([all, mine]) => {
        if (cancelled) return;
        setRoles(all);
        setSelected(new Set(mine));
        setLoading(false);
      },
    );
    return () => { cancelled = true; };
  }, [workspaceId, entityId]);

  if (loading || !workspaceId || !entityId) return null;

  // Nothing to assign from yet. Silence beats an empty control -- the vocabulary
  // is set up in Settings -> Network, not here.
  if (roles.length === 0) return null;

  const toggle = (slug: string) => {
    if (isPending) return;
    const next = new Set(selected);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    setSelected(next);
    startTransition(async () => {
      const result = await setEntityRoles(workspaceId, entityId, [...next]);
      if (!result.ok) {
        setSelected(selected);
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="space-y-2">
      <span className="block stage-label">Roles</span>
      <div role="group" aria-label="Crew roles" className="flex flex-wrap items-center gap-1.5">
        {roles.map((r) => {
          const on = selected.has(r.slug);
          return (
            <button
              key={r.slug}
              type="button"
              aria-pressed={on}
              disabled={isPending}
              onClick={() => toggle(r.slug)}
              className={cn(
                'rounded-[var(--stage-radius-input,6px)] px-2 py-0.5 text-[12px] tracking-tight transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--stage-accent)] disabled:opacity-60',
                on
                  ? 'bg-[var(--ctx-card)] text-[var(--stage-text-primary)] border border-[oklch(1_0_0_/_0.12)]'
                  : 'text-[var(--stage-text-secondary)] hover:text-[var(--stage-text-primary)] border border-transparent hover:bg-[oklch(1_0_0_/_0.05)]',
              )}
            >
              {r.label}
            </button>
          );
        })}
      </div>
      <p className="stage-label text-[var(--stage-text-tertiary)] normal-case tracking-normal">
        Pick every role this person covers. Someone who DJs and MCs shows up under both.
      </p>
    </div>
  );
}
