import { env } from '@config/index';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/infra/database/schema',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    host: env.DB_HOST,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    port: env.DB_PORT,
    ssl: env.NODE_ENV === 'production' ? {
      rejectUnauthorized: false // Allow self-signed certificates
    } : false
  },
});