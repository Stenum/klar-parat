import 'dotenv/config';

import { PrismaClient } from '@prisma/client';

const missingDatabaseUrl = () => {
  throw new Error(
    'DATABASE_URL is not set. Copy .env.example to .env and ensure DATABASE_URL points to your SQLite file (e.g. file:./dev.db).'
  );
};

if (!process.env.DATABASE_URL) {
  missingDatabaseUrl();
}

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'test' ? [] : ['error', 'warn']
});
