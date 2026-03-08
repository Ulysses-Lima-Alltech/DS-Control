import ScreenApplicationsListing from '@/components/Screen/ScreenApplicationsListing';
import ButtonFloatingNewLooseApplication from '@/components/ButtonFloatingNewLooseApplication';
import SyncControlHeader from '@/components/SyncControlHeader';
import { View, TouchableOpacity, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS } from '@/constants/colors';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { useNetworkConnectivity } from '@/hooks/useNetworkConnectivity';

export default function Applications() {
  const router = useRouter();
  const { pendingCount } = useOfflineSync();
  const { isConnected } = useNetworkConnectivity();

  return (
    <View style={{ flex: 1 }}>
      <SyncControlHeader />

      {pendingCount > 0 && (
        <TouchableOpacity
          style={{
            backgroundColor: COLORS.white,
            padding: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottomWidth: 1,
            borderBottomColor: COLORS.lightgray,
          }}
          onPress={() => router.push('/pilot/applications/pending')}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Feather name='inbox' size={16} color={COLORS.orange} />
            <Text style={{ fontSize: 14, color: COLORS.black }}>
              Ver aplicações pendentes ({pendingCount})
            </Text>
          </View>
          <Feather name='chevron-right' size={16} color={COLORS.gray} />
        </TouchableOpacity>
      )}

      {!isConnected && (
        <TouchableOpacity
          style={{
            backgroundColor: COLORS.lightblue,
            padding: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottomWidth: 1,
            borderBottomColor: COLORS.lightgray,
          }}
          onPress={() => router.push('/pilot/applications/offline')}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Feather name='plus-circle' size={16} color={COLORS.blue} />
            <Text style={{ fontSize: 14, color: COLORS.blue, fontWeight: '500' }}>
              Criar nova aplicação (Modo Offline)
            </Text>
          </View>
          <Feather name='chevron-right' size={16} color={COLORS.blue} />
        </TouchableOpacity>
      )}

      <ScreenApplicationsListing />
      <ButtonFloatingNewLooseApplication />
    </View>
  );
}
