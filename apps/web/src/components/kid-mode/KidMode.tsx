import type { Child, Session } from '@shared/schemas';
import type { FC } from 'react';
import { useEffect, useMemo, useState } from 'react';

import type {
  SessionNudgeEvent,
  SessionProgressState,
  SessionTelemetry
} from '../../types/session';

const nudgeThresholdLabel: Record<SessionNudgeEvent['threshold'], string> = {
  first: '33%',
  second: '66%',
  final: '100%'
};

const formatNudgeTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });

const medalEmoji: Record<'gold' | 'silver' | 'bronze', string> = {
  gold: '🥇',
  silver: '🥈',
  bronze: '🥉'
};

const medalLabel: Record<'gold' | 'silver' | 'bronze', string> = {
  gold: 'Gold',
  silver: 'Silver',
  bronze: 'Bronze'
};

const formatSeconds = (value: number) => {
  const minutes = Math.floor(value / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (value % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
};

type KidModeProps = {
  session: Session;
  child: Child;
  progress: SessionProgressState[];
  actionPending: boolean;
  error: string | null;
  telemetry: SessionTelemetry | null;
  nudgeEvents: SessionNudgeEvent[];
  voiceEnabled: boolean;
  voicePending: boolean;
  voiceError: string | null;
  onEnableVoice: () => Promise<void>;
  onCompleteTask: (index: number) => Promise<void>;
  onSkipTask: (index: number) => Promise<void>;
  onReturnToParent: () => void;
  onEndSession: () => void;
  showDebugTelemetry: boolean;
};

export const KidMode: FC<KidModeProps> = ({
  session,
  child,
  progress,
  actionPending,
  error,
  telemetry,
  nudgeEvents,
  voiceEnabled,
  voicePending,
  voiceError,
  onEnableVoice,
  onCompleteTask,
  onSkipTask,
  onReturnToParent,
  onEndSession,
  showDebugTelemetry
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const actualDurationSeconds = useMemo(
    () =>
      session.actualStartAt && session.actualEndAt
        ? Math.max(
            0,
            Math.round((new Date(session.actualEndAt).getTime() - new Date(session.actualStartAt).getTime()) / 1000)
          )
        : null,
    [session.actualEndAt, session.actualStartAt]
  );

  const { currentTask, currentIndex, nextTask, allTasksHandled } = useMemo(() => {
    const index = session.tasks.findIndex((task) => !task.completedAt && !task.skipped);
    const nextIndex = session.tasks.findIndex((task, taskIndex) => taskIndex > index && !task.completedAt && !task.skipped);
    return {
      currentTask: index === -1 ? null : session.tasks[index],
      currentIndex: index,
      nextTask: nextIndex === -1 ? null : session.tasks[nextIndex],
      allTasksHandled: session.tasks.every((task) => task.completedAt || task.skipped)
    };
  }, [session.tasks]);

  const sessionComplete = Boolean(session.medal);
  const awaitingMedal = allTasksHandled && !sessionComplete;

  const completedCount = useMemo(
    () => progress.filter((state) => state.completed).length,
    [progress]
  );

  const totalTasks = session.tasks.length;
  const completionPercent = totalTasks === 0 ? 0 : Math.round((completedCount / totalTasks) * 100);

  const { actualStartAt, actualEndAt } = session;
  const lastNudge = nudgeEvents.length > 0 ? nudgeEvents[nudgeEvents.length - 1] : null;
  const formattedPaceDelta = telemetry ? telemetry.paceDelta.toFixed(2) : '0.00';
  const currentTelemetry = telemetry?.currentTask ?? null;
  const nextDebugTask = telemetry?.nextTask ?? null;
  const sessionEndsAt = telemetry ? new Date(telemetry.sessionEndsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';

  useEffect(() => {
    const computeElapsed = () => {
      if (!actualStartAt) {
        setElapsedSeconds(0);
        return;
      }

      const startMs = new Date(actualStartAt).getTime();
      const endMs = actualEndAt ? new Date(actualEndAt).getTime() : Date.now();
      const durationSeconds = Math.max(0, Math.round((endMs - startMs) / 1000));
      setElapsedSeconds(durationSeconds);
    };

    computeElapsed();

    if (actualStartAt && !actualEndAt) {
      const interval = window.setInterval(computeElapsed, 1000);
      return () => window.clearInterval(interval);
    }

    return () => undefined;
  }, [actualEndAt, actualStartAt]);

  return (
    <section className="rounded-3xl bg-gradient-to-br from-emerald-500/20 via-slate-900 to-slate-950 p-8 shadow-2xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-wide text-emerald-200">Kid Mode</p>
          <h2 className="mt-1 text-3xl font-semibold text-slate-100">Good luck, {child.firstName}!</h2>
          <p className="text-slate-200">Today’s mission: {session.templateSnapshot.name}</p>
        </div>
        <div className="flex flex-col items-end gap-2 text-right">
          <div className="text-sm font-semibold uppercase tracking-wide text-slate-400">Elapsed</div>
          <div className="text-3xl font-bold text-emerald-200">{formatSeconds(elapsedSeconds)}</div>
          {!session.actualStartAt && <div className="text-xs text-slate-400">Timer starts after your first task</div>}
        </div>
      </div>
      <div className="mb-6 rounded-2xl border border-emerald-400/30 bg-slate-950/70 p-4 text-sm text-emerald-100">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-semibold uppercase tracking-wide text-emerald-200">Voice feedback</p>
          {voiceEnabled ? (
            <span className="flex items-center gap-2 text-xs text-emerald-300">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" aria-hidden /> Ready
            </span>
          ) : (
            <button
              type="button"
              onClick={() => void onEnableVoice()}
              disabled={voicePending}
              className="rounded-lg bg-emerald-400 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-emerald-400/60"
            >
              {voicePending ? 'Enabling…' : 'Enable Voice 🔊'}
            </button>
          )}
        </div>
        <p className="mt-2 text-xs text-emerald-200/80">Tap once so we can cheer after every task and nudge.</p>
        {voiceError ? (
          <p className="mt-2 rounded-lg bg-rose-500/20 px-3 py-2 text-xs text-rose-100">{voiceError}</p>
        ) : null}
      </div>
      {showDebugTelemetry ? (
        <div className="mb-6 rounded-2xl border border-emerald-400/20 bg-slate-950/70 p-4 text-sm text-emerald-100">
          <p className="font-semibold">
            Urgency: L{telemetry ? telemetry.urgencyLevel : '–'} ·{' '}
            {telemetry ? `${telemetry.timeRemainingMinutes}m left` : 'calculating…'} (ends {sessionEndsAt})
          </p>
          <p className="mt-1 text-xs text-emerald-200/80">Pace Δ {formattedPaceDelta}</p>
          {currentTelemetry ? (
            <div className="mt-3 space-y-1 text-xs text-emerald-200/70">
              <p>
                Current task remaining: {Math.ceil(currentTelemetry.remainingSeconds / 60)}m ·{' '}
                {formatSeconds(currentTelemetry.remainingSeconds)}
              </p>
              <p>
                Nudges fired: {currentTelemetry.nudgesFiredCount}/{currentTelemetry.totalScheduledNudges} · Next:{' '}
                {currentTelemetry.nextNudgeThreshold ? nudgeThresholdLabel[currentTelemetry.nextNudgeThreshold] : 'none'}
              </p>
              {nextDebugTask ? (
                <p>
                  Next task hint: {nextDebugTask.hint ? nextDebugTask.hint : nextDebugTask.title}
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="mt-3 space-y-1 text-xs text-emerald-200/70">
            {nudgeEvents.length === 0 ? (
              <p>No nudges fired yet.</p>
            ) : (
              <>
                <p className="font-semibold text-emerald-200">Mid-task nudges</p>
                <ul className="space-y-1">
                  {nudgeEvents.map((event) => (
                    <li key={`${event.sessionTaskId}-${event.threshold}`}>
                      {nudgeThresholdLabel[event.threshold]} · {formatNudgeTime(event.firedAt)}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {lastNudge ? (
              <p className="pt-1 text-emerald-300">
                Last: {nudgeThresholdLabel[lastNudge.threshold]} at {formatNudgeTime(lastNudge.firedAt)}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="h-4 flex-1 rounded-full bg-slate-800">
          <div
            className="h-4 rounded-full bg-emerald-400 transition-all"
            style={{ width: `${completionPercent}%` }}
            aria-valuenow={completionPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            role="progressbar"
          />
        </div>
        <div className="text-sm font-semibold text-emerald-200">
          {completedCount} / {totalTasks} done
        </div>
      </div>
      {error && (
        <div className="mb-6 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>
      )}
      {sessionComplete ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl bg-slate-950/60 p-10 text-center shadow-inner">
          <div className="text-6xl">{session.medal ? medalEmoji[session.medal] : '🎉'}</div>
          <h3 className="text-3xl font-semibold text-emerald-200">
            {session.medal ? `You earned a ${medalLabel[session.medal]} medal!` : 'All tasks complete!'}
          </h3>
          <p className="text-slate-200">
            Total time {actualDurationSeconds !== null ? formatSeconds(actualDurationSeconds) : '--:--'} vs expected{' '}
            {Math.round(session.expectedTotalMinutes)} min.
          </p>
        </div>
      ) : awaitingMedal ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl bg-slate-950/60 p-10 text-center shadow-inner">
          <p className="text-4xl">⏳</p>
          <h3 className="text-2xl font-semibold text-slate-100">Sit tight… computing your medal!</h3>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[2fr,1fr]">
          <div className="rounded-2xl bg-slate-950/70 p-8 shadow-inner">
            <p className="text-sm uppercase tracking-wide text-emerald-300">Current Task</p>
            <h3 className="mt-2 text-4xl font-bold text-slate-50">
              {currentTask?.emoji && <span className="mr-3">{currentTask.emoji}</span>}
              {currentTask?.title}
            </h3>
            <p className="mt-3 text-lg text-slate-200">{currentTask?.hint ?? 'Tap the big button when you finish!'}</p>
            <p className="mt-4 text-sm text-slate-400">Expected {currentTask?.expectedMinutes} minute(s)</p>
            <div className="mt-8 flex flex-wrap gap-4">
              <button
                type="button"
                onClick={() => currentIndex !== -1 && void onCompleteTask(currentIndex)}
                disabled={actionPending || currentIndex === -1}
                className="flex-1 rounded-2xl bg-emerald-400 px-6 py-6 text-3xl font-bold text-slate-950 shadow-xl transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-emerald-400/50 disabled:text-slate-700"
              >
                {actionPending ? 'Working…' : 'Complete ✅'}
              </button>
              {session.allowSkip && (
                <button
                  type="button"
                  onClick={() => currentIndex !== -1 && void onSkipTask(currentIndex)}
                  disabled={actionPending || currentIndex === -1}
                  className="flex-1 rounded-2xl border-2 border-slate-500 bg-slate-900 px-6 py-6 text-2xl font-semibold text-slate-200 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500"
                >
                  Skip ⏭️
                </button>
              )}
            </div>
          </div>
          <aside className="space-y-4">
            <div className="rounded-2xl bg-slate-950/50 p-6">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">Progress</p>
              <p className="mt-2 text-3xl font-bold text-emerald-200">
                {completedCount} / {totalTasks}
              </p>
              <p className="text-sm text-slate-400">Done so far</p>
            </div>
            <div className="rounded-2xl bg-slate-950/40 p-6">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">Up next</p>
              {nextTask ? (
                <p className="mt-2 text-lg text-slate-200">
                  {nextTask.emoji && <span className="mr-2 text-xl">{nextTask.emoji}</span>}
                  {nextTask.title}
                </p>
              ) : (
                <p className="mt-2 text-lg text-slate-200">You’re almost done!</p>
              )}
            </div>
            <div className="rounded-2xl bg-slate-950/40 p-6 text-sm text-slate-400">
              <p>Stay quick to snag the Gold medal—finish near your expected time!</p>
            </div>
          </aside>
        </div>
      )}
      <div className="mt-8 flex gap-3">
        <button
          type="button"
          onClick={onReturnToParent}
          className="rounded-lg border border-slate-300/40 px-4 py-2 text-base font-semibold text-slate-100 transition hover:border-slate-200"
        >
          Parent controls
        </button>
        <button
          type="button"
          onClick={onEndSession}
          className="rounded-lg bg-rose-500 px-4 py-2 text-base font-semibold text-slate-950 transition hover:bg-rose-400"
        >
          End session
        </button>
      </div>
    </section>
  );
};
