import { z } from "zod";

export const RequestPasswordResetSchema = z.object({
  email: z.string().email().transform(value => value.trim()).transform(value => value.toLowerCase()),
})

export type RequestPasswordResetDto = z.infer<typeof RequestPasswordResetSchema>;
