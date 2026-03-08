import { z } from 'zod';

export const RegisterNewServiceOrderSchema = z.object({
  customerId: z.string().min(1, 'Cliente é obrigatório'),
  contractId: z.string().min(1, 'Contrato é obrigatório'),
  farmsIds: z.array(z.string()).min(1, 'Pelo menos uma fazenda é obrigatória'),
  pilotsIds: z.array(z.string()).min(1, 'Pelo menos um piloto é obrigatório'),
  plotsIds: z.array(z.string()).min(1, 'Pelo menos um talhão é obrigatório'),
  plannedDate: z.string().min(1, 'Data planejada é obrigatória'),
  observation: z.string().optional(),
});

export const UpdateServiceOrderByIdSchema = z.object({
  customerId: z.string().min(1, 'Cliente é obrigatório'),
  contractId: z.string().min(1, 'Contrato é obrigatório'),
  farmsIds: z.array(z.string()).min(1, 'Pelo menos uma fazenda é obrigatória'),
  pilotsIds: z.array(z.string()).min(1, 'Pelo menos um piloto é obrigatório'),
  plotsIds: z.array(z.string()).min(1, 'Pelo menos um talhão é obrigatório'),
  plannedDate: z.string().min(1, 'Data planejada é obrigatória'),
  observation: z.string().optional(),
});
