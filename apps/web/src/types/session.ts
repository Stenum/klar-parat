export type SessionProgressState = {
  completed: boolean;
  skipped: boolean;
};

export type SessionNudgeEvent = {
  sessionTaskId: string;
  threshold: 'first' | 'second' | 'final';
  firedAt: string;
};

export type SessionTelemetry = {
  urgencyLevel: number;
  timeRemainingMinutes: number;
  paceDelta: number;
  nudges: SessionNudgeEvent[];
};
