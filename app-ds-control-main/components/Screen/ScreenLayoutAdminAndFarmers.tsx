import { FontAwesome6, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { View } from 'react-native';
import LoginScreen from '../../app/auth/login';
import { useAuth } from '../../providers/auth.provider';
import LoadingDSIcon from '../IconLoadingDS';

export default function ScreenLayoutAdminAndFarmers() {
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
    </Tabs>
  );
}
