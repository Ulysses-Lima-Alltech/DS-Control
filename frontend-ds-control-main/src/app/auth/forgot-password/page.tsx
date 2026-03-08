'use client';

import { useTheme } from 'next-themes';
import Image from 'next/image'; // eslint-disable-line
import { use, useEffect, useState } from 'react';

import FormRequestResetPassword from '@/components/Forms/FormRequestResetPassword';
import SwitchToogleTheme from '@/components/SwitchToogleTheme';
import { Card, CardContent } from '@/components/ui/card';

export default function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { theme } = useTheme();
  const [imageSrc, setImageSrc] = useState<
    `/images/login-logo-min.png` | `/images/login-logo-min-dark.png`
  >(`/images/login-logo-min.png`);

  const resolvedSearchParams = use(searchParams);
  const emailFromUrl = resolvedSearchParams.email || '';

  useEffect(() => {
    setImageSrc(
      theme === 'dark' ? '/images/login-logo-min-dark.png' : '/images/login-logo-min.png'
    );
  }, [theme]);

  return (
    <div className='bg-muted flex min-h-svh flex-col items-center justify-center p-6 md:p-10'>
      <div className='w-full max-w-sm md:max-w-3xl'>
        <Card className='overflow-hidden p-0'>
          <CardContent className='grid p-0 md:grid-cols-2'>
            <div className='p-6 md:p-8'>
              <FormRequestResetPassword emailFromUrl={emailFromUrl} />
            </div>

            <div className='bg-muted relative hidden md:block'>
              <Image
                src={imageSrc}
                alt='DS Control Logo'
                width={500}
                height={500}
                className='absolute inset-0 h-full w-full object-cover bg-accent dark:bg-accent/50'
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className='absolute top-4 right-4'>
        <SwitchToogleTheme />
      </div>
    </div>
  );
}
