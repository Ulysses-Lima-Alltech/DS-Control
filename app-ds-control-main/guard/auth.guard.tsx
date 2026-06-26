'use client';

import { usePathname, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import LoadingDSIcon from '@/components/IconLoadingDS';
import { useNetworkConnectivity } from '@/hooks/useNetworkConnectivity';
import { useAuth } from '@/providers/auth.provider';
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
  const pathname = usePathname();
  const path = '/' + pathname.split('/')[1];
  const { isLoading: isLoadingConnectivity } = useNetworkConnectivity();

  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(true);

  useEffect(() => {
    if (__DEV__) {
      console.log('[AuthGuard] rendered');
    }

    const isPrivateRoute = PRIVATE_ROUTES.includes(path);
    const isLoginRoute = LOGIN_ROUTES.includes(path);
    const isAuthRoute = pathname.startsWith('/auth');

    const replaceIfNeeded = (targetPath: string) => {
      if (!targetPath || pathname === targetPath) return false;
      router.replace(targetPath as any);
      return true;
    };

    if (loading || isLoadingConnectivity) {
      return;
    }

    if (path === '/') {
      if (__DEV__) {
        console.log('[AuthGuard] redirect login');
      }
      const targetPath = isAuthenticated ? getDefaultRouteByUserType(user?.type) : '/auth/login';
      replaceIfNeeded(targetPath);
      return;
    }

    if (!isAuthenticated && isPrivateRoute && !isAuthRoute) {
      if (__DEV__) {
        console.log('[AuthGuard] redirect login');
      }
      replaceIfNeeded('/auth/login');
      return;
    }

    if (isAuthenticated && (isLoginRoute || isAuthRoute)) {
      replaceIfNeeded(getDefaultRouteByUserType(user?.type));
      return;
    }

    if (isAuthenticated && !isLoginRoute) {
      if (isAdministrativeRole(user?.type) && (path === '/farmer' || path === '/pilot')) {
        replaceIfNeeded('/backoffice/dashboard');
        return;
      }

      if (isFarmerRole(user?.type) && (path === '/backoffice' || path === '/pilot')) {
        replaceIfNeeded('/farmer/map');
        return;
      }

      if (isPilotRole(user?.type) && (path === '/backoffice' || path === '/farmer')) {
        replaceIfNeeded('/pilot/routes');
        return;
      }

      if (getDefaultRouteByUserType(user?.type) === '/auth/login' && isPrivateRoute) {
        replaceIfNeeded('/auth/login');
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
    pathname,
    user,
    isLoadingConnectivity,
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

  if (loading || isLoadingConnectivity || loadingRoute) {
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
