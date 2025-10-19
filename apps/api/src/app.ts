import cors from 'cors';
import express from 'express';

import { registerChildrenRoutes } from './routes/children.js';
import { registerDevRoutes } from './routes/dev.js';
import { registerTemplateRoutes } from './routes/templates.js';

export const createApp = () => {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.type('text/plain').send('OK');
  });

  registerChildrenRoutes(app);
  registerTemplateRoutes(app);
  registerDevRoutes(app);

  return app;
};
