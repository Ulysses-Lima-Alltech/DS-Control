import z from "zod";


export const PasswordSchema = z.string()
  .min(1, "Senha é obrigatória")
  .min(6, "A senha deve ter no mínimo 6 caracteres");

export const LoginPasswordSchema = z.string().min(1, "Senha é obrigatória");
