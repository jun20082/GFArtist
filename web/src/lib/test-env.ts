import path from 'node:path';
import { config } from 'dotenv';

config({ path: path.resolve(process.cwd(), '.env.test'), override: true, quiet: true });

const databaseUrl = process.env.DATABASE_URL ?? '';

if (!/\/sejin_test(\?|$)/.test(databaseUrl)) {
  throw new Error(
    'Refusing to run tests: DATABASE_URL must point at the sejin_test database. Check web/.env.test.',
  );
}
