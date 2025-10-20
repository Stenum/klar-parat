import { ttsRequestSchema } from '@klar-parat/shared';
import type { Express } from 'express';
import { Router } from 'express';

import { loadFeatureFlags } from '../config/flags.js';
import { generateSineWave } from '../lib/audio.js';
import { sendValidationError } from '../lib/http.js';

const router = Router();

router.post('/', (req, res) => {
  const parseResult = ttsRequestSchema.safeParse(req.body);

  if (!parseResult.success) {
    return sendValidationError(res, parseResult.error.issues);
  }

  const flags = loadFeatureFlags();

  if (flags.useFakeTTS) {
    return res.json({
      audioUrl: generateSineWave()
    });
  }

  return res.status(501).json({
    error: {
      code: 'NOT_IMPLEMENTED',
      message: 'Real TTS provider is not configured yet.'
    }
  });
});

export const registerTtsRoutes = (app: Express) => {
  app.use('/api/tts', router);
};
