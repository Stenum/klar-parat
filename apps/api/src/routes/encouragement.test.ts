import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { resetDatabase } from '../test/utils.js';

const app = createApp();

const createSessionFixture = async () => {
  const child = await prisma.child.create({
    data: {
      firstName: 'Luna',
      birthdate: new Date('2016-02-14'),
      active: true
    }
  });

  const template = await prisma.template.create({
    data: {
      name: 'Morning Flow',
      defaultStartTime: '07:00',
      defaultEndTime: '08:00',
      tasks: {
        create: [
          { title: 'Wake up', expectedMinutes: 5, orderIndex: 0 },
          { title: 'Brush teeth', expectedMinutes: 3, orderIndex: 1 }
        ]
      }
    }
  });

  const startResponse = await request(app).post('/api/sessions/start').send({
    childId: child.id,
    templateId: template.id
  });

  return startResponse.body.session as { id: string; tasks: { id: string }[] };
};

describe.sequential('encouragement route', () => {
  const originalFlag = process.env.FLAG_USE_FAKE_LLM;
  const originalApiKey = process.env.OPENAI_API_KEY;

  beforeEach(async () => {
    await resetDatabase();
    process.env.FLAG_USE_FAKE_LLM = '1';
    process.env.OPENAI_API_KEY = originalApiKey;
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env.FLAG_USE_FAKE_LLM = originalFlag;
    process.env.OPENAI_API_KEY = originalApiKey;
  });

  it('returns a celebratory message for completed tasks when fake LLM is enabled', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T07:00:00.000Z'));

    const session = await createSessionFixture();

    await request(app).post(`/api/sessions/${session.id}/task/0/complete`).send();

    const response = await request(app)
      .post(`/api/sessions/${session.id}/message`)
      .send({
        type: 'completion',
        sessionTaskId: session.tasks[0].id,
        language: 'en-US'
      });

    expect(response.status).toBe(200);
    expect(response.body.text).toBeTypeOf('string');
    expect(response.body.text.length).toBeLessThanOrEqual(120);

    vi.useRealTimers();
  });

  it('falls back to a deterministic message when OpenAI is unavailable', async () => {
    const session = await createSessionFixture();
    process.env.FLAG_USE_FAKE_LLM = '0';
    delete process.env.OPENAI_API_KEY;

    const response = await request(app)
      .post(`/api/sessions/${session.id}/message`)
      .send({
        type: 'nudge',
        sessionTaskId: session.tasks[0].id,
        nudgeThreshold: 'first',
        language: 'da-DK'
      });

    expect(response.status).toBe(200);
    expect(response.body.text).toContain('Luna');
    expect(response.body.text.length).toBeLessThanOrEqual(120);
  });
});
