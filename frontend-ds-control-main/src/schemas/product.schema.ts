import { z } from 'zod';

export const RegisterNewProductSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
});

export const UpdateProductByIdSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
});
