import { describe, expect, it } from 'vitest';

import {
  childCreateSchema,
  templateCreateSchema,
  templateUpdateSchema,
  timeStringSchema
} from './schemas.js';

describe('timeStringSchema', () => {
  it('accepts valid 24h times', () => {
    expect(timeStringSchema.parse('07:30')).toBe('07:30');
    expect(timeStringSchema.parse('23:59')).toBe('23:59');
  });

  it('rejects invalid times', () => {
    expect(() => timeStringSchema.parse('7:30')).toThrow();
    expect(() => timeStringSchema.parse('24:00')).toThrow();
  });
});

describe('childCreateSchema', () => {
  it('requires non-empty first name and valid birthdate', () => {
    const child = childCreateSchema.parse({
      firstName: 'Ada',
      birthdate: '2015-04-03'
    });
    expect(child.firstName).toBe('Ada');

    expect(() =>
      childCreateSchema.parse({ firstName: '', birthdate: '2015-04-03' })
    ).toThrow();
    expect(() =>
      childCreateSchema.parse({ firstName: 'Ada', birthdate: '20150403' })
    ).toThrow();
  });
});

describe('template schemas', () => {
  const baseTask = {
    title: 'Brush Teeth',
    expectedMinutes: 2
  };

  it('requires at least one task on create', () => {
    const template = templateCreateSchema.parse({
      name: 'Morning',
      defaultStartTime: '07:00',
      defaultEndTime: '08:00',
      tasks: [baseTask]
    });
    expect(template.tasks[0].orderIndex).toBe(0);

    expect(() =>
      templateCreateSchema.parse({
        name: 'Empty',
        defaultStartTime: '07:00',
        defaultEndTime: '08:00',
        tasks: []
      })
    ).toThrow();
  });

  it('preserves ids when updating and normalises order index', () => {
    const updated = templateUpdateSchema.parse({
      name: 'Morning',
      defaultStartTime: '07:00',
      defaultEndTime: '08:00',
      tasks: [
        { ...baseTask, id: 'ckid12345678901234567890' },
        { title: 'Get Dressed', expectedMinutes: 5, id: 'ckid12345678901234567891' }
      ]
    });

    expect(updated.tasks).toHaveLength(2);
    expect(updated.tasks[0]).toMatchObject({ orderIndex: 0 });
    expect(updated.tasks[1]).toMatchObject({ orderIndex: 1 });
  });

  it('rejects negative expected minutes', () => {
    expect(() =>
      templateCreateSchema.parse({
        name: 'Morning',
        defaultStartTime: '07:00',
        defaultEndTime: '08:00',
        tasks: [{ title: 'Brush Teeth', expectedMinutes: -1 }]
      })
    ).toThrow();
  });
});
