import { FontAwesome6, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { Tabs, usePathname } from 'expo-router';
import { useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import LoginScreen from '@/app/auth/login';
import AdminSideMenu from '@/components/Admin/AdminSideMenu';
import LoadingDSIcon from '@/components/IconLoadingDS';
import { useAuth } from '@/providers/auth.provider';
import { isAdministrativeRole } from '@/utils/user-role';

export default function ScreenLayoutAdminAndFarmers() {
  const { isAuthenticated, loading, user } = useAuth();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const isAdministrativeUser = isAdministrativeRole(user?.type);

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

  return (
    <View style={{ flex: 1 }}>
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
            title: 'Fazendas',
            tabBarIcon: ({ color, size }) => (
              <FontAwesome6 name='tractor' size={size} color={color} />
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
          name='profile'
          options={{
            title: 'Perfil',
            tabBarIcon: ({ color, size }) => <Ionicons name='person' size={size} color={color} />,
          }}
        />
        <Tabs.Screen name='applications' options={{ href: null }} />
        <Tabs.Screen name='service-orders' options={{ href: null }} />
        <Tabs.Screen name='routes' options={{ href: null }} />
        <Tabs.Screen name='configurations' options={{ href: null }} />
      </Tabs>

      {isAdministrativeUser && (
        <TouchableOpacity
          onPress={() => setIsMenuVisible(true)}
          style={{
            position: 'absolute',
            top: insets.top + 10,
            left: 12,
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: 'rgba(0,0,0,0.7)',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 90,
          }}
        >
          <Ionicons name='menu' size={24} color='#FFFFFF' />
        </TouchableOpacity>
      )}

      <AdminSideMenu
        visible={isMenuVisible}
        onClose={() => setIsMenuVisible(false)}
        pathname={pathname}
      />
    </View>
  );
}
