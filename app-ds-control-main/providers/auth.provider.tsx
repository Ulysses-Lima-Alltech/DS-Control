'use client';

import NetInfo from '@react-native-community/netinfo';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

import {
  getOfflineAuthSession,
  getValidOfflineAuthSession,
  saveOfflineAuthSession,
} from '@/offline/offlineAuth';
import { getStoredAccessToken, removeStoredAccessToken } from '@/services/auth-token-storage.service';
import { getMe } from '@/services/user.service';
import { User } from '@/types/user.type';

interface AuthContextProps {
  setUser: (user?: User) => void;
  refreshUser: () => Promise<void>;
  user?: User;
  isAuthenticated: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    setLoading(true);

    if (__DEV__) {
      console.log('[AuthProvider] bootstrap start');
    }

    const enterOfflineIfPossible = async () => {
      const { session, isValid, reason } = await getValidOfflineAuthSession();

      if (isValid && session) {
        if (__DEV__) {
          console.log('[AuthProvider] offline session accepted');
        }
        setUser(session.user as User);
        return true;
      }

      if (__DEV__) {
        console.log('[AuthProvider] offline session unavailable', reason);
      }
      setUser(undefined);
      return false;
    };

    try {
      const token = await getStoredAccessToken();
      const networkState = await NetInfo.fetch();
      const connected = Boolean(
        networkState.isConnected && networkState.isInternetReachable !== false
      );

      if (!token) {
        if (!connected && (await enterOfflineIfPossible())) {
          return;
        }
        setUser(undefined);
        return;
      }

      if (!connected) {
        await enterOfflineIfPossible();
        return;
      }

      const userData = await getMe();
      const previousSession = await getOfflineAuthSession();
      setUser(userData);
      await saveOfflineAuthSession({
        user: userData,
        tenant: previousSession?.tenant ?? null,
        permissions: previousSession?.permissions ?? [],
        offlineReady: previousSession?.offlineReady ?? false,
      });
    } catch (error) {
      if (__DEV__) {
        console.log('[AuthProvider] bootstrap error', error);
      }
      console.error('[Auth Provider] Error fetching user data:', error);
      const networkState = await NetInfo.fetch();
      const connected = Boolean(
        networkState.isConnected && networkState.isInternetReachable !== false
      );

      if (!connected) {
        await enterOfflineIfPossible();
      } else {
        await removeStoredAccessToken();
        setUser(undefined);
      }
    } finally {
      setLoading(false);
      if (__DEV__) {
        console.log('[AuthProvider] bootstrap done');
      }
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, loading, setUser, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }
  return context;
};
