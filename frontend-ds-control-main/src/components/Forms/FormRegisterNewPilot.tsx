'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useRegisterNewUser } from '@/mutations/user.mutation';
import { RegisterNewUserSchema } from '@/schemas/user.schema';
import { RegisterNewUserParams } from '@/services/user.service';
import { UserType } from '@/types/user.type';

export default function FormRegisterNewPilot() {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RegisterNewUserParams>({
    resolver: zodResolver(RegisterNewUserSchema),
    defaultValues: {
      type: UserType.PILOT.value,
      password: '',
      confirmPassword: '',
    },
  });

  const { mutate: registerNewUser, isPending } = useRegisterNewUser();

  const onSubmit = (data: RegisterNewUserParams) => {
    registerNewUser(
      {
        ...data,
        type: UserType.PILOT.value,
      },
      {
        onSuccess: () => {
          toast('Piloto criado com sucesso');
          queryClient.invalidateQueries({ queryKey: ['users'] });
          reset({
            name: '',
            email: '',
            password: '',
            confirmPassword: '',
            type: UserType.PILOT.value,
          });
        },
        onError: (error) => {
          toast(error.message);
        },
      }
    );
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className='flex flex-col gap-4'>
      <DialogHeader>
        <DialogTitle>Criar novo piloto</DialogTitle>
        <DialogDescription>Crie um novo piloto para o sistema.</DialogDescription>
      </DialogHeader>
      <div className='flex flex-col gap-4'>
        <Input type='text' placeholder='Nome' {...register('name')} autoComplete='name' />
        {errors.name && <p className='text-red-500 text-sm'>{errors.name.message}</p>}
        <Input type='email' placeholder='Email' {...register('email')} autoComplete='email' />
        {errors.email && <p className='text-red-500 text-sm'>{errors.email.message}</p>}
        <Input
          type='password'
          placeholder='Senha'
          {...register('password')}
          autoComplete='new-password'
        />
        {errors.password && <p className='text-red-500 text-sm'>{errors.password.message}</p>}
        <Input
          type='password'
          placeholder='Confirmar senha'
          {...register('confirmPassword')}
          autoComplete='new-password'
        />
        {errors.confirmPassword && (
          <p className='text-red-500 text-sm'>{errors.confirmPassword.message}</p>
        )}
        <Button type='submit' disabled={isPending}>
          {isPending ? 'Criando piloto...' : 'Criar piloto'}
        </Button>
      </div>
    </form>
  );
}
