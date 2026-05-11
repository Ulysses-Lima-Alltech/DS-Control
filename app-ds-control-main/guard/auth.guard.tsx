'use client';

import { usePathname, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import LoadingDSIcon from '@/components/IconLoadingDS';
import { useNetworkConnectivity } from '@/hooks/useNetworkConnectivity';
import { useAuth } from '@/providers/auth.provider';
import { getOfflineDataCache } from '@/utils/offline-storage';
import {
  getDefaultRouteByUserType,
  isAdministrativeRole,
  isFarmerRole,
  isPilotRole,
} from '@/utils/user-role';

interface AuthGuardProps {
  children: React.ReactNode;
}

const PRIVATE_ROUTES: string[] = [
  '/dashboard',
  '/index',
  '/profile',
  '/service-orders',
  '/farmer',
  '/pilot',
  '/backoffice',
];

const LOGIN_ROUTES = ['/auth', '/auth/login'];

export const AuthGuard = ({ children }: AuthGuardProps) => {
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();
  const path = '/' + usePathname().split('/')[1];
  const { isConnected, isLoading: isLoadingConnectivity } = useNetworkConnectivity();
  const [hasOfflineData, setHasOfflineData] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(true);

  useEffect(() => {
    const checkOfflineData = async () => {
      const cache = await getOfflineDataCache();
      setHasOfflineData(!!cache && !!cache.pilot);
    };
    checkOfflineData();
  }, []);

  useEffect(() => {
    if (__DEV__) {
      console.log('[AuthGuard] rendered');
    }

    const isPrivateRoute = PRIVATE_ROUTES.includes(path);
    const isLoginRoute = LOGIN_ROUTES.includes(path);

    if (loading || isLoadingConnectivity) {
      return;
    }

    setIsRedirecting(false);

    if (path === '/') {
      if (__DEV__) {
        console.log('[AuthGuard] redirect login');
      }
      setIsRedirecting(true);
      router.replace('/auth/login');
      return;
    }

    // If pilot is offline but has cached data, redirect to offline mode
    if (isPilotRole(user?.type) && isConnected === false && hasOfflineData && path !== '/pilot') {
      router.replace('/pilot/applications/offline');
      setIsRedirecting(true);
      return;
    }

    if (!isAuthenticated && isPrivateRoute) {
      if (__DEV__) {
        console.log('[AuthGuard] redirect login');
      }
      setIsRedirecting(true);
      router.replace('/auth/login');
      return;
    }

    if (isAuthenticated && isLoginRoute) {
      setIsRedirecting(true);
      router.replace(getDefaultRouteByUserType(user?.type) as any);
      return;
    }

    if (isAuthenticated && !isLoginRoute) {
      if (isAdministrativeRole(user?.type) && (path === '/farmer' || path === '/pilot')) {
        setIsRedirecting(true);
        router.replace('/backoffice/dashboard');
        return;
      }

      if (isFarmerRole(user?.type) && (path === '/backoffice' || path === '/pilot')) {
        setIsRedirecting(true);
        router.replace('/farmer/map');
        return;
      }

      if (isPilotRole(user?.type) && (path === '/backoffice' || path === '/farmer')) {
        setIsRedirecting(true);
        router.replace('/pilot/map');
        return;
      }

      if (getDefaultRouteByUserType(user?.type) === '/auth/login' && isPrivateRoute) {
        setIsRedirecting(true);
        router.replace('/auth/login');
        return;
      }
    }

    if (__DEV__) {
      console.log('[AuthGuard] allow route');
    }
  }, [
    isAuthenticated,
    loading,
    router,
    path,
    user,
    isConnected,
    isLoadingConnectivity,
    hasOfflineData,
  ]);

  useEffect(() => {
    if (timeout.current) {
      clearTimeout(timeout.current);
    }

    if (loading || isLoadingConnectivity) {
      setLoadingRoute(true);
      return;
    }

    timeout.current = setTimeout(() => {
      setLoadingRoute(false);
    }, 500);
  }, [loading, isLoadingConnectivity]);

  useEffect(() => {
    // Safety valve: avoid blank app if an upstream loading flag never resolves.
    const watchdog = setTimeout(() => {
      setLoadingRoute(false);
    }, 10000);

    return () => {
      clearTimeout(watchdog);
      if (timeout.current) {
        clearTimeout(timeout.current);
      }
    };
  }, []);

  if (loading || isLoadingConnectivity || loadingRoute || isRedirecting) {
    if (__DEV__) {
      console.log('[AuthGuard] loading');
    }
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 }}>
        <LoadingDSIcon />
        <Text>Carregando autenticação...</Text>
      </View>
    );
  }

  return children;
};
