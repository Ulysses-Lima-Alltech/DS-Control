import { z } from 'zod';

export const RegisterNewFarmParamsSchema = z.object({
  name: z.string().min(1, { message: 'Nome é obrigatório' }),
  customerId: z.string().min(1, { message: 'Cliente é obrigatório' }),
  mapColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, { message: 'Use o formato #RRGGBB' })
    .transform((value) => value.toUpperCase())
    .optional(),
  plots: z.array(z.any()).default([]),
});

export const EditFarmParamsSchema = z.object({
  name: z.string().min(1, { message: 'Nome é obrigatório' }),
  customerId: z.string().min(1, { message: 'Cliente é obrigatório' }),
  mapColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, { message: 'Use o formato #RRGGBB' })
    .transform((value) => value.toUpperCase()),
  plots: z.array(z.any()).default([]),
});
