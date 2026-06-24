import { Ionicons, MaterialCommunityIcons, FontAwesome6 } from '@expo/vector-icons';
import { Tabs, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

import LoginScreen from '@/app/auth/login';
import AdminSideMenu from '@/components/Admin/AdminSideMenu';
import LoadingDSIcon from '@/components/IconLoadingDS';
import { COLORS } from '@/constants/colors';
import { useNetworkConnectivity } from '@/hooks/useNetworkConnectivity';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { useAuth } from '@/providers/auth.provider';
import { isPilotRole } from '@/utils/user-role';

export default function RootLayout() {
  const { isAuthenticated, loading, user } = useAuth();
  const pathname = usePathname();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const { isConnected } = useNetworkConnectivity();
  const { syncOfflineApplications, downloadOfflineData, pendingCount, isSyncing } =
    useOfflineSync();

  useEffect(() => {
    if (isConnected && isPilotRole(user?.type)) {
      syncOfflineApplications();
      downloadOfflineData();
    }
  }, [isConnected, user, syncOfflineApplications, downloadOfflineData]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: COLORS.background,
        }}
      >
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
    <View style={{ flex: 1 }}>
      <Tabs
        initialRouteName='routes'
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: COLORS.primaryDark,
          tabBarInactiveTintColor: COLORS.textMuted,
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '700',
          },
          tabBarStyle: {
            backgroundColor: COLORS.surface,
            borderTopWidth: 1,
            borderTopColor: COLORS.border,
            height: 62,
            paddingTop: 6,
            paddingBottom: 8,
            elevation: 8,
            shadowColor: COLORS.shadow,
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.08,
            shadowRadius: 12,
          },
        }}
      >
        <Tabs.Screen
          name='map'
          options={{
            title: 'Menu',
            tabBarIcon: ({ color, size }) => <Ionicons name='menu' size={size} color={color} />,
            tabBarButton: ({ children, style, accessibilityLabel, accessibilityState, testID }) => (
              <TouchableOpacity
                accessibilityLabel={accessibilityLabel}
                accessibilityState={accessibilityState}
                testID={testID}
                style={style}
                onPress={() => {
                  setIsMenuVisible(true);
                }}
              >
                {children}
              </TouchableOpacity>
            ),
          }}
        />
        <Tabs.Screen
          name='routes'
          options={{
            title: 'Rotas',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name='map-marker-path' size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name='service-orders'
          options={{
            title: 'Ordens de Servico',
            tabBarLabel: 'OS',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name='clipboard-list-outline' size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name='applications'
          options={{
            title: 'Aplicacoes',
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
                        color: COLORS.white,
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
        <Tabs.Screen name='profile' options={{ href: null }} />
      </Tabs>
      <AdminSideMenu
        visible={isMenuVisible}
        onClose={() => setIsMenuVisible(false)}
        pathname={pathname}
      />
    </View>
  );
}
