'use client';

import { useRouter } from 'next/navigation';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { AUTH_ACCESS_TOKEN_KEY } from '@/services/api.service';
import { getMe } from '@/services/user.service';
import { User } from '@/types/user.type';
import { isBrowser } from '@/utils/platform';

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
  const router = useRouter();

  const refreshUser = useCallback(async () => {
    const token = isBrowser ? window.localStorage.getItem(AUTH_ACCESS_TOKEN_KEY) : null;

    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const userData = await getMe();
      setUser(userData);
    } catch (error) {
      console.error('[Auth Provider] Error fetching user data:', error);
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(AUTH_ACCESS_TOKEN_KEY);
      }

      router.push('/auth/login');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser, router]);

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
