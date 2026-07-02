import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbUrl = process.env.DATABASE_URL ?? `file:${join(__dirname, '..', 'local.db')}`;

const client = createClient({ url: dbUrl });

export const db = drizzle(client, { schema });
export * from './schema/index.js';
