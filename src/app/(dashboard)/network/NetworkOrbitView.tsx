'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { StreamLayout } from '@/widgets/network-stream';
import { networkQueries } from '@/features/network-data/api/queries';
import { starEntity, unstarEntity } from '@/features/network-data';
import { useWorkspace } from '@/shared/ui/providers/WorkspaceProvider';
import type { NetworkNode } from '@/entities/network';
import type { LabelPack } from '@/entities/network/model/label-packs';

interface NetworkOrbitViewProps {
  nodes: NetworkNode[];

  sourceOrgId: string;
  /** When true, Genesis Card 1 shows as completed (Establish Identity done). */
  hasIdentity?: boolean;
  /** When true, Genesis Card 2 shows as completed; Card 3 (Connection) becomes active. */
  hasTeam?: boolean;
  /** Org brand color for completed Identity card. */
  brandColor?: string | null;
  onOpenOmni?: () => void;
  onOpenProfile?: () => void;
  labelPack?: LabelPack;
  roleLabels?: Record<string, string>;
}

/**
 * Client wrapper: card click pushes ?nodeId=&kind= to URL; sheet is driven by details from server.
 */
export function NetworkOrbitView({ nodes, sourceOrgId, hasIdentity = false, hasTeam = false, brandColor = null, onOpenOmni, onOpenProfile, labelPack, roleLabels }: NetworkOrbitViewProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();

  const handleNodeClick = (node: NetworkNode) => {
    router.push(`/network?nodeId=${encodeURIComponent(node.id)}&kind=${encodeURIComponent(node.kind)}`);
  };

  // Hover prefetch — by the time the click lands, the network-detail bundle
  // is already warm in TanStack Query cache. The 150ms intent delay lives in
  // StreamLayout so accidental fly-overs don't trigger fetches.
  // perf-patterns.md §4.
  const handleNodeHover = useCallback(
    (node: NetworkNode) => {
      if (!workspaceId) return;
      queryClient.prefetchQuery(
        networkQueries.nodeDetail(workspaceId, node.id, node.kind, sourceOrgId),
      );
    },
    [queryClient, workspaceId, sourceOrgId],
  );

  /**
   * Stars are per-user rows keyed by entity, so the toggle lives here where the
   * workspace is in context. It replaces the old pin/unpin pair, which wrote
   * the shared relationship tier and so changed what every colleague saw.
   */
  const handleToggleStar = useCallback(
    async (entityId: string, starred: boolean) => {
      if (!workspaceId) return { ok: false, error: 'No workspace in context.' };
      return starred
        ? starEntity(workspaceId, entityId)
        : unstarEntity(workspaceId, entityId);
    },
    [workspaceId],
  );

  return (
    <>
      <StreamLayout
        nodes={nodes}
        onNodeClick={handleNodeClick}
        onNodeHover={handleNodeHover}
        onToggleStar={handleToggleStar}
        labelPack={labelPack}
        roleLabels={roleLabels}
        hasIdentity={hasIdentity}
        hasTeam={hasTeam}
        brandColor={brandColor}
        onOpenOmni={onOpenOmni}
        onOpenProfile={onOpenProfile}
      />
    </>
  );
}
