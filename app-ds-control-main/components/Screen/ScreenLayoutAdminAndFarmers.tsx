import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { Tabs, usePathname } from 'expo-router';
import { useState } from 'react';
import { TouchableOpacity, View } from 'react-native';

import LoginScreen from '@/app/auth/login';
import AdminSideMenu from '@/components/Admin/AdminSideMenu';
import LoadingDSIcon from '@/components/IconLoadingDS';
import { COLORS } from '@/constants/colors';
import { useAuth } from '@/providers/auth.provider';

export default function ScreenLayoutAdminAndFarmers() {
  const { isAuthenticated, loading } = useAuth();
  const pathname = usePathname();
  const [isMenuVisible, setIsMenuVisible] = useState(false);

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

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        initialRouteName='dashboard'
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
          name='applications'
          options={{
            title: 'Aplicações',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name='format-list-bulleted' size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name='dashboard'
          options={{
            title: 'Painel',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name='view-dashboard' size={size} color={color} />
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
        <Tabs.Screen name='profile' options={{ href: null }} />
        <Tabs.Screen name='service-orders' options={{ href: null }} />
        <Tabs.Screen name='configurations' options={{ href: null }} />
      </Tabs>
      <AdminSideMenu
        visible={isMenuVisible}
        onClose={() => setIsMenuVisible(false)}
        pathname={pathname}
      />
    </View>
  );
}

