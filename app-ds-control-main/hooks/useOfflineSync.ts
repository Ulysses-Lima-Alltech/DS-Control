import { useState, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNetworkConnectivity } from './useNetworkConnectivity';
import {
  getOfflineApplications,
  updateOfflineApplication,
  deleteOfflineApplication,
  saveOfflineDataCache,
  getOfflineDataCache,
} from '@/utils/offline-storage';
import { OfflineDataCache } from '@/types/offline-application.type';
import { useRegisterNewApplicationWithoutPlot } from '@/mutations/application.mutation';
import { useAuth } from '@/providers/auth.provider';
import { getAllAssistants } from '@/services/assistant.service';
import { getAllDrones } from '@/services/drone.service';
import { getAllCultureTypes } from '@/services/culture-type.service';
import { getAllProducts } from '@/services/product.service';
import {
  getAllMyOpenServiceOrders,
  updateServiceOrderPlotStatus,
} from '@/services/service-order.service';

export const useOfflineSync = () => {
  const { isConnected } = useNetworkConnectivity();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'completed' | 'error'>('idle');
  const [offlineDataCache, setOfflineDataCache] = useState<OfflineDataCache | null>(null);
  const [isLoadingCache, setIsLoadingCache] = useState(true);

  const { mutateAsync: registerLooseApplication } = useRegisterNewApplicationWithoutPlot();

  const checkPendingApplications = useCallback(async () => {
    const applications = await getOfflineApplications();
    const pending = applications.filter(
      (app) => app.syncStatus === 'pending' || app.syncStatus === 'error'
    );
    setPendingCount(pending.length);
  }, []);

  const checkOfflineDataCache = useCallback(async () => {
    setIsLoadingCache(true);
    const cache = await getOfflineDataCache();
    setOfflineDataCache(cache);
    setIsLoadingCache(false);
  }, []);

  useEffect(() => {
    checkPendingApplications();
    checkOfflineDataCache();
  }, [checkPendingApplications, checkOfflineDataCache]);

  const syncOfflineApplications = useCallback(async () => {
    if (!isConnected || isSyncing) return;

    setIsSyncing(true);
    setSyncStatus('syncing');

    try {
      const applications = await getOfflineApplications();
      const pending = applications.filter(
        (app) => app.syncStatus === 'pending' || app.syncStatus === 'error'
      );

      for (const app of pending) {
        try {
          await updateOfflineApplication(app.localId, { syncStatus: 'syncing' });

          if (!app.applicationSynced) {
            await registerLooseApplication({
              pilotId: app.pilotId,
              date: app.date,
              assistantId: app.assistantId,
              droneId: app.droneId,
              cultureId: app.cultureId,
              productId: app.productId,
              hectares: app.hectares,
              flowRate: app.flowRate,
              altitude: app.altitude,
              routeSpacing: app.routeSpacing,
              dropletSize: app.dropletSize,
              observations: app.observations,
              serviceOrderId: app.serviceOrderId || null,
              farmId: app.farmId || null,
              plotId: app.plotId || null,
            });
            await updateOfflineApplication(app.localId, { applicationSynced: true });
          }

          if (app.plotCompleted && app.serviceOrderId && app.plotId) {
            try {
              await updateServiceOrderPlotStatus({
                serviceOrderId: app.serviceOrderId,
                plotId: app.plotId,
                status: 'COMPLETED',
              });
            } catch (error) {
              console.error(
                `[OfflineSync] Aplicação ${app.localId} salva, mas o status do talhão falhou:`,
                error
              );
              throw new Error(
                'A aplicação foi salva, mas não foi possível marcar o talhão como concluído.'
              );
            }
          }

          await deleteOfflineApplication(app.localId);
          console.log(`Successfully synced application: ${app.localId}`);
        } catch (error) {
          console.error(`Failed to sync application ${app.localId}:`, error);
          await updateOfflineApplication(app.localId, {
            syncStatus: 'error',
            syncError: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: ['applications'] });

      await checkPendingApplications();

      setSyncStatus('completed');
    } catch (error) {
      console.error('Error syncing offline applications:', error);
      setSyncStatus('error');
    } finally {
      setIsSyncing(false);
    }
  }, [isConnected, isSyncing, queryClient, checkPendingApplications, registerLooseApplication]);

  const downloadOfflineData = useCallback(async () => {
    if (!isConnected || !user) return;

    try {
      console.log('Starting offline data download...');

      const [assistantsData, dronesData, cultureTypesData, productsData, serviceOrdersData] =
        await Promise.all([
          getAllAssistants({ limit: '100' }),
          getAllDrones({ limit: '100' }),
          getAllCultureTypes({ limit: '100' }),
          getAllProducts({ limit: '100' }),
          getAllMyOpenServiceOrders({
            limit: '100',
            includePlots: 'true',
            includeFarms: 'true',
          }),
        ]);

      console.log('Data fetched successfully:', {
        assistants: assistantsData.data?.length,
        drones: dronesData.data?.length,
        cultureTypes: cultureTypesData.data?.length,
        products: productsData.data?.length,
      });

      const cache: OfflineDataCache = {
        pilot: {
          id: user.id,
          name: user.name,
        },
        assistants: assistantsData.data?.map((a: any) => ({ id: a.id, name: a.name })) || [],
        drones: dronesData.data?.map((d: any) => ({ id: d.id, name: d.name })) || [],
        cultureTypes: cultureTypesData.data?.map((c: any) => ({ id: c.id, name: c.name })) || [],
        products: productsData.data?.map((p: any) => ({ id: p.id, name: p.name })) || [],
        serviceOrders: serviceOrdersData.data || [],
        lastUpdated: new Date().toISOString(),
      };

      await saveOfflineDataCache(cache);
      await checkOfflineDataCache();
      console.log('Offline data cache updated successfully');
    } catch (error) {
      console.error('Error downloading offline data:', error);
      throw error;
    }
  }, [isConnected, user, checkOfflineDataCache]);

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
