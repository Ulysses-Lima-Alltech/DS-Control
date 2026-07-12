'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAdministrativePasswordUpdate } from '@/mutations/user.mutation';

const AdministrativePasswordUpdateFormSchema = z
  .object({
    password: z.string().refine((password) => password.trim().length > 0, 'Senha é obrigatória'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  });

type AdministrativePasswordUpdateFormData = z.infer<typeof AdministrativePasswordUpdateFormSchema>;

type AdministrativePasswordUpdateDialogProps = {
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AdministrativePasswordUpdateDialog({
  userId,
  open,
  onOpenChange,
}: AdministrativePasswordUpdateDialogProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AdministrativePasswordUpdateFormData>({
    resolver: zodResolver(AdministrativePasswordUpdateFormSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  const close = () => {
    reset();
    setShowPassword(false);
    setShowConfirmPassword(false);
    onOpenChange(false);
  };

  const mutation = useAdministrativePasswordUpdate({
    onSuccess: () => {
      toast('Senha alterada com sucesso.');
      close();
    },
    onError: (error) => {
      toast(error.message);
    },
  });

  const onSubmit = ({ password }: AdministrativePasswordUpdateFormData) => {
    mutation.mutate({ userId, password });
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && close()}>
      <DialogContent>
        <form onSubmit={handleSubmit(onSubmit)} className='flex flex-col gap-4'>
          <DialogHeader>
            <DialogTitle>Alterar senha</DialogTitle>
            <DialogDescription>Defina uma nova senha para o usuário selecionado.</DialogDescription>
          </DialogHeader>

          <div className='flex flex-col gap-2'>
            <Label htmlFor='administrative-password'>Nova senha</Label>
            <div className='relative'>
              <Input
                id='administrative-password'
                type={showPassword ? 'text' : 'password'}
                autoComplete='new-password'
                className='pr-10'
                disabled={mutation.isPending}
                {...register('password')}
              />
              <Button
                type='button'
                variant='ghost'
                size='icon'
                className='absolute right-0 top-0 h-full hover:bg-transparent'
                onClick={() => setShowPassword((visible) => !visible)}
                disabled={mutation.isPending}
                aria-label={showPassword ? 'Ocultar nova senha' : 'Mostrar nova senha'}
              >
                {showPassword ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
              </Button>
            </div>
            {errors.password && (
              <p className='text-sm text-destructive' role='alert'>
                {errors.password.message}
              </p>
            )}
          </div>

          <div className='flex flex-col gap-2'>
            <Label htmlFor='administrative-password-confirmation'>Confirmar nova senha</Label>
            <div className='relative'>
              <Input
                id='administrative-password-confirmation'
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete='new-password'
                className='pr-10'
                disabled={mutation.isPending}
                {...register('confirmPassword')}
              />
              <Button
                type='button'
                variant='ghost'
                size='icon'
                className='absolute right-0 top-0 h-full hover:bg-transparent'
                onClick={() => setShowConfirmPassword((visible) => !visible)}
                disabled={mutation.isPending}
                aria-label={
                  showConfirmPassword
                    ? 'Ocultar confirmação da senha'
                    : 'Mostrar confirmação da senha'
                }
              >
                {showConfirmPassword ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
              </Button>
            </div>
            {errors.confirmPassword && (
              <p className='text-sm text-destructive' role='alert'>
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type='button' variant='outline' onClick={close} disabled={mutation.isPending}>
              Cancelar
            </Button>
            <Button type='submit' disabled={mutation.isPending}>
              {mutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
