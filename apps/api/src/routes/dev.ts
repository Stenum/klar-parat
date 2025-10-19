import type { Express, Request, Response } from 'express';

import { loadFeatureFlags } from '../config/flags.js';

const generateSineWave = ({
  frequency = 440,
  durationMs = 600,
  sampleRate = 16000
} = {}) => {
  const totalSamples = Math.floor((durationMs / 1000) * sampleRate);
  const headerSize = 44;
  const buffer = new ArrayBuffer(headerSize + totalSamples * 2);
  const view = new DataView(buffer);
  const writeString = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  };

  const blockAlign = 2;
  const byteRate = sampleRate * blockAlign;

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + totalSamples * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, totalSamples * 2, true);

  let offset = headerSize;
  for (let i = 0; i < totalSamples; i += 1) {
    const sample = Math.sin((2 * Math.PI * frequency * i) / sampleRate);
    view.setInt16(offset, sample * 0x7fff, true);
    offset += 2;
  }

  const uint8 = new Uint8Array(buffer);
  const binary = String.fromCharCode(...uint8);
  return `data:audio/wav;base64,${Buffer.from(binary, 'binary').toString('base64')}`;
};

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
