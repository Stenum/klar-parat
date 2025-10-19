import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll } from 'vitest';

import { prisma } from '../lib/prisma.js';

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const tmpDir = path.join(apiRoot, 'tmp');

fs.mkdirSync(tmpDir, { recursive: true });

const dbFile = path.join(tmpDir, 'test.db');
if (fs.existsSync(dbFile)) {
  fs.rmSync(dbFile);
}

process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'file:./tmp/test.db';
process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';

execSync('npx prisma migrate deploy', {
  cwd: apiRoot,
  stdio: 'inherit'
});

afterAll(async () => {
  await prisma.$disconnect();
});
