import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useUpdateCurrentUser } from '@/mutations/user.mutation';
import { useAuth } from '@/providers/auth.provider';
import { UpdateCurrentUserSchema } from '@/schemas/user.schema';

type FormEditCurrentUserProps = {
  onSuccess?: () => void;
};

export default function FormEditCurrentUser({ onSuccess }: FormEditCurrentUserProps) {
  const { user, refreshUser } = useAuth();
  const { mutate: updateCurrentUser, isPending: isUpdatingCurrentUser } = useUpdateCurrentUser({
    onSuccess: () => {
      toast('Usuário atualizado com sucesso');
      refreshUser();
      onSuccess?.();
    },
    onError: (error) => {
      toast('Erro ao atualizar usuário', {
        description: error.message,
      });
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof UpdateCurrentUserSchema>>({
    defaultValues: {
      name: user?.name,
      email: user?.email,
    },
    resolver: zodResolver(UpdateCurrentUserSchema),
  });

  const onSubmit = (data: z.infer<typeof UpdateCurrentUserSchema>) => {
    updateCurrentUser(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className='flex flex-col gap-4'>
      <div className='flex flex-col gap-2'>
        <DialogHeader>
          <DialogTitle>Editar informações</DialogTitle>
          <DialogDescription>Atualize suas informações pessoais</DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          <div className='flex flex-col space-y-1.5'>
            <label className='text-sm font-medium text-muted-foreground'>Nome</label>
            <Input {...register('name')} disabled={isUpdatingCurrentUser} placeholder='Seu nome' />
            {errors.name && <span className='text-red-500 text-sm'>{errors.name.message}</span>}
          </div>

          <div className='flex flex-col space-y-1.5'>
            <label className='text-sm font-medium text-muted-foreground'>Email</label>
            <Input
              {...register('email')}
              disabled={isUpdatingCurrentUser}
              placeholder='Seu email'
            />
            {errors.email && <span className='text-red-500 text-sm'>{errors.email.message}</span>}
          </div>
        </div>
      </div>

      <Button type='submit' disabled={isUpdatingCurrentUser}>
        {isUpdatingCurrentUser ? 'Salvando...' : 'Salvar alterações'}
      </Button>
    </form>
  );
}
