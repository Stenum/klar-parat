import cors from 'cors';
import express from 'express';

import { registerDevRoutes } from './routes/dev.js';

export const createApp = () => {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.type('text/plain').send('OK');
  });

  registerDevRoutes(app);

  return app;
};
