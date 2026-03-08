'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTheme } from 'next-themes'; // eslint-disable-line
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import SwitchToogleTheme from '@/components/SwitchToogleTheme';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useResetPassword } from '@/mutations/user.mutation';
import { ResetPasswordSchema } from '@/schemas/auth.schema';
import type { ResetPasswordParams } from '@/services/user.service';
import { getPlatform, type PlatformInfo } from '@/utils/platform';

function ForgetPasswordCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme } = useTheme();
  const [imageSrc, setImageSrc] = useState<
    `/images/login-logo-min.png` | `/images/login-logo-min-dark.png`
  >(`/images/login-logo-min.png`);
  const [platformInfo, setPlatformInfo] = useState<PlatformInfo | null>(null);

  useEffect(() => {
    setImageSrc(
      theme === 'dark' ? '/images/login-logo-min-dark.png' : '/images/login-logo-min.png'
    );
  }, [theme]);

  useEffect(() => {
    const detectPlatform = async () => {
      const detectedPlatform = await getPlatform();
      setPlatformInfo(detectedPlatform);
    };

    detectPlatform();
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordParams>({ resolver: zodResolver(ResetPasswordSchema) });

  const { mutate: resetPassword, isPending: isResettingPassword } = useResetPassword({
    onError: async (error: Error) => {
      toast(error.message);
    },
    onSuccess: async () => {
      toast('Senha redefinida com sucesso! Você pode fazer login com sua nova senha.');

      if (platformInfo?.platform === 'ios' || platformInfo?.platform === 'android') {
        window.location.href = platformInfo.deepLink;
      } else {
        router.push('/auth/login');
      }
    },
  });

  const onSubmit = (data: ResetPasswordParams) => {
    const token = searchParams.get('token');
    const userId = searchParams.get('userId');

    if (!token || !userId) {
      toast('Token ou ID do usuário não encontrado. Solicite um novo link.');
      router.push('/auth/login');
      return;
    }

    resetPassword({
      token,
      userId,
      password: data.password,
    });
  };

  const handleBackToLogin = () => {
    router.push('/auth/login');
  };

  return (
    <div className='bg-muted flex min-h-svh flex-col items-center justify-center p-6 md:p-10'>
      <div className='w-full max-w-sm md:max-w-3xl'>
        <Card className='overflow-hidden p-0'>
          <CardContent className='grid p-0 md:grid-cols-2'>
            <form onSubmit={handleSubmit(onSubmit)} className='p-6 md:p-8'>
              <div className='flex flex-col gap-6'>
                <div className='flex flex-col items-center text-center'>
                  <h1 className='text-2xl font-bold'>Redefinir Senha</h1>
                  <p className='text-muted-foreground text-balance'>
                    Digite sua nova senha para continuar
                  </p>
                </div>

                <div className='grid gap-3'>
                  <Label htmlFor='password'>Nova Senha</Label>
                  <Input
                    id='password'
                    type='password'
                    placeholder='********'
                    required
                    {...register('password')}
                  />
                  {errors.password && (
                    <p className='text-sm text-destructive'>{errors.password.message}</p>
                  )}
                </div>

                <div className='grid gap-3'>
                  <Label htmlFor='confirmPassword'>Confirmar Nova Senha</Label>
                  <Input
                    id='confirmPassword'
                    type='password'
                    placeholder='********'
                    required
                    {...register('confirmPassword')}
                  />
                  {errors.confirmPassword && (
                    <p className='text-sm text-destructive'>{errors.confirmPassword.message}</p>
                  )}
                </div>

                <Button type='submit' className='w-full' disabled={isResettingPassword}>
                  {isResettingPassword ? 'Redefinindo senha...' : 'Redefinir Senha'}
                </Button>

                <Button
                  type='button'
                  variant='outline'
                  className='w-full'
                  onClick={handleBackToLogin}
                >
                  Voltar para o Login
                </Button>
              </div>
            </form>

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

export default function ForgetPasswordCallbackPage() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <ForgetPasswordCallbackContent />
    </Suspense>
  );
}
