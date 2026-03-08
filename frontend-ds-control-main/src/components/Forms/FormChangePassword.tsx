import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useChangeCurrentUserPassword } from '@/mutations/user.mutation';
import { ChangeCurrentUserPasswordDialogSchema } from '@/schemas/user.schema';
import { ChangeCurrentUserPasswordParams } from '@/services/user.service';

export default function FormChangePassword() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<z.infer<typeof ChangeCurrentUserPasswordDialogSchema>>({
    resolver: zodResolver(ChangeCurrentUserPasswordDialogSchema),
  });

  const { mutate: changeCurrentUserPassword, isPending: isChangingCurrentUserPassword } =
    useChangeCurrentUserPassword({
      onSuccess: () => {
        toast('Senha alterada com sucesso');
        reset();
      },
      onError: (error) => {
        toast(error.message);
      },
    });

  const onSubmit = (data: ChangeCurrentUserPasswordParams) => {
    changeCurrentUserPassword({
      oldPassword: data.oldPassword,
      newPassword: data.newPassword,
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className='flex flex-col gap-4'>
      <div className='flex flex-col gap-2'>
        <DialogHeader>
          <DialogTitle>Alterar senha</DialogTitle>
          <DialogDescription>
            Digite sua senha atual e a nova senha duas vezes para alterá-la
          </DialogDescription>
        </DialogHeader>
        <Input type='password' placeholder='Senha atual' {...register('oldPassword')} />
        <span className='text-red-500 text-sm'>{errors.oldPassword?.message}</span>
        <Input type='password' placeholder='Nova senha' {...register('newPassword')} />
        <span className='text-red-500 text-sm'>{errors.newPassword?.message}</span>
        <Input
          type='password'
          placeholder='Confirmar nova senha'
          {...register('confirmNewPassword')}
        />
        <span className='text-red-500 text-sm'>{errors.confirmNewPassword?.message}</span>
      </div>
      <Button type='submit' disabled={isChangingCurrentUserPassword}>
        {isChangingCurrentUserPassword ? 'Alterando...' : 'Alterar'}
      </Button>
    </form>
  );
}
