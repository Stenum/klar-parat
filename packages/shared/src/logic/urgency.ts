export type UrgencyThresholds = {
  readonly aheadBoundary: number;
  readonly onTrackBoundary: number;
  readonly warningBoundary: number;
};

export type UrgencyComputationInput = {
  plannedStartAt: Date;
  plannedEndAt: Date;
  expectedTotalMinutes: number;
  completedExpectedMinutes: number;
  now: Date;
  thresholds?: UrgencyThresholds;
};

export type UrgencyComputationResult = {
  urgencyLevel: 0 | 1 | 2 | 3;
  timeRemainingMinutes: number;
  paceDelta: number;
};

const DEFAULT_THRESHOLDS: UrgencyThresholds = {
  aheadBoundary: -0.15,
  onTrackBoundary: 0.1,
  warningBoundary: 0.3
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const computeProgressRatio = (completedExpectedMinutes: number, expectedTotalMinutes: number) => {
  if (expectedTotalMinutes <= 0) {
    return 1;
  }

  return clamp(completedExpectedMinutes / expectedTotalMinutes, 0, 1);
};

const computeElapsedRatio = (now: Date, plannedStartAt: Date, plannedEndAt: Date) => {
  const totalWindowMs = plannedEndAt.getTime() - plannedStartAt.getTime();
  if (totalWindowMs <= 0) {
    return 1;
  }

  const elapsedMs = now.getTime() - plannedStartAt.getTime();
  return clamp(elapsedMs / totalWindowMs, 0, 2);
};

const mapPaceDeltaToUrgency = (paceDelta: number, thresholds: UrgencyThresholds): 0 | 1 | 2 | 3 => {
  if (paceDelta <= thresholds.aheadBoundary) {
    return 0;
  }

  if (paceDelta <= thresholds.onTrackBoundary) {
    return 1;
  }

  if (paceDelta <= thresholds.warningBoundary) {
    return 2;
  }

  return 3;
};

export const computeUrgency = ({
  plannedStartAt,
  plannedEndAt,
  expectedTotalMinutes,
  completedExpectedMinutes,
  now,
  thresholds = DEFAULT_THRESHOLDS
}: UrgencyComputationInput): UrgencyComputationResult => {
  const progressRatio = computeProgressRatio(completedExpectedMinutes, expectedTotalMinutes);
  const elapsedRatio = computeElapsedRatio(now, plannedStartAt, plannedEndAt);
  const paceDelta = elapsedRatio - progressRatio;

  const timeRemainingMs = plannedEndAt.getTime() - now.getTime();
  const timeRemainingMinutes = Math.max(0, Math.ceil(timeRemainingMs / 60000));

  return {
    urgencyLevel: mapPaceDeltaToUrgency(paceDelta, thresholds),
    timeRemainingMinutes,
    paceDelta
  };
};

export const getDefaultUrgencyThresholds = (): UrgencyThresholds => DEFAULT_THRESHOLDS;
