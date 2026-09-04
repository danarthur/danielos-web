'use client';

import * as React from 'react';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, User, Users, Truck, HardHat, Globe, Mail, Phone, MapPin } from 'lucide-react';

import { STAGE_MEDIUM } from '@/shared/lib/motion-constants';

const formStagger = STAGE_MEDIUM;
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose, SheetBody } from '@/shared/ui/sheet';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { createGhostWithContact, createConnectionFromScout } from '../api/ghost-actions';
import type { ScoutResult } from '@/features/intelligence';
import { toast } from 'sonner';
import { cn } from '@/shared/lib/utils';

export interface ScoutInputProps {
  value: string;
  onChange: (val: string) => void;
  onEnrich: (data: ScoutResult) => void;
}

export interface GhostForgeSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  initialName: string;
  sourceOrgId: string;
  /** Aion scout input (injected from widget layer to respect FSD). Required when using scout mode. */
  ScoutInputComponent: React.ComponentType<ScoutInputProps>;
  /** Preselect the role when opened from a role-specific menu entry. */
  initialRole?: ConnectionRole;
}

type RelType = 'vendor' | 'client' | 'venue' | 'partner';

/**
 * What this connection is to us. This is the first question the sheet asks,
 * because it is the one the user already knows the answer to — "who is this to
 * me", not "what shape of record is this". Person-vs-company is asked second,
 * and only where it genuinely varies.
 */
export type ConnectionRole = 'client' | 'vendor' | 'venue' | 'crew';
type Role = ConnectionRole;

/** Whether a person or a company is being added. */
type Shape = 'person' | 'company';

const ROLE_OPTIONS: {
  value: Role;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  hint: string;
}[] = [
  { value: 'client', label: 'Client', icon: Users, hint: 'Who you work for' },
  { value: 'vendor', label: 'Vendor', icon: Truck, hint: 'Who you buy from' },
  { value: 'venue', label: 'Venue', icon: Building2, hint: 'Where shows happen' },
  { value: 'crew', label: 'Crew', icon: HardHat, hint: 'Freelancers you call' },
];

/** Roles where the connection may be either an individual or a company. */
const SHAPE_CHOICE_ROLES: Role[] = ['client', 'vendor'];

/**
 * Default shape per role, chosen from how these records actually occur:
 * clients are usually individuals (hosts, couples), vendors usually companies.
 */
const DEFAULT_SHAPE: Record<Role, Shape> = {
  client: 'person',
  vendor: 'company',
  venue: 'company',
  crew: 'person',
};

/** Role → the relationship type the graph stores. */
const ROLE_TO_REL: Record<Role, RelType> = {
  client: 'client',
  vendor: 'vendor',
  venue: 'venue',
  crew: 'partner',
};

const PAYMENT_TERMS_OPTIONS = [
  { value: '', label: '—' },
  { value: 'Net 15', label: 'Net 15' },
  { value: 'Net 30', label: 'Net 30' },
  { value: '50% deposit', label: '50% deposit' },
  { value: 'Immediate', label: 'Immediate' },
];

/** Left padding for inputs with a leading icon. `!` is required: .stage-input is
 *  declared outside @layer, so its `padding` shorthand beats Tailwind utilities. */
const inputIconCls = '!pl-9';
const labelCls = 'block stage-label mb-1.5';
const selectCls = 'stage-input w-full min-w-0 appearance-none cursor-pointer';

/**
 * Selection styling, matching create-gig-modal.tsx. Selection is signalled by
 * surface lift + edge, not by an accent tint -- brightness is the accent.
 */
const pillBase =
  'flex items-center justify-center gap-2 rounded-[var(--stage-radius-input,6px)] px-3 py-1.5 text-[length:var(--stage-input-font-size,13px)] font-medium tracking-tight transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--stage-accent)]';
const pillActive =
  'bg-[var(--ctx-card)] text-[var(--stage-text-primary)] border border-[oklch(1_0_0_/_0.12)] shadow-sm';
const pillInactive =
  'text-[var(--stage-text-secondary)] hover:text-[var(--stage-text-primary)] hover:bg-[oklch(1_0_0_/_0.05)] border border-transparent';

/**
 * Ghost Forge – slide-over to capture new connection: org or person + primary contact.
 * On submit: creates ghost org (+ optional contact), links to source org, redirects to node detail.
 */
export function GhostForgeSheet({
  isOpen,
  onOpenChange,
  initialName,
  sourceOrgId,
  ScoutInputComponent,
  initialRole = 'client',
}: GhostForgeSheetProps) {
  const router = useRouter();
  const [role, setRole] = React.useState<Role>(initialRole);
  const [shape, setShape] = React.useState<Shape>(DEFAULT_SHAPE[initialRole]);
  const [name, setName] = React.useState(initialName);

  const relType: RelType = ROLE_TO_REL[role];
  const showShapeChoice = SHAPE_CHOICE_ROLES.includes(role);
  // The backend still speaks organization/person; role + shape derive it. Role
  // wins: a venue is always a company and crew is always a person, so a stale
  // `shape` from a previously selected role can never leak through.
  const type: 'organization' | 'person' = showShapeChoice
    ? (shape === 'person' ? 'person' : 'organization')
    : (DEFAULT_SHAPE[role] === 'person' ? 'person' : 'organization');
  const isVenue = role === 'venue';
  // W-9 and COI are things we collect from parties we pay, not parties who pay us.
  const showCompliance = type === 'organization' && role !== 'client';

  const handleRoleChange = React.useCallback((next: Role) => {
    setRole(next);
    setShape(DEFAULT_SHAPE[next]);
  }, []);

  /**
   * Arrow-key roving within the role radiogroup, per the Radio spec in
   * component-catalog.md. role="radio" buttons get no native arrow handling.
   */
  const handleRoleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'];
      if (!keys.includes(e.key)) return;
      e.preventDefault();
      const idx = ROLE_OPTIONS.findIndex((o) => o.value === role);
      const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
      const next = ROLE_OPTIONS[(idx + step + ROLE_OPTIONS.length) % ROLE_OPTIONS.length];
      handleRoleChange(next.value);
      const group = e.currentTarget;
      const buttons = group.querySelectorAll<HTMLButtonElement>('[role="radio"]');
      buttons[ROLE_OPTIONS.indexOf(next)]?.focus();
    },
    [role, handleRoleChange],
  );

  // Shared
  const [email, setEmail] = React.useState('');

  // Organization fields
  const [website, setWebsite] = React.useState('');
  const [contactName, setContactName] = React.useState('');
  const [w9Status, setW9Status] = React.useState(false);
  const [coiExpiry, setCoiExpiry] = React.useState('');
  const [paymentTerms, setPaymentTerms] = React.useState('');

  // Venue-specific (subset of organization)
  const [dockAddress, setDockAddress] = React.useState('');
  const [venuePmName, setVenuePmName] = React.useState('');
  const [venuePmPhone, setVenuePmPhone] = React.useState('');

  // Person fields
  const [phone, setPhone] = React.useState('');
  const [market, setMarket] = React.useState('');
  const [unionStatus, setUnionStatus] = React.useState('');

  const [scoutUrl, setScoutUrl] = React.useState('');
  const [mode, setMode] = React.useState<'scout' | 'manual'>('scout');
  // Aion scouts a website, which only exists for organizations. Individuals
  // always go to the manual form regardless of the last mode chosen.
  const effectiveMode: 'scout' | 'manual' = type === 'person' ? 'manual' : mode;
  const [isPending, startTransition] = useTransition();
  const [isScoutPending, startScoutTransition] = useTransition();

  React.useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setEmail('');
      setWebsite('');
      setContactName('');
      setRole(initialRole);
      setShape(DEFAULT_SHAPE[initialRole]);
      setMode('scout');
      setW9Status(false);
      setCoiExpiry('');
      setPaymentTerms('');
      setDockAddress('');
      setVenuePmName('');
      setVenuePmPhone('');
      setPhone('');
      setMarket('');
      setUnionStatus('');
      setScoutUrl('');
    }
  }, [isOpen, initialName, initialRole]);

  const handleScoutApply = React.useCallback(
    (data: ScoutResult) => {
      startScoutTransition(async () => {
        const result = await createConnectionFromScout(sourceOrgId, data, relType);
        if (result.success) {
          toast.success('Connection added. Details pulled from website.');
          onOpenChange(false);
          router.push(`/network?nodeId=${encodeURIComponent(result.relationshipId)}&kind=external_partner`);
          router.refresh();
        } else {
          toast.error(result.error);
        }
      });
    },
    [sourceOrgId, onOpenChange, router, relType]
  );

  const isSubmitDisabled =
    isPending ||
    (type === 'person'
      ? !name.trim() && !phone.trim()
      : !name.trim());

  const handleSubmit = () => {
    startTransition(async () => {
      const result = await createGhostWithContact(sourceOrgId, {
        type,
        name,
        // Role applies to people and organizations alike.
        relationshipType: relType,
        // Person fields — market and union status are crew-only concerns.
        phone: type === 'person' ? phone.trim() || undefined : undefined,
        market: role === 'crew' ? market.trim() || undefined : undefined,
        unionStatus: role === 'crew' ? unionStatus.trim() || undefined : undefined,
        // Organization fields
        contactName: type === 'organization' ? contactName : undefined,
        website: type === 'organization' ? website.trim() || undefined : undefined,
        w9Status: showCompliance ? w9Status : undefined,
        coiExpiry: showCompliance ? coiExpiry.trim() || undefined : undefined,
        paymentTerms: type === 'organization' ? paymentTerms || undefined : undefined,
        // Venue-specific
        dockAddress: isVenue ? dockAddress.trim() || undefined : undefined,
        venuePmName: isVenue ? venuePmName.trim() || undefined : undefined,
        venuePmPhone: isVenue ? venuePmPhone.trim() || undefined : undefined,
        // Shared
        email: email.trim() || undefined,
      });

      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success('Added.');
      onOpenChange(false);
      if (result.relationshipId) {
        router.push(`/network?nodeId=${encodeURIComponent(result.relationshipId)}&kind=external_partner`);
      }
    });
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        side="center"
        data-surface="raised"
        className="flex w-full max-w-[640px] flex-col border border-[oklch(1_0_0_/_0.08)] bg-[var(--stage-surface-raised)] p-0"
      >
        <SheetHeader className="flex-col items-stretch gap-2 border-b border-[var(--stage-edge-subtle)] px-6 py-6">
          <div className="flex items-center justify-between gap-4">
            <SheetTitle>Add connection</SheetTitle>
            <SheetClose />
          </div>
          <p className="text-[length:var(--stage-input-font-size,13px)] text-[var(--stage-text-secondary)]">
            Tell us what they are to you, then let Aion scout them or add them by hand.
          </p>
        </SheetHeader>

        <SheetBody className="flex-1 space-y-6 px-6 pt-6 overflow-y-auto">
            {/* Role — the first and primary choice. A single-select group, so
              radiogroup semantics rather than a row of toggle buttons. */}
          <div className="space-y-2">
            <span className={labelCls}>What are they to you?</span>
            <div
              role="radiogroup"
              aria-label="What are they to you?"
              onKeyDown={handleRoleKeyDown}
              className="grid grid-cols-2 gap-2"
            >
              {ROLE_OPTIONS.map((o) => {
                const Icon = o.icon;
                const active = role === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    tabIndex={active ? 0 : -1}
                    onClick={() => handleRoleChange(o.value)}
                    className={cn(
                      'flex flex-col items-start gap-0.5 rounded-[var(--stage-radius-input,6px)] px-3 py-2.5 text-left tracking-tight transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--stage-accent)]',
                      active ? pillActive : pillInactive,
                    )}
                  >
                    <span className="flex items-center gap-2 text-[length:var(--stage-input-font-size,13px)] font-medium">
                      <Icon className="size-4" />
                      {o.label}
                    </span>
                    <span className="text-[length:var(--stage-badge-size,10px)] text-[var(--stage-text-tertiary)]">
                      {o.hint}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Shape — only where a role can be either an individual or a company */}
          <AnimatePresence initial={false}>
            {showShapeChoice && (
              <motion.div
                key="shape-toggle"
                className="space-y-2"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
              >
                <span className={labelCls}>
                  Is this {role === 'client' ? 'client' : 'vendor'} a person or a company?
                </span>
                <div
                  role="radiogroup"
                  aria-label="Person or company"
                  className="flex gap-1 rounded-[var(--stage-radius-nested,8px)] border border-[var(--stage-edge-subtle)] bg-[var(--stage-surface-elevated)] p-1"
                >
                  {([
                    { value: 'person' as Shape, label: 'Person', icon: User },
                    { value: 'company' as Shape, label: 'Company', icon: Building2 },
                  ]).map((o) => {
                    const Icon = o.icon;
                    const active = shape === o.value;
                    return (
                      <button
                        key={o.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setShape(o.value)}
                        className={cn(pillBase, 'flex-1', active ? pillActive : pillInactive)}
                      >
                        <Icon className="size-4" />
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* How to fill it in -- Aion scouts a website, so organizations only */}
          {type === 'organization' && (
            <div
              role="radiogroup"
              aria-label="How to add"
              className="flex gap-1 rounded-[var(--stage-radius-nested,8px)] border border-[var(--stage-edge-subtle)] bg-[var(--stage-surface-elevated)] p-1"
            >
              {([
                { value: 'scout' as const, label: 'Aion' },
                { value: 'manual' as const, label: 'Add manually' },
              ]).map((o) => {
                const active = effectiveMode === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setMode(o.value)}
                    className={cn(pillBase, 'flex-1', active ? pillActive : pillInactive)}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          )}

          {effectiveMode === 'scout' && (
            <motion.section
              className="rounded-[var(--stage-radius-nested,8px)] border border-[var(--stage-edge-subtle)] bg-[var(--ctx-well)] p-4 space-y-3"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={formStagger}
            >
              <div>
                <h3 className="text-[length:var(--stage-input-font-size,13px)] font-medium text-[var(--stage-text-primary)] tracking-tight">
                  Ask Aion to scout
                </h3>
                <p className="text-xs text-[var(--stage-text-secondary)] mt-0.5">
                  Paste a company website — Aion will pull the name, logo, and team so you don&apos;t have to type it.
                </p>
              </div>
              <ScoutInputComponent
                value={scoutUrl}
                onChange={setScoutUrl}
                onEnrich={handleScoutApply}
              />
              {isScoutPending && (
                <p className="stage-label text-[var(--stage-accent)]/90">
                  Creating connection…
                </p>
              )}
            </motion.section>
          )}

          {effectiveMode === 'manual' && (
            <>
              {/* ── PERSON FORM ─────────────────────────────────────── */}
              {type === 'person' && (
                <>
                  {/* Name */}
                  <div className="space-y-2">
                    <label className={labelCls}>Name</label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Jane Doe"
                    />
                  </div>

                  {/* Phone -- most time-critical field for crew */}
                  <div className="space-y-2">
                    <label className={labelCls}>Phone</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--stage-text-secondary)]" />
                      <Input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+1 (555) 000-0000"
                        className={inputIconCls}
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div className="space-y-2">
                    <label className={labelCls}>Email <span className="normal-case tracking-normal text-[var(--stage-text-secondary)]/60">(optional)</span></label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--stage-text-secondary)]" />
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="email@example.com"
                        className={inputIconCls}
                      />
                    </div>
                  </div>

                  {/* Market -- crew only */}
                  {role === 'crew' && (
                  <div className="space-y-2">
                    <label className={labelCls}>Market <span className="normal-case tracking-normal text-[var(--stage-text-secondary)]/60">(optional)</span></label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--stage-text-secondary)]" />
                      <Input
                        value={market}
                        onChange={(e) => setMarket(e.target.value)}
                        placeholder="Home market"
                        className={inputIconCls}
                      />
                    </div>
                  </div>
                  )}

                  {/* Union status -- crew only */}
                  {role === 'crew' && (
                  <div className="space-y-2">
                    <label className={labelCls}>Union status <span className="normal-case tracking-normal text-[var(--stage-text-secondary)]/60">(optional)</span></label>
                    <Input
                      value={unionStatus}
                      onChange={(e) => setUnionStatus(e.target.value)}
                      placeholder="e.g. IATSE Local 33 or Non-union"
                    />
                  </div>
                  )}
                </>
              )}

              {/* ── ORGANIZATION FORM ────────────────────────────────── */}
              {type === 'organization' && (
                <>
                  {/* Name */}
                  <div className="space-y-2">
                    <label className={labelCls}>Name</label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Acme Corp"
                    />
                  </div>

                  {/* Website */}
                  <div className="space-y-2">
                    <label className={labelCls}>Website <span className="normal-case tracking-normal text-[var(--stage-text-secondary)]/60">(optional)</span></label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--stage-text-secondary)]" />
                      <Input
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        placeholder="example.com"
                        className={inputIconCls}
                      />
                    </div>
                  </div>

                  {/* Primary contact */}
                  <div className="space-y-3 border-t border-[var(--stage-edge-subtle)] pt-4">
                    <span className={cn(labelCls, 'block mb-2')}>Primary contact <span className="normal-case tracking-normal text-[var(--stage-text-secondary)]/60">(optional)</span></span>
                    <Input
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="Contact name"
                    />
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--stage-text-secondary)]" />
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="email@example.com"
                        className={inputIconCls}
                      />
                    </div>
                  </div>

                  {/* Compliance fields -- we collect these from parties we pay */}
                  {showCompliance && (
                  <div className="space-y-3 border-t border-[var(--stage-edge-subtle)] pt-4">
                    <span className={cn(labelCls, 'block mb-2')}>Compliance</span>

                    {/* W-9 checkbox */}
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={w9Status}
                        onChange={(e) => setW9Status(e.target.checked)}
                        className="h-4 w-4 rounded border-[oklch(1_0_0_/_0.08)] bg-[oklch(1_0_0_/_0.05)] accent-[var(--stage-accent)]"
                      />
                      <span className="text-[length:var(--stage-input-font-size,13px)] text-[var(--stage-text-secondary)]">W-9 on file</span>
                    </label>

                    {/* COI expiry */}
                    <div className="space-y-1.5">
                      <label className={labelCls}>COI expires <span className="normal-case tracking-normal text-[var(--stage-text-secondary)]/60">(optional)</span></label>
                      <input
                        type="date"
                        value={coiExpiry}
                        onChange={(e) => setCoiExpiry(e.target.value)}
                        className={selectCls}
                      />
                    </div>

                  </div>
                  )}

                  {/* Payment terms -- relevant to clients (invoicing) and vendors (AP) */}
                  <div className="space-y-1.5 border-t border-[var(--stage-edge-subtle)] pt-4">
                    <label className={labelCls}>Payment terms <span className="normal-case tracking-normal text-[var(--stage-text-secondary)]/60">(optional)</span></label>
                    <select
                      value={paymentTerms}
                      onChange={(e) => setPaymentTerms(e.target.value)}
                      className={selectCls}
                    >
                      {PAYMENT_TERMS_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Venue-specific fields -- shown only when relType === 'venue' */}
                  <AnimatePresence>
                    {isVenue && (
                      <motion.div
                        key="venue-fields"
                        className="space-y-3 border-t border-[var(--stage-edge-subtle)] pt-4"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                      >
                        <span className={cn(labelCls, 'block mb-2')}>Venue ops</span>

                        {/* Dock address */}
                        <div className="space-y-1.5">
                          <label className={labelCls}>Dock address <span className="normal-case tracking-normal text-[var(--stage-text-secondary)]/60">(optional)</span></label>
                          <Input
                            value={dockAddress}
                            onChange={(e) => setDockAddress(e.target.value)}
                            placeholder="Truck entrance / loading dock address"
                          />
                        </div>

                        {/* House PM name */}
                        <div className="space-y-1.5">
                          <label className={labelCls}>House PM name <span className="normal-case tracking-normal text-[var(--stage-text-secondary)]/60">(optional)</span></label>
                          <Input
                            value={venuePmName}
                            onChange={(e) => setVenuePmName(e.target.value)}
                            placeholder="House production manager"
                          />
                        </div>

                        {/* House PM phone */}
                        <div className="space-y-1.5">
                          <label className={labelCls}>House PM phone <span className="normal-case tracking-normal text-[var(--stage-text-secondary)]/60">(optional)</span></label>
                          <div className="relative">
                            <Phone className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--stage-text-secondary)]" />
                            <Input
                              type="tel"
                              value={venuePmPhone}
                              onChange={(e) => setVenuePmPhone(e.target.value)}
                              placeholder="Direct cell"
                              className={inputIconCls}
                            />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}
            </>
          )}
        </SheetBody>

        {effectiveMode === 'manual' && (
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
              <Button
                className="flex-1"
                onClick={handleSubmit}
                disabled={isSubmitDisabled}
              >
                {isPending ? 'Adding…' : 'Add & open'}
              </Button>
            </div>
            <p className="mt-2.5 text-center stage-label">
              You can add notes and details next.
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
