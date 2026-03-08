import { Foundation, Ionicons, FontAwesome6 } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { View, Text } from 'react-native';

import LoginScreen from '@/app/auth/login';
import LoadingDSIcon from '@/components/IconLoadingDS';
import { useAuth } from '@/providers/auth.provider';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { useNetworkConnectivity } from '@/hooks/useNetworkConnectivity';
import { useEffect } from 'react';
import { COLORS } from '@/constants/colors';

export default function RootLayout() {
  const { isAuthenticated, loading, user } = useAuth();
  const { isConnected } = useNetworkConnectivity();
  const { syncOfflineApplications, downloadOfflineData, pendingCount, isSyncing } =
    useOfflineSync();

  useEffect(() => {
    if (isConnected && user?.type === 'pilot') {
      syncOfflineApplications();

      downloadOfflineData();
    }
  }, [isConnected, user]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <LoadingDSIcon />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  const getBadgeColor = () => {
    if (isSyncing) return COLORS.orange || '#EAAE07';
    if (pendingCount > 0) return COLORS.red || '#FF0000';
    return COLORS.green || '#00FF00';
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#EAAE07',
        tabBarInactiveTintColor: '#8E8E93',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E5E5EA',
        },
      }}
    >
      <Tabs.Screen
        name='map'
        options={{
          title: 'Mapa',
          tabBarIcon: ({ color, size }) => <Foundation name='map' size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name='service-orders'
        options={{
          title: 'Ordens de Serviço',
          tabBarIcon: ({ color, size }) => (
            <Foundation name='clipboard-notes' size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name='applications'
        options={{
          title: 'Aplicações',
          tabBarIcon: ({ color, size }) => (
            <View style={{ position: 'relative' }}>
              <FontAwesome6 name='droplet' size={size} color={color} />
              {pendingCount > 0 && (
                <View
                  style={{
                    position: 'absolute',
                    right: -6,
                    top: -3,
                    backgroundColor: getBadgeColor(),
                    borderRadius: 10,
                    minWidth: 16,
                    height: 16,
                    justifyContent: 'center',
                    alignItems: 'center',
                    paddingHorizontal: 4,
                  }}
                >
                  <Text
                    style={{
                      color: '#FFFFFF',
                      fontSize: 10,
                      fontWeight: 'bold',
                    }}
                  >
                    {pendingCount}
                  </Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name='profile'
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => <Ionicons name='person' size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
