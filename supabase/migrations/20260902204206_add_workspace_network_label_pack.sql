-- Phase 3: workspace vocabulary over a fixed category set.
--
-- The category KEYS stay immutable -- filters, exports, telemetry and Aion's
-- tools all speak clients / roster / vendors / venues. Only the displayed words
-- change per workspace. Every product that ships renaming draws this same line:
-- Attio freezes the slug, HubSpot the Object Type ID, Salesforce the API name.
--
-- The pack set is deliberately CLOSED. A finite vocabulary keeps help docs,
-- screenshots and support answerable, and keeps Aion's synonym map small enough
-- to test. Free-text renaming makes both unbounded.
--
-- Note on the CHECK: this encodes a real invariant, unlike the
-- deals_event_archetype_check dropped in 20260901204305. That one was a closed
-- enum pinned over a taxonomy the app had deliberately opened up. Here the
-- closed set IS the design. Adding a fourth pack is a one-line migration, and
-- toLabelPack() already falls back to the default for unrecognised values.

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS network_label_pack text NOT NULL DEFAULT 'roster';

ALTER TABLE public.workspaces
  DROP CONSTRAINT IF EXISTS workspaces_network_label_pack_check;

ALTER TABLE public.workspaces
  ADD CONSTRAINT workspaces_network_label_pack_check
  CHECK (network_label_pack IN ('roster', 'crew', 'talent'));

COMMENT ON COLUMN public.workspaces.network_label_pack IS
  'Display vocabulary for network categories. Presentation only -- category keys are immutable and are what all behaviour, exports and Aion tools key off. See src/entities/network/model/label-packs.ts.';
