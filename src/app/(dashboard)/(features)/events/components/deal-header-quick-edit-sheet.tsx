'use client';

/**
 * Quick-edit sheet for a deal-header stakeholder. Covers the basic fields —
 * a venue's address, a planner's website, a contact's phone — so the common
 * case never costs a trip off the event page. The footer links through to the
 * full entity page for anything deeper.
 */

import * as React from 'react';
import { useTransition } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowUpRight } from 'lucide-react';

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose, SheetBody } from '@/shared/ui/sheet';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { saveEntityQuickEdit } from '../actions/quick-edit-entity';
import { QUICK_EDIT_FIELDS, type QuickEditData } from '../actions/quick-edit-fields';

export type DealHeaderQuickEditSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Null while the record is still loading. */
  data: QuickEditData | null;
  /** Called after a successful save so the header can refetch. */
  onSaved: () => void;
};

const KIND_LABEL: Record<string, string> = {
  venue: 'venue',
  company: 'company',
  person: 'contact',
};

export function DealHeaderQuickEditSheet({
  open,
  onOpenChange,
  data,
  onSaved,
}: DealHeaderQuickEditSheetProps) {
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  React.useEffect(() => {
    setValues(data?.values ?? {});
  }, [data]);

  const fields = data ? QUICK_EDIT_FIELDS[data.kind] : [];

  const handleSave = () => {
    if (!data) return;
    startTransition(async () => {
      const result = await saveEntityQuickEdit(data.entityId, data.kind, values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Saved.');
      onOpenChange(false);
      onSaved();
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="center"
        ariaLabel="Edit details"
        className="flex w-full max-w-[520px] flex-col border border-[oklch(1_0_0_/_0.08)] bg-[var(--stage-surface-raised)] p-0"
      >
        <SheetHeader className="flex-col items-stretch gap-2 border-b border-[var(--stage-edge-subtle)] px-6 py-6">
          <div className="flex items-center justify-between gap-4">
            <SheetTitle>{data?.displayName || 'Edit details'}</SheetTitle>
            <SheetClose />
          </div>
          <p className="text-[length:var(--stage-input-font-size,13px)] text-[var(--stage-text-secondary)]">
            {data
              ? `Basic ${KIND_LABEL[data.kind] ?? 'record'} details. Everything else lives on the full profile.`
              : 'Loading…'}
          </p>
        </SheetHeader>

        <SheetBody className="flex-1 space-y-4 overflow-y-auto px-6 pt-6">
          {fields.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <label className="block stage-label mb-1.5" htmlFor={`quick-edit-${f.key}`}>
                {f.label}
              </label>
              <Input
                id={`quick-edit-${f.key}`}
                value={values[f.key] ?? ''}
                placeholder={f.placeholder}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              />
            </div>
          ))}
          {data && (
            <Link
              href={`/network/entity/${encodeURIComponent(data.entityId)}`}
              className="inline-flex items-center gap-1.5 stage-label text-[var(--stage-text-secondary)] hover:text-[var(--stage-text-primary)] transition-colors"
            >
              Open full profile
              <ArrowUpRight className="size-3.5" />
            </Link>
          )}
        </SheetBody>

        <div className="shrink-0 border-t border-[var(--stage-edge-subtle)] px-6 py-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleSave} disabled={isPending || !data}>
              {isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
