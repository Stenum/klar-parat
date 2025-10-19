import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll } from 'vitest';

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const tmpDir = path.join(apiRoot, 'tmp');
const poolId = process.env.VITEST_POOL_ID ?? process.env.VITEST_WORKER_ID ?? '0';
const dbFile = path.join(tmpDir, `test-${poolId}.db`);
const journalFile = `${dbFile}-journal`;
const originalDatabaseUrl = process.env.DATABASE_URL;

fs.mkdirSync(tmpDir, { recursive: true });

if (fs.existsSync(dbFile)) {
  fs.rmSync(dbFile);
}
if (fs.existsSync(journalFile)) {
  fs.rmSync(journalFile);
}

const sqliteUrl = `file:${dbFile.replace(/\\/g, '/')}`;
process.env.DATABASE_URL = sqliteUrl;
process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';

execSync('npx prisma generate', {
  cwd: apiRoot,
  stdio: 'inherit'
});

const prismaModulePromise = import('../lib/prisma.js');

beforeAll(async () => {
  execSync('npx prisma migrate deploy', {
    cwd: apiRoot,
    stdio: 'inherit'
  });
});

afterAll(async () => {
  const { prisma } = await prismaModulePromise;
  await prisma.$disconnect();
  if (originalDatabaseUrl) {
    process.env.DATABASE_URL = originalDatabaseUrl;
  } else {
    delete process.env.DATABASE_URL;
  }
  if (fs.existsSync(dbFile)) {
    fs.rmSync(dbFile);
  }
  if (fs.existsSync(journalFile)) {
    fs.rmSync(journalFile);
  }
});
