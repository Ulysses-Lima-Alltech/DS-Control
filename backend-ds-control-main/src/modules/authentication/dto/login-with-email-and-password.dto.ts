import { DefaultPasswordSchema } from "@common/types/password.schema";
import z from "zod";

export const LoginWithEmailAndPasswordSchema = z.object({
  email: z.string().email().transform(value => value.toLowerCase()),
  password: DefaultPasswordSchema
});

export type LoginWithEmailAndPasswordDTO = z.infer<typeof LoginWithEmailAndPasswordSchema>;