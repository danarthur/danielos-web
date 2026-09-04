'use client';

/**
 * Crew role vocabulary manager.
 *
 * Roles are the coarse "what someone is" layer (Lighting, DJ, Rigging), as
 * distinct from skills, which are the fine "what they can do" layer (GrandMA3,
 * Audio A1). The existing skill presets mix both; role_tag is what separates
 * them, and this is where that vocabulary is curated.
 *
 * Not to be confused with the Role Builder in Settings -> Roles, which governs
 * permissions. A ghost freelancer with no login is still a DJ.
 *
 * @module features/network-data/ui/CrewRoleManager
 */

import * as React from 'react';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { Plus, X } from 'lucide-react';

import { createCrewRole, archiveCrewRole, seedCrewRoles } from '../api/crew-role-actions';
import type { CrewRole } from '../api/crew-role-actions';
import { roleSeedsFor } from '@/entities/network/model/role-vocabulary';
import type { LabelPack } from '@/entities/network/model/label-packs';
import { cn } from '@/shared/lib/utils';

export function CrewRoleManager({
  workspaceId,
  initialRoles,
  labelPack,
}: {
  workspaceId: string;
  initialRoles: CrewRole[];
  labelPack: LabelPack;
}) {
  const [roles, setRoles] = React.useState<CrewRole[]>(initialRoles);
  const [draft, setDraft] = React.useState('');
  const [isPending, startTransition] = useTransition();

  const refresh = (next: CrewRole[]) => setRoles(next);

  const add = () => {
    const label = draft.trim();
    if (!label || isPending) return;
    startTransition(async () => {
      const result = await createCrewRole(workspaceId, label);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      // Optimistic: the server normalises the slug, so re-sorting on next load
      // is expected. Showing it immediately keeps adding several in a row fast.
      refresh([...roles, { id: `tmp-${label}`, slug: label.toLowerCase(), label, sortOrder: 100 }]);
      setDraft('');
      toast.success('Role added.');
    });
  };

  const archive = (role: CrewRole) => {
    startTransition(async () => {
      const result = await archiveCrewRole(workspaceId, role.slug);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      refresh(roles.filter((r) => r.slug !== role.slug));
      // Archived, not deleted: anyone already tagged keeps a meaningful value.
      toast.success(`${role.label} archived.`);
    });
  };

  const seed = () => {
    startTransition(async () => {
      const result = await seedCrewRoles(workspaceId, labelPack);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      refresh(
        roleSeedsFor(labelPack).map((s, i) => ({ id: `seed-${s.slug}`, slug: s.slug, label: s.label, sortOrder: i })),
      );
      toast.success('Suggested roles added.');
    });
  };

  return (
    <div className="space-y-3">
      {roles.length === 0 ? (
        <div className="rounded-[var(--stage-radius-nested,8px)] border border-dashed border-[var(--stage-edge-subtle)] bg-[var(--ctx-well)] p-4">
          <p className="text-[13px] text-[var(--stage-text-secondary)]">
            No roles yet. Role filtering stays hidden until a category has enough people
            to need it, so there is no rush — but a starting list is quicker than inventing one.
          </p>
          <button
            type="button"
            onClick={seed}
            disabled={isPending}
            className="mt-3 stage-btn stage-btn-primary h-8 rounded-[var(--stage-radius-input,6px)] disabled:opacity-45"
          >
            Use suggested roles
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5">
          {roles.map((r) => (
            <span
              key={r.slug}
              className="inline-flex items-center gap-1 rounded-[var(--stage-radius-input,6px)] border border-[var(--stage-edge-subtle)] bg-[oklch(1_0_0_/_0.05)] px-2 py-0.5 text-[12px] text-[var(--stage-text-secondary)]"
            >
              {r.label}
              <button
                type="button"
                onClick={() => archive(r)}
                disabled={isPending}
                aria-label={`Archive ${r.label}`}
                className="text-[var(--stage-text-tertiary)] hover:text-[var(--stage-text-primary)] disabled:opacity-45"
              >
                <X size={11} strokeWidth={1.75} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Add a role — e.g. Lighting"
          aria-label="New role"
          className={cn('stage-input h-8 flex-1 min-w-0 text-[13px]')}
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim() || isPending}
          className="stage-btn stage-btn-secondary h-8 rounded-[var(--stage-radius-input,6px)] px-3 disabled:opacity-45"
        >
          <Plus size={13} strokeWidth={1.75} />
          Add
        </button>
      </div>

      <p className="stage-label text-[var(--stage-text-tertiary)] normal-case tracking-normal">
        Roles are what someone is — Lighting, DJ. Skills are what they can do — GrandMA3.
        Names are matched case-insensitively, so “DJ” and “dj” stay one role.
      </p>
    </div>
  );
}
