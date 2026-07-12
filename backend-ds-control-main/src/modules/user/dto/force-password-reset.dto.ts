import { DefaultPasswordSchema } from "@common/types/password.schema";
import { z } from "zod";

export const ForcePasswordResetSchema = z.object({
  temporaryPassword: DefaultPasswordSchema,
});

export type ForcePasswordResetDTO = z.infer<typeof ForcePasswordResetSchema>;
