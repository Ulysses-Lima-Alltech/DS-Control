import { z } from 'zod';

export const RegisterNewContractSchema = z.object({
  customerId: z.string().min(1, 'Cliente é obrigatório'),
  name: z.string().min(1, 'Nome é obrigatório'),
  dateStart: z.string().min(1, 'Data de início é obrigatória'),
  dateEnd: z.string().min(1, 'Data de fim é obrigatória'),
  observation: z.string().optional(),
});

export const UpdateContractByIdSchema = z.object({
  customerId: z.string().min(1, 'Cliente é obrigatório'),
  name: z.string().min(1, 'Nome é obrigatório'),
  dateStart: z.string().min(1, 'Data de início é obrigatória'),
  dateEnd: z.string().min(1, 'Data de fim é obrigatória'),
  observation: z.string().optional(),
});
