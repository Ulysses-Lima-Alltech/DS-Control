import { z } from "zod";

export const envSchema = z.object({
  API_URL: z.string().default("http://localhost:3000"),
  NODE_ENV: z.enum(["development", "production"]).default("development"),
  HTTP_PORT: z
    .string()
    .default("3000")
    .transform((value) => Number.parseInt(value)),
  DB_HOST: z.string(),
  DB_USER: z.string(),
  DB_PASSWORD: z.string(),
  DB_NAME: z.string(),
  DB_PORT: z
    .string()
    .default("5432")
    .transform((value) => Number.parseInt(value)),
  FRONTEND_URL: z.string().default("http://localhost:3001"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  RESEND_API_KEY: z.string().default("re_ebyPGQWD_5nRTDwgVSowJVzPsMAdSmPup"),
  COOKIES_SECRET: z.string(),
  ACCESS_TOKEN_SECRET: z.string(),
  REFRESH_TOKEN_SECRET: z.string(),
  BCRYPT_SALT_ROUNDS: z
    .string()
    .default("10")
    .transform((value) => Number.parseInt(value)),
});

export type Env = z.infer<typeof envSchema>;

export const env = envSchema.parse(process.env);
