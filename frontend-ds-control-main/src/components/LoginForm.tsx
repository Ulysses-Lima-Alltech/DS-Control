'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTheme } from 'next-themes'; //eslint-disable-line
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useLogin } from '@/mutations/auth.mutation';
import { useAuth } from '@/providers/auth.provider';
import { LoginSchema } from '@/schemas/auth.schema';
import type { LoginParams } from '@/services/auth.service';
import { getMe } from '@/services/user.service';
import { UserType } from '@/types/user.type';

export function LoginForm({ className, ...props }: React.ComponentProps<'div'>) {
  const router = useRouter();
  const { setUser } = useAuth();
  const { theme } = useTheme();
  const [imageSrc, setImageSrc] = useState<
    `/images/login-logo-min.png` | `/images/login-logo-min-dark.png`
  >(`/images/login-logo-min.png`);

  useEffect(() => {
    setImageSrc(
      theme === 'dark' ? '/images/login-logo-min-dark.png' : '/images/login-logo-min.png'
    );
  }, [theme]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginParams>({ resolver: zodResolver(LoginSchema) });

  const { mutate: login, isPending: isLoggingIn } = useLogin({
    onError: (error) => {
      toast(error.message);
    },
    onSuccess: async () => {
      const user = await getMe();
      setUser(user);
      if (user.type === UserType.BACKOFFICE.value) {
        router.push('/dashboard');
      } else {
        router.push('/forbidden');
      }
    },
  });

  const onSubmit = (data: LoginParams) => {
    login(data);
  };

  const handleForgotPassword = () => {
    const email = document.getElementById('email') as HTMLInputElement;
    const emailValue = email?.value || '';
    const url = emailValue
      ? `/auth/forgot-password?email=${encodeURIComponent(emailValue)}`
      : '/auth/forgot-password';
    router.push(url);
  };

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <Card className='overflow-hidden p-0'>
        <CardContent className='grid p-0 md:grid-cols-2'>
          <form onSubmit={handleSubmit(onSubmit)} className='p-6 md:p-8'>
            <div className='flex flex-col gap-6'>
              <div className='flex flex-col items-center text-center'>
                <h1 className='text-2xl font-bold'>Seja bem-vindo</h1>
                <p className='text-muted-foreground text-balance'>Acesse sua conta da DS Control</p>
              </div>
              <div className='grid gap-3'>
                <Label htmlFor='email'>E-mail</Label>
                <Input
                  id='email'
                  type='email'
                  placeholder='email@example.com'
                  required
                  {...register('email')}
                />
                {errors.email && <p className='text-sm text-destructive'>{errors.email.message}</p>}
              </div>
              <div className='grid gap-3'>
                <div className='flex items-center'>
                  <Label htmlFor='password'>Senha</Label>
                  <button
                    type='button'
                    onClick={handleForgotPassword}
                    className='ml-auto text-sm underline-offset-2 hover:underline cursor-pointer'
                  >
                    Esqueceu sua senha?
                  </button>
                </div>
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
              <Button type='submit' className='w-full' disabled={isLoggingIn}>
                {isLoggingIn ? 'Entrando...' : 'Entrar'}
              </Button>
            </div>
          </form>
          <div className='bg-muted relative hidden md:block '>
            <Image
              src={imageSrc}
              alt='Image'
              width={500}
              height={500}
              className='absolute inset-0 h-full w-full object-cover bg-accent dark:bg-accent/50'
            />
          </div>
        </CardContent>
      </Card>
      <div className='text-muted-foreground *:[a]:hover:text-primary text-center text-xs text-balance *:[a]:underline *:[a]:underline-offset-4'>
        Ao continuar, você concorda com os{' '}
        <a
          href='#'
          className='underline underline-offset-4'
          onClick={() => toast('Ainda em desenvolvimento.')}
        >
          Termos de Serviço
        </a>{' '}
        e a{' '}
        <a
          href='#'
          className='underline underline-offset-4'
          onClick={() => toast('Ainda em desenvolvimento.')}
        >
          Política de Privacidade
        </a>
        .
      </div>
    </div>
  );
}
