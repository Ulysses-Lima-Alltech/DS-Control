import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { COLORS } from '@/constants/colors';
import { Feather } from '@expo/vector-icons';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { useNetworkConnectivity } from '@/hooks/useNetworkConnectivity';
import { useState } from 'react';

export default function SyncControlHeader() {
  const { isConnected } = useNetworkConnectivity();
  const {
    isSyncing,
    pendingCount,
    syncOfflineApplications,
    syncStatus,
    offlineDataCache,
    isLoadingCache,
    downloadOfflineData,
  } = useOfflineSync();
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadData = async () => {
    setIsDownloading(true);
    try {
      await downloadOfflineData();
      Alert.alert(
        'Sucesso',
        'Dados offline baixados com sucesso! Agora você pode usar o app offline.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert(
        'Erro ao baixar dados',
        error instanceof Error ? error.message : 'Erro desconhecido. Tente novamente.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsDownloading(false);
    }
  };

  if (!isConnected) {
    const hasOfflineData = offlineDataCache && offlineDataCache.pilot;
    return (
      <View
        style={{
          backgroundColor: COLORS.lightpink || '#FFE5E5',
          padding: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Feather name='wifi-off' size={16} color={COLORS.red} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 12, color: COLORS.red, fontWeight: '500' }}>
            Você está offline
          </Text>
          <Text style={{ fontSize: 11, color: COLORS.red }}>
            {pendingCount > 0
              ? `${pendingCount} aplicação(ões) aguardando sincronização`
              : 'Nenhuma aplicação pendente'}
          </Text>
          <Text style={{ fontSize: 11, color: COLORS.red, marginTop: 2 }}>
            {hasOfflineData
              ? `Dados offline disponíveis (${offlineDataCache.assistants.length} ajudantes, ${offlineDataCache.drones.length} drones)`
              : '⚠️ Dados offline não disponíveis'}
          </Text>
        </View>
      </View>
    );
  }

  if (pendingCount === 0 && syncStatus !== 'syncing') {
    const hasOfflineData = offlineDataCache && offlineDataCache.pilot;
    const cacheAge = offlineDataCache?.lastUpdated
      ? Math.floor((Date.now() - new Date(offlineDataCache.lastUpdated).getTime()) / (1000 * 60))
      : null;

    return (
      <View
        style={{
          backgroundColor: hasOfflineData ? COLORS.lightgreen : COLORS.lightyellow,
          padding: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
          <Feather
            name='check-circle'
            size={16}
            color={hasOfflineData ? COLORS.green : COLORS.orange}
          />
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 12,
                color: hasOfflineData ? COLORS.green : COLORS.orange,
                fontWeight: '500',
              }}
            >
              {hasOfflineData ? 'Aplicações sincronizadas' : '⚠️ Dados offline não disponíveis'}
            </Text>
            {hasOfflineData ? (
              <Text style={{ fontSize: 11, color: COLORS.gray, marginTop: 2 }}>
                Cache: {offlineDataCache.assistants.length} ajudantes,{' '}
                {offlineDataCache.drones.length} drones
                {cacheAge !== null && ` • ${cacheAge}min atrás`}
              </Text>
            ) : (
              <Text style={{ fontSize: 11, color: COLORS.orange, marginTop: 2 }}>
                Toque em "Baixar" para habilitar modo offline
              </Text>
            )}
          </View>
        </View>
        {!hasOfflineData && (
          <TouchableOpacity
            style={{
              backgroundColor: COLORS.blue,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 6,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              opacity: isDownloading ? 0.7 : 1,
            }}
            onPress={handleDownloadData}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <ActivityIndicator size='small' color={COLORS.white} />
            ) : (
              <Feather name='download' size={14} color={COLORS.white} />
            )}
            <Text style={{ fontSize: 12, color: COLORS.white, fontWeight: '500' }}>
              {isDownloading ? 'Baixando...' : 'Baixar'}
            </Text>
          </TouchableOpacity>
        )}
        {hasOfflineData && (
          <TouchableOpacity
            style={{
              backgroundColor: COLORS.lightgray,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 6,
              opacity: isDownloading ? 0.7 : 1,
            }}
            onPress={handleDownloadData}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <ActivityIndicator size='small' color={COLORS.gray} />
            ) : (
              <Feather name='refresh-cw' size={14} color={COLORS.gray} />
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View
      style={{
        backgroundColor: COLORS.lightorange || '#FFF4E5',
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
        {isSyncing ? (
          <ActivityIndicator size='small' color={COLORS.orange} />
        ) : (
          <Feather name='cloud-off' size={16} color={COLORS.orange} />
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 12, color: COLORS.orange, fontWeight: '500' }}>
            {isSyncing ? 'Sincronizando...' : `${pendingCount} aplicação(ões) pendente(s)`}
          </Text>
          {!isSyncing && (
            <Text style={{ fontSize: 11, color: COLORS.orange }}>
              Toque em "Sincronizar" para enviar ao servidor
            </Text>
          )}
        </View>
      </View>

      {!isSyncing && (
        <TouchableOpacity
          style={{
            backgroundColor: COLORS.orange,
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 6,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
          }}
          onPress={() => syncOfflineApplications()}
        >
          <Feather name='refresh-cw' size={14} color={COLORS.white} />
          <Text style={{ fontSize: 12, color: COLORS.white, fontWeight: '500' }}>Sincronizar</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
