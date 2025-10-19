import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import { resetDatabase } from '../test/utils.js';

describe.sequential('templates routes', () => {
  const app = createApp();

  beforeEach(async () => {
    await resetDatabase();
  });

  it('creates, lists, updates, and deletes templates', async () => {
    const createResponse = await request(app).post('/api/templates').send({
      name: 'Morning',
      defaultStartTime: '07:00',
      defaultEndTime: '08:00',
      tasks: [
        { title: 'Wake up', expectedMinutes: 5 },
        { title: 'Brush Teeth', expectedMinutes: 2 }
      ]
    });

    expect(createResponse.status).toBe(201);
    const templateId = createResponse.body.template.id;
    expect(createResponse.body.template.tasks).toHaveLength(2);

    const listResponse = await request(app).get('/api/templates');
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.templates).toHaveLength(1);

    const updateResponse = await request(app)
      .put(`/api/templates/${templateId}`)
      .send({
        name: 'Updated Morning',
        defaultStartTime: '06:50',
        defaultEndTime: '08:10',
        tasks: [
          { title: 'Brush Teeth', expectedMinutes: 3 },
          { title: 'Wake up', expectedMinutes: 4 }
        ]
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.template.tasks[0].title).toBe('Brush Teeth');

    const deleteResponse = await request(app).delete(`/api/templates/${templateId}`);
    expect(deleteResponse.status).toBe(204);
  });

  it('validates template payloads', async () => {
    const response = await request(app).post('/api/templates').send({
      name: '',
      defaultStartTime: '7:00',
      defaultEndTime: '08:00',
      tasks: []
    });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain('Template name');
  });

  it('clones template to today snapshot', async () => {
    const createResponse = await request(app).post('/api/templates').send({
      name: 'Morning',
      defaultStartTime: '07:00',
      defaultEndTime: '08:00',
      tasks: [
        { title: 'Wake up', expectedMinutes: 5 },
        { title: 'Brush Teeth', expectedMinutes: 2 }
      ]
    });

    expect(createResponse.status).toBe(201);
    const templateId = createResponse.body.template.id;

    const response = await request(app).post(`/api/templates/${templateId}/clone-to-today`);
    expect(response.status).toBe(200);
    expect(response.body.snapshot.expectedTotalMinutes).toBe(7);
    expect(response.body.snapshot.tasks[0].title).toBe('Wake up');
  });
});
