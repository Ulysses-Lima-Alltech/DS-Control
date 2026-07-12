import { z } from "zod";

export const AdministrativePasswordUpdateSchema = z.object({
  password: z
    .string()
    .min(1, "Senha é obrigatória")
    .refine((password) => password.trim().length > 0, "Senha é obrigatória"),
});

export type AdministrativePasswordUpdateDTO = z.infer<
  typeof AdministrativePasswordUpdateSchema
>;
