'use client';

import { usePathname, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import LoadingDSIcon from '@/components/IconLoadingDS';
import { useAuth } from '@/providers/auth.provider';
import { useNetworkConnectivity } from '@/hooks/useNetworkConnectivity';
import { getOfflineDataCache } from '@/utils/offline-storage';

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
    const isPrivateRoute = PRIVATE_ROUTES.includes(path);
    const isLoginRoute = LOGIN_ROUTES.includes(path);

    if (!loading && !isLoadingConnectivity && path === '/') {
      router.replace('/auth/login');
    }

    // If pilot is offline but has cached data, redirect to offline mode
    if (
      !loading &&
      !isLoadingConnectivity &&
      user?.type === 'pilot' &&
      isConnected === false &&
      hasOfflineData &&
      path !== '/pilot'
    ) {
      router.replace('/pilot/applications/offline');
      return;
    }

    if (!loading && !isAuthenticated && isPrivateRoute) {
      router.replace('/auth/login');
    }

    if (!loading && isAuthenticated && isLoginRoute) {
      if (user?.type === 'pilot' || user?.type === 'farmer') {
        router.replace(`/${user?.type}/map`);
      } else {
        router.replace(`/backoffice/dashboard`);
      }
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

  if (loadingRoute) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <LoadingDSIcon />
      </View>
    );
  }

  return children;
};
