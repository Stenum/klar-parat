import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { resetDatabase } from '../test/utils.js';

const createFixtures = async () => {
  const child = await prisma.child.create({
    data: {
      firstName: 'Ada',
      birthdate: new Date('2015-04-03'),
      active: true
    }
  });

  const template = await prisma.template.create({
    data: {
      name: 'Morning',
      defaultStartTime: '07:00',
      defaultEndTime: '08:00',
      tasks: {
        create: [
          { title: 'Wake up', expectedMinutes: 5, orderIndex: 0 },
          { title: 'Brush Teeth', expectedMinutes: 3, orderIndex: 1 }
        ]
      }
    },
    include: { tasks: true }
  });

  return { child, template };
};

describe.sequential('sessions routes', () => {
  const app = createApp();

  beforeEach(async () => {
    await resetDatabase();
  });

  it('starts a session from a template and returns session data', async () => {
    const { child, template } = await createFixtures();

    const response = await request(app).post('/api/sessions/start').send({
      childId: child.id,
      templateId: template.id,
      allowSkip: true
    });

    expect(response.status).toBe(201);
    const session = response.body.session;
    expect(session.childId).toBe(child.id);
    expect(session.allowSkip).toBe(true);
    expect(session.tasks).toHaveLength(2);
    expect(session.tasks[0].title).toBe('Wake up');

    const persisted = await request(app).get(`/api/sessions/${session.id}`);
    expect(persisted.status).toBe(200);
    expect(persisted.body.session.tasks[1].title).toBe('Brush Teeth');
  });

  it('validates payloads', async () => {
    const response = await request(app).post('/api/sessions/start').send({});
    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain('childId');
  });

  it('returns not found when template is missing', async () => {
    const { child } = await createFixtures();

    const response = await request(app).post('/api/sessions/start').send({
      childId: child.id,
      templateId: 'cktemplate12345678901234567'
    });

    expect(response.status).toBe(404);
    expect(response.body.error.message).toContain('Template not found');
  });
});
