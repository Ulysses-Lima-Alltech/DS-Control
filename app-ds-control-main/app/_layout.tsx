import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';
import 'react-native-reanimated';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { LocationPermissionHandler } from '@/components/HandlerLocationPermission';
import { AuthGuard } from '@/guard/auth.guard';
import LoadingDSIcon from '@/components/IconLoadingDS';
import { useAuth } from '@/providers/auth.provider';
import { AuthProvider } from '@/providers/auth.provider';
import QueryProvider from '@/providers/query.provider';
import Toast from 'react-native-toast-message';
import HeaderApp from '@/components/HeaderApp';
// import { LogBox } from 'react-native';

function RootContent() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 }}>
        <LoadingDSIcon />
        <Text>Carregando DS Control...</Text>
      </View>
    );
  }

  return (
    <AuthGuard>
      <LocationPermissionHandler>
        <HeaderApp />
        <Stack screenOptions={{ headerShown: false }} />
        <StatusBar style='auto' />
        <Toast />
      </LocationPermissionHandler>
    </AuthGuard>
  );
}

export default function RootLayout() {
  // LogBox.ignoreAllLogs();
  if (__DEV__) console.log('[RootLayout] rendered');

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
        <QueryProvider>
          <AuthProvider>
            <RootContent />
          </AuthProvider>
        </QueryProvider>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
