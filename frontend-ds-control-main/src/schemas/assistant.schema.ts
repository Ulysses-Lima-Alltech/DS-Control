import { z } from 'zod';

export const RegisterNewAssistantSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
});

export const UpdateAssistantByIdSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
});
