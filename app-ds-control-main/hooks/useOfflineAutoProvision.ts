import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { useNetworkConnectivity } from '@/hooks/useNetworkConnectivity';
import { refreshOfflineStatus } from '@/offline/offlineStatus';
import { downloadOfflineDataAndMaps } from '@/offline/offlineSync';
import { useAuth } from '@/providers/auth.provider';
import { getAllMyOpenServiceOrders } from '@/services/service-order.service';
import { isPilotRole } from '@/utils/user-role';

const CHECK_INTERVAL_MS = 15 * 60 * 1000;

/**
 * Baixa automaticamente os dados offline (OS, fazenda, talhoes e rotas) sempre
 * que o piloto tiver uma OS aberta ainda nao presente no cache local, sem
 * exigir clique manual. Roda no mount, ao reconectar e em um intervalo
 * periodico enquanto o app estiver aberto e online.
 */
export const useOfflineAutoProvision = () => {
  const { user } = useAuth();
  const { isConnected } = useNetworkConnectivity();
  const [isAutoProvisioning, setIsAutoProvisioning] = useState(false);
  const isRunningRef = useRef(false);
  const wasConnectedRef = useRef<boolean | null>(null);

  const checkAndProvision = useCallback(async () => {
    if (!isPilotRole(user?.type) || !isConnected || isRunningRef.current) return;

    isRunningRef.current = true;
    setIsAutoProvisioning(true);
    try {
      const [openOrders, status] = await Promise.all([
        getAllMyOpenServiceOrders({ status: 'open', limit: '1000' }),
        refreshOfflineStatus(),
      ]);
      const openIds = openOrders.data.map((order) => order.id);
      if (openIds.length === 0) return;

      const cachedIds = new Set(status.selectedServiceOrderIds ?? []);
      const hasNewAssignment = openIds.some((id) => !cachedIds.has(id));
      if (!hasNewAssignment) return;

      await downloadOfflineDataAndMaps({ selectedServiceOrderIds: openIds });

      if (cachedIds.size > 0) {
        Alert.alert(
          'Nova OS disponível offline',
          'Os dados da nova ordem de serviço já foram baixados para uso sem internet.'
        );
      }
    } catch (error) {
      console.warn(
        '[useOfflineAutoProvision] Falha ao provisionar dados offline automaticamente:',
        error
      );
    } finally {
      isRunningRef.current = false;
      setIsAutoProvisioning(false);
    }
  }, [isConnected, user?.type]);

  useEffect(() => {
    checkAndProvision();
  }, [checkAndProvision]);

  useEffect(() => {
    if (isConnected && wasConnectedRef.current === false) {
      checkAndProvision();
    }
    wasConnectedRef.current = isConnected;
  }, [isConnected, checkAndProvision]);

  useEffect(() => {
    if (!isPilotRole(user?.type)) return;
    const interval = setInterval(checkAndProvision, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [user?.type, checkAndProvision]);

  return { isAutoProvisioning };
};
