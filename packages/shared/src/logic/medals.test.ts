import { describe, expect, it } from 'vitest';

import { computeMedal, DEFAULT_MEDAL_THRESHOLDS } from './medals.js';

describe('computeMedal', () => {
  it('returns gold when actual duration is within the gold ratio', () => {
    const medal = computeMedal({ expectedTotalMinutes: 10, actualDurationMs: 10 * 60000 });
    expect(medal).toBe('gold');
  });

  it('returns silver when above gold but within silver threshold', () => {
    const medal = computeMedal({ expectedTotalMinutes: 10, actualDurationMs: 12 * 60000 });
    expect(medal).toBe('silver');
  });

  it('returns bronze when above silver threshold', () => {
    const medal = computeMedal({ expectedTotalMinutes: 10, actualDurationMs: 20 * 60000 });
    expect(medal).toBe('bronze');
  });

  it('treats zero expected time as automatic gold', () => {
    const medal = computeMedal({ expectedTotalMinutes: 0, actualDurationMs: 1000 });
    expect(medal).toBe('gold');
  });

  it('supports custom thresholds', () => {
    const medal = computeMedal({
      expectedTotalMinutes: 10,
      actualDurationMs: 12 * 60000,
      thresholds: { gold: 0.9, silver: 1.1 }
    });
    expect(medal).toBe('bronze');
  });

  it('guards against negative durations', () => {
    const medal = computeMedal({ expectedTotalMinutes: 10, actualDurationMs: -5 * 60000 });
    expect(medal).toBe('gold');
  });

  it('exposes default thresholds', () => {
    expect(DEFAULT_MEDAL_THRESHOLDS).toMatchObject({ gold: 1.0, silver: 1.3 });
  });
});
