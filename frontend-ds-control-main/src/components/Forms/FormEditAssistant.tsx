'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useUpdateAssistantById } from '@/mutations/assistant.mutation';
import { UpdateAssistantByIdSchema } from '@/schemas/assistant.schema';
import { UpdateAssistantByIdParams } from '@/services/assistant.service';
import { Assistant } from '@/types/assistant.type';

type FormEditAssistantProps = {
  assistant: Assistant;
  onSuccess?: () => void;
};

export default function FormEditAssistant({ assistant, onSuccess }: FormEditAssistantProps) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Omit<UpdateAssistantByIdParams, 'id'>>({
    resolver: zodResolver(UpdateAssistantByIdSchema),
    defaultValues: {
      name: assistant.name,
    },
  });

  const { mutate: updateAssistantById, isPending } = useUpdateAssistantById();

  const onSubmit = (data: Omit<UpdateAssistantByIdParams, 'id'>) => {
    updateAssistantById(
      { ...data, id: assistant.id },
      {
        onSuccess: () => {
          toast('Assistente atualizado com sucesso');
          queryClient.invalidateQueries({ queryKey: ['assistants'] });
          onSuccess?.();
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
        <DialogTitle>Editar assistente</DialogTitle>
        <DialogDescription>Atualize as informações do assistente.</DialogDescription>
      </DialogHeader>
      <div className='flex flex-col gap-4'>
        <Input type='text' placeholder='Nome' {...register('name')} autoComplete='name' />
        {errors.name && <p className='text-red-500 text-sm'>{errors.name.message}</p>}
        <Button type='submit' disabled={isPending}>
          {isPending ? 'Atualizando assistente...' : 'Atualizar assistente'}
        </Button>
      </div>
    </form>
  );
}
