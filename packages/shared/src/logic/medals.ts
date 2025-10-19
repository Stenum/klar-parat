import type { z } from 'zod';

import { medalSchema } from '../schemas.js';

type Medal = z.infer<typeof medalSchema>;

type MedalThresholds = {
  gold: number;
  silver: number;
};

type ComputeMedalInput = {
  expectedTotalMinutes: number;
  actualDurationMs: number;
  thresholds?: MedalThresholds;
};

export const DEFAULT_MEDAL_THRESHOLDS: MedalThresholds = {
  gold: 1.0,
  silver: 1.3
};

export const computeMedal = ({
  expectedTotalMinutes,
  actualDurationMs,
  thresholds = DEFAULT_MEDAL_THRESHOLDS
}: ComputeMedalInput): Medal => {
  const normalisedExpected = Math.max(expectedTotalMinutes, 0);
  const normalisedDurationMs = Math.max(actualDurationMs, 0);

  if (normalisedExpected === 0) {
    return 'gold';
  }

  const actualMinutes = normalisedDurationMs / 60000;
  const ratio = actualMinutes / normalisedExpected;

  if (ratio <= thresholds.gold) {
    return 'gold';
  }

  if (ratio <= thresholds.silver) {
    return 'silver';
  }

  return 'bronze';
};

export type { ComputeMedalInput, Medal, MedalThresholds };
