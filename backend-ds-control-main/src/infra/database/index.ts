import { env } from "@config/index";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

import { Client } from "pg";

const client = new Client({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  ssl: env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false // Allow self-signed certificates
  } : false
});

let db: NodePgDatabase<typeof schema>;

(async () => {
  await client.connect();
  db = drizzle(client, { 
    schema,
    logger: env.NODE_ENV === 'development',
  });
})();

export { client, db };
