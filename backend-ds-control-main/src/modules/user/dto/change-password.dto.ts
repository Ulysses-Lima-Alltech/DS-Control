import z from "zod";

import { PasswordSchema } from "@common/types/password.schema";

export const ChangePasswordSchema = z.object({
  oldPassword: z.string().min(1, "Old password is required"),
  newPassword: PasswordSchema,
});

export type ChangePasswordDTO = z.infer<typeof ChangePasswordSchema>;
