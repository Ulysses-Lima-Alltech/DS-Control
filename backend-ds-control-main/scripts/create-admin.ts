/**
 * Script para criar um usuário admin/backoffice quando não há ninguém logado.
 * Usa a mesma config e bcrypt do projeto.
 *
 * Uso (na raiz do backend):
 *   set CREATE_ADMIN_EMAIL=admin@exemplo.com
 *   set CREATE_ADMIN_NAME=Admin
 *   set CREATE_ADMIN_PASSWORD=SenhaSegura123
 *   npx tsx scripts/create-admin.ts
 *
 * Ou no PowerShell:
 *   $env:CREATE_ADMIN_EMAIL="admin@exemplo.com"
 *   $env:CREATE_ADMIN_NAME="Admin"
 *   $env:CREATE_ADMIN_PASSWORD="SenhaSegura123"
 *   npx tsx scripts/create-admin.ts
 */

import "dotenv/config";
import bcrypt from "bcrypt";
import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import { eq } from "drizzle-orm";

import { env } from "../src/config/index";
import * as schema from "../src/infra/database/schema";

const EMAIL = process.env.CREATE_ADMIN_EMAIL ?? "admin@exemplo.com";
const NAME = process.env.CREATE_ADMIN_NAME ?? "Admin";
const PASSWORD = process.env.CREATE_ADMIN_PASSWORD;

if (!PASSWORD || PASSWORD.length < 6) {
  console.error("Defina CREATE_ADMIN_PASSWORD (mín. 6 caracteres)");
  process.exit(1);
}

async function main() {
  const client = new Client({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    ssl:
      env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  });
  await client.connect();
  const db = drizzle(client, { schema });

  const existing = await db.query.users.findFirst({
    where: eq(schema.users.email, EMAIL),
  });
  if (existing) {
    console.error("Já existe usuário com email:", EMAIL);
    await client.end();
    process.exit(1);
  }

  const hashedPassword = await bcrypt.hash(
    PASSWORD,
    env.BCRYPT_SALT_ROUNDS
  );
  await db.insert(schema.users).values({
    name: NAME,
    email: EMAIL,
    password: hashedPassword,
    type: "backoffice",
  });
  console.log("Usuário admin criado:", EMAIL);
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
