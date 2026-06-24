import { Foundation, Ionicons, MaterialCommunityIcons, FontAwesome6 } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { View } from 'react-native';

import LoginScreen from '@/app/auth/login';
import LoadingDSIcon from '@/components/IconLoadingDS';
import { COLORS } from '@/constants/colors';
import { useAuth } from '@/providers/auth.provider';

export default function RootLayout() {
  const { isAuthenticated, loading } = useAuth();

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
    <Tabs
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
        name='dashboard'
        options={{
          title: 'Painel',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name='view-dashboard' size={size} color={color} />
          ),
        }}
      />
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
            <FontAwesome6 name='droplet' size={size} color={color} />
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
