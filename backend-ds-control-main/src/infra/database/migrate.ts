import 'dotenv/config';


import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from 'drizzle-orm/node-postgres/migrator';

import { db, client } from '.';
import * as schema from './schema'

(async () => {
  let database = db;

  if(!database) { 
    database = drizzle(client, { schema })
  }

  await migrate(database, { migrationsFolder: './drizzle' });
  await client.end();
})();