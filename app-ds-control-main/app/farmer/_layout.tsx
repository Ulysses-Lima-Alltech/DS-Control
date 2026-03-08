import { Foundation, Ionicons, MaterialCommunityIcons, FontAwesome6 } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { View } from 'react-native';

import LoginScreen from '@/app/auth/login';
import LoadingDSIcon from '@/components/IconLoadingDS';
import { useAuth } from '@/providers/auth.provider';

export default function RootLayout() {
  const { isAuthenticated, loading } = useAuth();

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
