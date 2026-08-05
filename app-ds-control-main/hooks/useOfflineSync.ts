import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';

import { useNetworkConnectivity } from '@/hooks/useNetworkConnectivity';
import { migrateLegacyOfflineApplicationQueue } from '@/offline/offlineLegacyMigration';
import {
  claimOfflineOperations,
  completeOfflineOperation,
  countPendingOfflineOperations,
  getOfflineServiceOrders,
  getOfflineSupportData,
  retryOfflineOperation,
} from '@/offline/offlineStorage';
import type { OfflineOutboxOperation } from '@/offline/offlineTypes';
import { useAuth } from '@/providers/auth.provider';
import { api } from '@/services/api.service';
import type { Application } from '@/types/applications.type';
import type { OfflineDataCache } from '@/types/offline-application.type';

type SyncOperationResult =
  | {
      idempotencyKey: string;
      status: 'SUCCEEDED';
      application: Application;
      replayed: boolean;
    }
  | {
      idempotencyKey: string;
      status: 'FAILED';
      error: string;
    };

export const useOfflineSync = () => {
  const { isConnected } = useNetworkConnectivity();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'completed' | 'error'>('idle');
  const [offlineDataCache, setOfflineDataCache] = useState<OfflineDataCache | null>(null);
  const [isLoadingCache, setIsLoadingCache] = useState(true);

  const checkPendingApplications = useCallback(async () => {
    await migrateLegacyOfflineApplicationQueue().catch(() => undefined);
    setPendingCount(await countPendingOfflineOperations());
  }, []);

  const checkOfflineDataCache = useCallback(async () => {
    setIsLoadingCache(true);
    try {
      const [supportData, serviceOrders] = await Promise.all([
        getOfflineSupportData(),
        getOfflineServiceOrders(),
      ]);
      setOfflineDataCache({
        pilot: user?.type === 'pilot' ? { id: user.id, name: user.name } : null,
        assistants: supportData.assistants.map((item) => ({
          id: String(item.id ?? ''),
          name: String(item.name ?? ''),
        })),
        drones: supportData.drones.map((item) => ({
          id: String(item.id ?? ''),
          name: String(item.name ?? ''),
        })),
        cultureTypes: supportData.cultureTypes.map((item) => ({
          id: String(item.id ?? ''),
          name: String(item.name ?? ''),
        })),
        products: supportData.products.map((item) => ({
          id: String(item.id ?? ''),
          name: String(item.name ?? ''),
        })),
        serviceOrders,
        lastUpdated: new Date().toISOString(),
      });
    } finally {
      setIsLoadingCache(false);
    }
  }, [user]);

  useEffect(() => {
    checkPendingApplications();
    checkOfflineDataCache();
  }, [checkPendingApplications, checkOfflineDataCache]);

  const syncOfflineApplications = useCallback(async () => {
    if (!isConnected || isSyncing) return;
    setIsSyncing(true);
    setSyncStatus('syncing');
    let operations: OfflineOutboxOperation[] = [];
    try {
      operations = await claimOfflineOperations();
      if (operations.length === 0) {
        setSyncStatus('completed');
        return;
      }
      const response = await api('/mobile/offline/operations/sync', {
        method: 'POST',
        body: JSON.stringify({
          operations: operations.map((operation) => ({
            idempotencyKey: operation.idempotencyKey,
            operationType: operation.operationType,
            payload: operation.payload,
          })),
        }),
      });
      if (!response.ok) {
        throw new Error(`Falha ao sincronizar operacoes offline (${response.status}).`);
      }
      const body = (await response.json()) as { results: SyncOperationResult[] };
      const results = new Map(body.results.map((result) => [result.idempotencyKey, result]));
      for (const operation of operations) {
        const result = results.get(operation.idempotencyKey);
        if (result?.status === 'SUCCEEDED') {
          await completeOfflineOperation(operation.idempotencyKey, result.application);
        } else {
          await retryOfflineOperation(
            operation.idempotencyKey,
            result?.error ?? 'Servidor nao confirmou a operacao offline.',
            operation.attemptCount
          );
        }
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['applications'] }),
        queryClient.invalidateQueries({ queryKey: ['service-orders'] }),
      ]);
      setSyncStatus('completed');
    } catch (error) {
      await Promise.all(
        operations.map((operation) =>
          retryOfflineOperation(
            operation.idempotencyKey,
            error instanceof Error ? error.message : 'Falha de sincronizacao.',
            operation.attemptCount
          )
        )
      );
      setSyncStatus('error');
    } finally {
      await checkPendingApplications();
      setIsSyncing(false);
    }
  }, [checkPendingApplications, isConnected, isSyncing, queryClient]);

  const downloadOfflineData = useCallback(async () => {
    await checkOfflineDataCache();
  }, [checkOfflineDataCache]);

  return {
    isSyncing,
    pendingCount,
    syncStatus,
    offlineDataCache,
    isLoadingCache,
    syncOfflineApplications,
    downloadOfflineData,
    checkPendingApplications,
  };
};
