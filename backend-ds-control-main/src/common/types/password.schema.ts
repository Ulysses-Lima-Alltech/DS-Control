import z from "zod";


export const DefaultPasswordSchema = z.string()
  .min(3, "Password must be at least 3 characters long")
  .regex(/[A-Za-z]/, "Password must contain at least one letter")