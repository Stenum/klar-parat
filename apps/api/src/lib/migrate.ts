import { spawn } from 'node:child_process';

let migratePromise: Promise<void> | null = null;

const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function runMigrate(): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, ['prisma', 'migrate', 'deploy'], {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'inherit'
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Prisma migrate deploy exited with code ${code}`));
      }
    });
  });
}

export function ensureDatabaseMigrated(): Promise<void> {
  if (!migratePromise) {
    migratePromise = runMigrate().catch((error) => {
      migratePromise = null;
      throw error;
    });
  }

  return migratePromise;
}
