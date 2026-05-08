import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import 'dotenv/config';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error('Database connection url missing!');

const db = drizzle(dbUrl);

await migrate(db, { migrationsFolder: './drizzle' });
