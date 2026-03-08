'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useUpdateDroneById } from '@/mutations/drone.mutation';
import { UpdateDroneByIdSchema } from '@/schemas/drone.schema';
import { UpdateDroneByIdParams } from '@/services/drone.service';
import { Drone } from '@/types/drone.type';

type FormEditDroneProps = {
  drone: Drone;
  onSuccess?: () => void;
};

export default function FormEditDrone({ drone, onSuccess }: FormEditDroneProps) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Omit<UpdateDroneByIdParams, 'id'>>({
    resolver: zodResolver(UpdateDroneByIdSchema),
    defaultValues: {
      name: drone.name,
      model: drone.model,
      aircraftRid: drone.aircraftRid,
    },
  });

  const { mutate: updateDroneById, isPending } = useUpdateDroneById();

  const onSubmit = (data: Omit<UpdateDroneByIdParams, 'id'>) => {
    updateDroneById(
      { ...data, id: drone.id },
      {
        onSuccess: () => {
          toast('Drone atualizado com sucesso');
          queryClient.invalidateQueries({ queryKey: ['drones'] });
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
        <DialogTitle>Editar drone</DialogTitle>
        <DialogDescription>Atualize as informações do drone.</DialogDescription>
      </DialogHeader>
      <div className='flex flex-col gap-4'>
        <Input type='text' placeholder='Nome' {...register('name')} autoComplete='name' />
        {errors.name && <p className='text-red-500 text-sm'>{errors.name.message}</p>}

        <Input type='text' placeholder='Modelo' {...register('model')} autoComplete='model' />
        {errors.model && <p className='text-red-500 text-sm'>{errors.model.message}</p>}

        <Input
          type='text'
          placeholder='RID da aeronave'
          {...register('aircraftRid')}
          autoComplete='aircraftRid'
        />
        {errors.aircraftRid && <p className='text-red-500 text-sm'>{errors.aircraftRid.message}</p>}

        <Button type='submit' disabled={isPending}>
          {isPending ? 'Atualizando drone...' : 'Atualizar drone'}
        </Button>
      </div>
    </form>
  );
}
