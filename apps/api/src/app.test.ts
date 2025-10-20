import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from './app.js';

describe('API health check', () => {
  it('returns OK for /health', async () => {
    const app = createApp();
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.text).toBe('OK');
  });
});

describe('fake dev endpoints', () => {
  it('returns a canned response for fake LLM', async () => {
    const app = createApp();
    const response = await request(app)
      .post('/api/dev/fake-llm')
      .send({ prompt: 'Hello' });
    expect(response.status).toBe(200);
    expect(response.body.reply).toBeTypeOf('string');
  });

  it('returns an audio url for fake TTS', async () => {
    const app = createApp();
    const response = await request(app).post('/api/dev/fake-tts');
    expect(response.status).toBe(200);
    expect(response.body.audioUrl).toMatch(/^data:audio\/wav;base64,/);
  });

  it('returns audio for /api/tts when fake flag is enabled', async () => {
    const app = createApp();
    const response = await request(app)
      .post('/api/tts')
      .send({ text: 'Hello', language: 'en-US', voice: 'default' });
    expect(response.status).toBe(200);
    expect(response.body.audioUrl).toMatch(/^data:audio\/wav;base64,/);
  });
});
