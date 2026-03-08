import z from "zod";


export const UpdateMeSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).optional(),
});

export type UpdateMeDTO = z.infer<typeof UpdateMeSchema>; 