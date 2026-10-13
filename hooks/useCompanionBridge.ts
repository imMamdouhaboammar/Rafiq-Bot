import { useEffect, useState, useCallback } from 'react';
import type { MemoryGrant } from '../contracts/neuroCognitive.js';
import {
  authorizeMemoryBridge,
  revokeMemoryBridge,
} from '../services/companionBridge.js';
import * as NeuroDB from '../services/neuroDb.js';

export interface UseCompanionBridgeResult {
  isBridged: boolean;
  activeGrant: MemoryGrant | null;
  loading: boolean;
  error: string | null;
  enableBridge: (sourceCompanionId: string, categories?: ('facts' | 'preferences' | 'experiences')[]) => Promise<MemoryGrant | null>;
  disableBridge: () => Promise<void>;
  refresh: () => Promise<void>;
}

export const useCompanionBridge = (
  targetCompanionId: string,
  initialSourceCompanionId?: string,
): UseCompanionBridgeResult => {
  const [activeGrant, setActiveGrant] = useState<MemoryGrant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!targetCompanionId) {
      setActiveGrant(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      if (initialSourceCompanionId) {
        const grant = await NeuroDB.getActiveGrant(initialSourceCompanionId, targetCompanionId);
        setActiveGrant(grant || null);
      } else {
        const allGrants = await NeuroDB.listActiveGrants('main_user');
        const found = allGrants.find(g => g.targetCompanionId === targetCompanionId);
        setActiveGrant(found || null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load memory grant');
    } finally {
      setLoading(false);
    }
  }, [targetCompanionId, initialSourceCompanionId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const enableBridge = useCallback(
    async (
      sourceCompanionId: string,
      categories: ('facts' | 'preferences' | 'experiences')[] = ['facts', 'preferences'],
    ): Promise<MemoryGrant | null> => {
      try {
        setLoading(true);
        setError(null);
        const grant = await authorizeMemoryBridge(
          'main_user',
          sourceCompanionId,
          targetCompanionId,
          categories,
        );
        setActiveGrant(grant);
        return grant;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to authorize memory bridge');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [targetCompanionId],
  );

  const disableBridge = useCallback(async () => {
    if (!activeGrant) return;
    try {
      setLoading(true);
      setError(null);
      await revokeMemoryBridge(
        activeGrant.grantId,
        activeGrant.sourceCompanionId,
        activeGrant.targetCompanionId,
      );
      setActiveGrant(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke memory bridge');
    } finally {
      setLoading(false);
    }
  }, [activeGrant]);

  return {
    isBridged: Boolean(activeGrant && !activeGrant.revokedAt),
    activeGrant,
    loading,
    error,
    enableBridge,
    disableBridge,
    refresh,
  };
};
