import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Alert, Text, TouchableOpacity } from 'react-native';

import { COLORS } from '@/constants/colors';
import { useNetworkConnectivity } from '@/hooks/useNetworkConnectivity';
import { refreshOfflineStatus } from '@/offline/offlineStatus';
import { downloadOfflineDataAndMaps } from '@/offline/offlineSync';

export default function OfflineOSDownloadButton({ serviceOrderId }: { serviceOrderId: string }) {
  const { isConnected } = useNetworkConnectivity();
  const [isDownloading, setIsDownloading] = useState(false);

  const handlePress = async () => {
    if (isConnected === false) {
      Alert.alert('Sem internet', 'Conecte-se a internet para baixar os dados offline desta OS.');
      return;
    }

    setIsDownloading(true);
    try {
      const status = await refreshOfflineStatus();
      const selectedIds = new Set(status.selectedServiceOrderIds ?? []);
      selectedIds.add(serviceOrderId);
      await downloadOfflineDataAndMaps({ selectedServiceOrderIds: [...selectedIds] });
      Alert.alert(
        'Dados offline prontos',
        'Fazenda, talhoes, rotas e mapas desta OS foram salvos no dispositivo para uso sem internet.'
      );
    } catch (error) {
      Alert.alert(
        'Erro ao baixar dados offline',
        error instanceof Error ? error.message : 'Tente novamente.'
      );
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <TouchableOpacity
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: COLORS.primaryDark,
        borderRadius: 14,
        paddingVertical: 12,
        marginBottom: 12,
        opacity: isDownloading ? 0.7 : 1,
      }}
      onPress={handlePress}
      disabled={isDownloading}
    >
      {isDownloading ? (
        <ActivityIndicator size='small' color={COLORS.white} />
      ) : (
        <Ionicons name='cloud-download-outline' size={18} color={COLORS.white} />
      )}
      <Text style={{ color: COLORS.white, fontWeight: '700', fontSize: 14 }}>
        {isDownloading ? 'Baixando dados desta OS...' : 'Manter dados Offline'}
      </Text>
    </TouchableOpacity>
  );
}
