import z from "zod";

import { DefaultPasswordSchema } from "@common/types/password.schema";

export const ChangePasswordSchema = z.object({
  oldPassword: z.string().min(1, "Old password is required"),
  newPassword: DefaultPasswordSchema,
});

export type ChangePasswordDTO = z.infer<typeof ChangePasswordSchema>; 