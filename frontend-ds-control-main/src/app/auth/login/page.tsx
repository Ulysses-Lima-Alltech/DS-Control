'use client';
import { LoginForm } from '@/components/LoginForm';
import SwitchToogleTheme from '@/components/SwitchToogleTheme';

export default function LoginPage() {
  return (
    <div className='bg-muted flex min-h-svh flex-col items-center justify-center p-6 md:p-10'>
      <div className='w-full max-w-sm md:max-w-3xl'>
        <LoginForm />
      </div>
      <div className='absolute top-4 right-4'>
        <SwitchToogleTheme />
      </div>
    </div>
  );
}
