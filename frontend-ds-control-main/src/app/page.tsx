'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard');
  }, []);

  return (
    <div className='flex h-screen w-screen items-center justify-center'>
      <h1 className='text-4xl font-bold'>Redirecting to dashboard...</h1>
    </div>
  );
}
