import { z } from 'zod';

export const RegisterNewDroneSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  model: z.string().min(1, 'Modelo é obrigatório'),
  aircraftRid: z.string().min(1, 'RID da aeronave é obrigatório'),
});

export const UpdateDroneByIdSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  model: z.string().min(1, 'Modelo é obrigatório'),
  aircraftRid: z.string().min(1, 'RID da aeronave é obrigatório'),
});
