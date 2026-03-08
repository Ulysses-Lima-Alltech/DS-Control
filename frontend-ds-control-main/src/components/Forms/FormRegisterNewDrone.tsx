'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useRegisterNewDrone } from '@/mutations/drone.mutation';
import { RegisterNewDroneSchema } from '@/schemas/drone.schema';
import { RegisterNewDroneParams } from '@/services/drone.service';

export default function FormRegisterNewDrone() {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RegisterNewDroneParams>({
    resolver: zodResolver(RegisterNewDroneSchema),
  });

  const { mutate: registerNewDrone, isPending } = useRegisterNewDrone();

  const onSubmit = (data: RegisterNewDroneParams) => {
    registerNewDrone(data, {
      onSuccess: () => {
        toast('Drone criado com sucesso');
        queryClient.invalidateQueries({ queryKey: ['drones'] });
        reset({
          name: '',
          model: '',
          aircraftRid: '',
        });
      },
      onError: (error) => {
        toast(error.message);
      },
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className='flex flex-col gap-4'>
      <DialogHeader>
        <DialogTitle>Criar novo drone</DialogTitle>
        <DialogDescription>Crie um novo drone para o sistema.</DialogDescription>
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
          {isPending ? 'Criando drone...' : 'Criar drone'}
        </Button>
      </div>
    </form>
  );
}
