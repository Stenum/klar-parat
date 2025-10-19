import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import { resetDatabase } from '../test/utils.js';

describe.sequential('children routes', () => {
  const app = createApp();

  beforeEach(async () => {
    await resetDatabase();
  });

  it('creates and lists children', async () => {
    const createResponse = await request(app).post('/api/children').send({
      firstName: 'Ada',
      birthdate: '2015-04-03'
    });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.child.firstName).toBe('Ada');

    const listResponse = await request(app).get('/api/children');
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.children).toHaveLength(1);
    expect(listResponse.body.children[0]).toMatchObject({
      firstName: 'Ada',
      birthdate: '2015-04-03'
    });
  });

  it('validates child payloads', async () => {
    const response = await request(app).post('/api/children').send({
      firstName: '',
      birthdate: '20150403'
    });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain('First name');
  });

  it('updates and deletes a child', async () => {
    const createResponse = await request(app).post('/api/children').send({
      firstName: 'Ada',
      birthdate: '2015-04-03'
    });

    expect(createResponse.status).toBe(201);
    const childId = createResponse.body.child.id;

    const updateResponse = await request(app)
      .put(`/api/children/${childId}`)
      .send({ active: false });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.child.active).toBe(false);

    const deleteResponse = await request(app).delete(`/api/children/${childId}`);
    expect(deleteResponse.status).toBe(204);
  });
});
