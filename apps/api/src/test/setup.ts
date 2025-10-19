import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll } from 'vitest';

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const tmpDir = path.join(apiRoot, 'tmp');
const dbFile = path.join(tmpDir, 'test.db');

fs.mkdirSync(tmpDir, { recursive: true });

if (fs.existsSync(dbFile)) {
  fs.rmSync(dbFile);
}

const sqliteUrl = `file:${dbFile.replace(/\\/g, '/')}`;
process.env.DATABASE_URL = process.env.DATABASE_URL ?? sqliteUrl;
process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';

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
});
