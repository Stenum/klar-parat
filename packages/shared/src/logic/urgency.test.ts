import { describe, expect, it } from 'vitest';

import { computeUrgency, getDefaultUrgencyThresholds } from './urgency.js';

describe('computeUrgency', () => {
  it('returns level 0 when significantly ahead of pace', () => {
    const plannedStart = new Date('2025-01-01T07:00:00.000Z');
    const plannedEnd = new Date('2025-01-01T08:00:00.000Z');

    const result = computeUrgency({
      plannedStartAt: plannedStart,
      plannedEndAt: plannedEnd,
      expectedTotalMinutes: 30,
      completedExpectedMinutes: 20,
      now: new Date('2025-01-01T07:10:00.000Z')
    });

    expect(result.urgencyLevel).toBe(0);
    expect(result.timeRemainingMinutes).toBe(50);
    expect(result.paceDelta).toBeLessThan(0);
  });

  it('returns level 3 when heavily behind', () => {
    const plannedStart = new Date('2025-01-01T07:00:00.000Z');
    const plannedEnd = new Date('2025-01-01T08:00:00.000Z');

    const result = computeUrgency({
      plannedStartAt: plannedStart,
      plannedEndAt: plannedEnd,
      expectedTotalMinutes: 30,
      completedExpectedMinutes: 5,
      now: new Date('2025-01-01T07:50:00.000Z')
    });

    expect(result.urgencyLevel).toBe(3);
    expect(result.timeRemainingMinutes).toBe(10);
    expect(result.paceDelta).toBeGreaterThan(0);
  });

  it('caps ratios for zero durations', () => {
    const now = new Date('2025-01-01T07:00:00.000Z');

    const result = computeUrgency({
      plannedStartAt: now,
      plannedEndAt: now,
      expectedTotalMinutes: 0,
      completedExpectedMinutes: 0,
      now
    });

    expect(result.urgencyLevel).toBe(1);
    expect(result.timeRemainingMinutes).toBe(0);
    expect(result.paceDelta).toBe(0);
  });

  it('supports custom thresholds', () => {
    const plannedStart = new Date('2025-01-01T07:00:00.000Z');
    const plannedEnd = new Date('2025-01-01T08:00:00.000Z');

    const result = computeUrgency({
      plannedStartAt: plannedStart,
      plannedEndAt: plannedEnd,
      expectedTotalMinutes: 60,
      completedExpectedMinutes: 10,
      now: new Date('2025-01-01T07:45:00.000Z'),
      thresholds: {
        aheadBoundary: -0.5,
        onTrackBoundary: 0,
        warningBoundary: 0.1
      }
    });

    expect(result.urgencyLevel).toBe(3);
  });

  it('exposes default thresholds for reference', () => {
    expect(getDefaultUrgencyThresholds()).toMatchInlineSnapshot(`
      {
        "aheadBoundary": -0.15,
        "onTrackBoundary": 0.1,
        "warningBoundary": 0.3,
      }
    `);
  });
});
