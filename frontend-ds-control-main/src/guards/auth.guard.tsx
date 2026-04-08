'use client';

import { usePathname, useRouter } from 'next/navigation';
import React, { useEffect, useRef } from 'react';

import { useAuth } from '@/providers/auth.provider';
import { UserType } from '@/types/user.type';

interface AuthGuardProps {
  children: React.ReactNode;
}

const LOGIN_ROUTES = ['/auth'];
const DEV_BYPASS_AUTH =
  process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === 'true' && process.env.NODE_ENV === 'development';

export const AuthGuard = ({ children }: AuthGuardProps) => {
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();
  const path = usePathname();

  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (DEV_BYPASS_AUTH) return;

    const isLoginRoute = LOGIN_ROUTES.includes('/' + path.split('/')[1]);

    if (!loading && isAuthenticated && !isLoginRoute && user?.type !== UserType.BACKOFFICE.value) {
      router.push('/forbidden');
    }

    if (!loading && !isAuthenticated && !isLoginRoute) {
      router.push('/auth/login');
    }

    if (!loading && isAuthenticated && isLoginRoute && user?.type === UserType.BACKOFFICE.value) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, loading, router, path, user]);

  useEffect(() => {
    if (timeout.current) {
      clearTimeout(timeout.current);
    }

    if (loading) {
      return;
    }

    timeout.current = setTimeout(() => {}, 500);
  }, [loading]);

  return children;
};
