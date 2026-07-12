import { PasswordSchema } from "@common/types/password.schema";
import { z } from "zod";

export const ResetPasswordSchema = z.object({
  token: z.string(),
  userId: z.string(),
  password: PasswordSchema,
})

export type ResetPasswordDto = z.infer<typeof ResetPasswordSchema>;
