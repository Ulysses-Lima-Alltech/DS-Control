'use client';

import { usePathname, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

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
      isPilotRole(user?.type) &&
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
      router.replace(getDefaultRouteByUserType(user?.type) as any);
      return;
    }

    if (!loading && isAuthenticated && !isLoginRoute) {
      if (isAdministrativeRole(user?.type) && (path === '/farmer' || path === '/pilot')) {
        router.replace('/backoffice/dashboard');
        return;
      }

      if (isFarmerRole(user?.type) && (path === '/backoffice' || path === '/pilot')) {
        router.replace('/farmer/map');
        return;
      }

      if (isPilotRole(user?.type) && (path === '/backoffice' || path === '/farmer')) {
        router.replace('/pilot/map');
        return;
      }

      if (getDefaultRouteByUserType(user?.type) === '/auth/login' && isPrivateRoute) {
        router.replace('/auth/login');
        return;
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
