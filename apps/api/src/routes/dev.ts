import type { Express, Request, Response } from 'express';

import { loadFeatureFlags } from '../config/flags.js';
import { generateSineWave } from '../lib/audio.js';

const respondWithFlags = (res: Response) => {
  const flags = loadFeatureFlags();
  res.json({ flags });
};

export const registerDevRoutes = (app: Express) => {
  app.get('/api/dev/feature-flags', (_req, res) => {
    respondWithFlags(res);
  });

  app.post('/api/dev/fake-llm', (req: Request, res: Response) => {
    const { prompt } = (req.body as { prompt?: string }) ?? {};
    res.json({
      reply: 'Great job! Keep up the routine!',
      echoedPrompt: prompt ?? null
    });
  });

  app.post('/api/dev/fake-tts', (_req: Request, res: Response) => {
    res.json({
      audioUrl: generateSineWave()
    });
  });
};
