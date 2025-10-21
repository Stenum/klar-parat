import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
    expect(session.actualStartAt).toBeTruthy();

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

  it('marks task completion, enforces finishing rules, and assigns medals', async () => {
    vi.useFakeTimers();
    const startTime = new Date('2025-01-01T07:00:00.000Z');
    vi.setSystemTime(startTime);

    const { child, template } = await createFixtures();

    const startResponse = await request(app).post('/api/sessions/start').send({
      childId: child.id,
      templateId: template.id
    });

    const sessionId = startResponse.body.session.id as string;
    expect(startResponse.body.session.actualStartAt).toBeTruthy();

    const completeFirst = await request(app)
      .post(`/api/sessions/${sessionId}/task/0/complete`)
      .send({});

    expect(completeFirst.status).toBe(200);
    expect(completeFirst.body.session.actualStartAt).toBeTruthy();
    expect(completeFirst.body.session.tasks[0].completedAt).toBeTruthy();

    const prematureFinish = await request(app).post(`/api/sessions/${sessionId}/finish`).send();
    expect(prematureFinish.status).toBe(400);
    expect(prematureFinish.body.error.message).toContain('All tasks must be completed');

    vi.setSystemTime(new Date(startTime.getTime() + 9 * 60 * 1000));

    const completeSecond = await request(app)
      .post(`/api/sessions/${sessionId}/task/1/complete`)
      .send({});
    expect(completeSecond.status).toBe(200);

    const finishResponse = await request(app).post(`/api/sessions/${sessionId}/finish`).send();
    expect(finishResponse.status).toBe(200);
    expect(finishResponse.body.session.medal).toBe('silver');
    expect(finishResponse.body.session.actualEndAt).toBeTruthy();
    expect(new Date(finishResponse.body.session.actualEndAt).getTime()).toBeGreaterThan(
      new Date(finishResponse.body.session.actualStartAt!).getTime()
    );

    const idempotentFinish = await request(app).post(`/api/sessions/${sessionId}/finish`).send();
    expect(idempotentFinish.status).toBe(200);
    expect(idempotentFinish.body.session.medal).toBe('silver');

    vi.useRealTimers();
  });

  it('supports skipping tasks and still finishing with a medal', async () => {
    vi.useFakeTimers();
    const now = new Date('2025-01-01T08:00:00.000Z');
    vi.setSystemTime(now);

    const { child, template } = await createFixtures();
    const startResponse = await request(app).post('/api/sessions/start').send({
      childId: child.id,
      templateId: template.id,
      allowSkip: true
    });

    const sessionId = startResponse.body.session.id as string;

    const skipFirst = await request(app)
      .post(`/api/sessions/${sessionId}/task/0/complete`)
      .send({ skipped: true });
    expect(skipFirst.status).toBe(200);
    expect(skipFirst.body.session.tasks[0].skipped).toBe(true);
    expect(skipFirst.body.session.actualStartAt).toBeTruthy();

    const skipSecond = await request(app)
      .post(`/api/sessions/${sessionId}/task/1/complete`)
      .send({ skipped: true });
    expect(skipSecond.status).toBe(200);

    const finishResponse = await request(app).post(`/api/sessions/${sessionId}/finish`).send();
    expect(finishResponse.status).toBe(200);
    expect(finishResponse.body.session.medal).toBe('gold');
    expect(finishResponse.body.session.actualStartAt).toBeTruthy();
    expect(
      new Date(finishResponse.body.session.actualEndAt!).getTime()
    ).toBeGreaterThanOrEqual(new Date(finishResponse.body.session.actualStartAt!).getTime());

    vi.useRealTimers();
  });

  it('returns telemetry data and triggers nudges once per threshold', async () => {
    vi.useFakeTimers();
    const startTime = new Date('2025-01-01T07:00:00.000Z');
    vi.setSystemTime(startTime);

    const child = await prisma.child.create({
      data: {
        firstName: 'Nudgee',
        birthdate: new Date('2016-05-01'),
        active: true
      }
    });

    const template = await prisma.template.create({
      data: {
        name: 'Quick Task',
        defaultStartTime: '07:00',
        defaultEndTime: '08:00',
        tasks: {
          create: [{ title: 'Focus Task', expectedMinutes: 3, orderIndex: 0 }]
        }
      }
    });

    const startResponse = await request(app).post('/api/sessions/start').send({
      childId: child.id,
      templateId: template.id
    });

    const sessionId = startResponse.body.session.id as string;

    const initialTelemetry = await request(app).get(`/api/sessions/${sessionId}/telemetry`);
    expect(initialTelemetry.status).toBe(200);
    expect(initialTelemetry.body.telemetry.nudges).toHaveLength(0);
    expect(initialTelemetry.body.telemetry.sessionEndsAt).toMatch(/T/);
    expect(initialTelemetry.body.telemetry.currentTask).toMatchObject({
      nudgesFiredCount: 0,
      totalScheduledNudges: 3
    });

    vi.setSystemTime(new Date(startTime.getTime() + 60 * 1000));
    const firstNudgeTelemetry = await request(app).get(`/api/sessions/${sessionId}/telemetry`);
    expect(firstNudgeTelemetry.body.telemetry.nudges).toHaveLength(1);
    expect(firstNudgeTelemetry.body.telemetry.nudges[0].threshold).toBe('first');
    expect(firstNudgeTelemetry.body.telemetry.currentTask?.nudgesFiredCount).toBe(1);

    const noDuplicate = await request(app).get(`/api/sessions/${sessionId}/telemetry`);
    expect(noDuplicate.body.telemetry.nudges).toHaveLength(0);

    vi.setSystemTime(new Date(startTime.getTime() + 2 * 60 * 1000));
    const secondNudgeTelemetry = await request(app).get(`/api/sessions/${sessionId}/telemetry`);
    expect(secondNudgeTelemetry.body.telemetry.nudges).toHaveLength(1);
    expect(secondNudgeTelemetry.body.telemetry.nudges[0].threshold).toBe('second');
    expect(secondNudgeTelemetry.body.telemetry.currentTask?.nudgesFiredCount).toBe(2);

    vi.setSystemTime(new Date(startTime.getTime() + 3 * 60 * 1000));
    const finalNudgeTelemetry = await request(app).get(`/api/sessions/${sessionId}/telemetry`);
    expect(finalNudgeTelemetry.body.telemetry.nudges).toHaveLength(1);
    expect(finalNudgeTelemetry.body.telemetry.nudges[0].threshold).toBe('final');
    expect(finalNudgeTelemetry.body.telemetry.currentTask?.nudgesFiredCount).toBe(3);

    vi.useRealTimers();
  });
});
