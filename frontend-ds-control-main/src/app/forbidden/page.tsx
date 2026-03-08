'use client';

import { LogOut, ShieldBan, Smartphone } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useLogout } from '@/mutations/auth.mutation';
import { getPlatform, type PlatformInfo } from '@/utils/platform';

export default function Forbidden() {
  const router = useRouter();
  const { mutate: logout, isPending: isLoggingOut } = useLogout();
  const [platformInfo, setPlatformInfo] = useState<PlatformInfo | null>(null);
  const [isLoadingPlatform, setIsLoadingPlatform] = useState(true);

  useEffect(() => {
    const detectPlatform = async () => {
      const detectedPlatform = await getPlatform();
      setPlatformInfo(detectedPlatform);
      setIsLoadingPlatform(false);
    };

    detectPlatform();
  }, []);

  const handleLogout = () => {
    logout();
  };

  const handleGoToApp = () => {
    if (platformInfo?.platform === 'ios' || platformInfo?.platform === 'android') {
      window.location.href = platformInfo.deepLink;
    } else {
      router.push('/auth/login');
    }
  };

  return (
    <div className='flex flex-col w-full min-h-screen items-center justify-center bg-white dark:bg-black p-4'>
      <div className='flex flex-col items-center justify-center gap-8 max-w-2xl mx-auto text-center'>
        <div className='relative'>
          <ShieldBan className='h-48 w-48 text-red-500 dark:text-red-400' />
        </div>

        <h1 className='text-5xl sm:text-6xl md:text-7xl font-bold text-gray-900 dark:text-gray-100 tracking-tighter'>
          Acesso restrito
        </h1>

        <p className='text-xl text-gray-600 dark:text-gray-400'>
          Você não tem permissão para acessar esta página, use o app.
        </p>

        <div className='flex flex-col sm:flex-row gap-4 mt-4'>
          <button
            onClick={handleLogout}
            className='flex items-center justify-center px-6 py-3 bg-gray-900 hover:bg-gray-800 dark:bg-gray-100 dark:hover:bg-gray-200 dark:text-gray-900 text-white rounded-lg transition-all duration-300 ease-in-out transform hover:scale-105 hover:shadow-lg'
          >
            {isLoggingOut ? (
              <div className='mr-2 h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent' />
            ) : (
              <LogOut className='mr-2 h-5 w-5' />
            )}
            Fazer logout
          </button>

          <button
            onClick={handleGoToApp}
            disabled={isLoadingPlatform}
            className='flex items-center justify-center px-6 py-3 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg transition-all duration-300 ease-in-out transform hover:scale-105 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed'
          >
            <Smartphone className='mr-2 h-5 w-5' />
            {isLoadingPlatform ? 'Carregando...' : 'Ir para o App'}
          </button>
        </div>
      </div>
    </div>
  );
}
