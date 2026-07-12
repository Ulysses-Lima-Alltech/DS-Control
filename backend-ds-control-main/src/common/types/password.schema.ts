import z from "zod";


export const DefaultPasswordSchema = z.string()
  .min(3, "Password must be at least 3 characters long")
  .regex(/[A-Za-z]/, "Password must contain at least one letter");

export const LoginPasswordSchema = z.string().min(1, "Password is required");

export const StrongPasswordSchema = z.string()
  .min(8, "A senha deve ter pelo menos 8 caracteres")
  .regex(/[A-Z]/, "A senha deve conter uma letra maiúscula")
  .regex(/[a-z]/, "A senha deve conter uma letra minúscula")
  .regex(/[0-9]/, "A senha deve conter um número")
  .regex(/[^A-Za-z0-9]/, "A senha deve conter um caractere especial");
