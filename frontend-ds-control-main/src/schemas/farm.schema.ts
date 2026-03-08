import { z } from 'zod';

export const RegisterNewFarmParamsSchema = z.object({
  name: z.string().min(1, { message: 'Nome é obrigatório' }),
  customerId: z.string().min(1, { message: 'Cliente é obrigatório' }),
  plots: z.array(z.any()).default([]),
});

export const EditFarmParamsSchema = z.object({
  name: z.string().min(1, { message: 'Nome é obrigatório' }),
  customerId: z.string().min(1, { message: 'Cliente é obrigatório' }),
  plots: z.array(z.any()).default([]),
});
