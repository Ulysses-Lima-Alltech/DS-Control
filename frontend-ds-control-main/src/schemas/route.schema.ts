import { z } from 'zod';

export const CreateRouteSchema = z.object({
  name: z.string().min(1, { message: 'Nome é obrigatório' }),
  geoJson: z.record(z.string(), z.unknown()),
  farmId: z.string().uuid({ message: 'Fazenda é obrigatória' }),
  customerId: z.string().uuid({ message: 'Cliente é obrigatório' }),
});

export const UpdateRouteSchema = z.object({
  name: z.string().min(1, { message: 'Nome é obrigatório' }).optional(),
  geoJson: z.record(z.string(), z.unknown()).optional(),
  farmId: z.string().uuid({ message: 'Fazenda inválida' }).optional(),
  customerId: z.string().uuid({ message: 'Cliente inválido' }).optional(),
});

export type CreateRouteFormData = z.infer<typeof CreateRouteSchema>;
export type UpdateRouteFormData = z.infer<typeof UpdateRouteSchema>;
