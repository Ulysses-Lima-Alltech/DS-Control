import { DefaultPasswordSchema } from "@common/types/password.schema";
import { z } from "zod";

export const ResetPasswordSchema = z.object({
  token: z.string(),
  userId: z.string(),
  password: DefaultPasswordSchema,
})

export type ResetPasswordDto = z.infer<typeof ResetPasswordSchema>;
