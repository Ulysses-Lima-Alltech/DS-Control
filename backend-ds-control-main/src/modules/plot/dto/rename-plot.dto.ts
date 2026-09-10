import z from 'zod';

export const RenamePlotSchema = z.object({
  name: z.string().trim().min(1, 'Nome do talhao e obrigatorio').max(120),
});

export type RenamePlotDTO = z.infer<typeof RenamePlotSchema>;
