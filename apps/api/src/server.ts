import dotenv from 'dotenv';

import { createApp } from './app.js';
import { ensureDatabaseMigrated } from './lib/migrate.js';

dotenv.config();

async function start() {
  await ensureDatabaseMigrated();

  const port = Number(process.env.PORT ?? 4000);
  const app = createApp();

  app.listen(port, () => {
    console.log(`API server listening on http://localhost:${port}`);
  });
}

start().catch((error) => {
  console.error('Failed to start API server:', error);
  process.exit(1);
});
