export type SessionProgressState = {
  completed: boolean;
  skipped: boolean;
};

export type SessionNudgeEvent = {
  sessionTaskId: string;
  threshold: 'first' | 'second' | 'final';
  firedAt: string;
};

export type SessionActiveTaskTelemetry = {
  sessionTaskId: string;
  title: string;
  hint?: string;
  expectedMinutes: number;
  startedAt: string;
  elapsedSeconds: number;
  remainingSeconds: number;
  nudgesFiredCount: number;
  totalScheduledNudges: number;
  nextNudgeThreshold: 'first' | 'second' | 'final' | null;
  lastNudgeFiredAt: string | null;
};

export type SessionTelemetry = {
  urgencyLevel: number;
  timeRemainingMinutes: number;
  paceDelta: number;
  sessionEndsAt: string;
  nudges: SessionNudgeEvent[];
  currentTask: SessionActiveTaskTelemetry | null;
  nextTask: {
    title: string;
    hint?: string | null;
  } | null;
};
