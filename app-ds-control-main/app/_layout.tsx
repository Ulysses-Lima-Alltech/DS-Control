import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { LocationPermissionHandler } from '@/components/HandlerLocationPermission';
import { AuthGuard } from '@/guard/auth.guard';
import { AuthProvider } from '@/providers/auth.provider';
import QueryProvider from '@/providers/query.provider';
import Toast from 'react-native-toast-message';
import HeaderApp from '@/components/HeaderApp';
// import { LogBox } from 'react-native';

export default function RootLayout() {
  // LogBox.ignoreAllLogs();
  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
        <QueryProvider>
          <AuthProvider>
            <AuthGuard>
              <LocationPermissionHandler>
                <HeaderApp />
                <Stack screenOptions={{ headerShown: false }} />
                <StatusBar style='auto' />
                <Toast />
              </LocationPermissionHandler>
            </AuthGuard>
          </AuthProvider>
        </QueryProvider>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
