import type { Child, Session } from '@shared/schemas';
import type { FC } from 'react';
import { useEffect, useMemo, useState } from 'react';

import type {
  SessionNudgeEvent,
  SessionProgressState,
  SessionTelemetry
} from '../../types/session';

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

type BoardSessionState = {
  session: Session;
  child: Child;
  progress: SessionProgressState[];
  telemetry: SessionTelemetry | null;
  nudgeEvents: SessionNudgeEvent[];
  pending: boolean;
  error: string | null;
};

type BoardColumnProps = {
  entry: BoardSessionState;
  isFocused: boolean;
  isDimmed: boolean;
  onCompleteTask: (index: number) => void;
  onSkipTask: (index: number) => void;
  showDebugTelemetry: boolean;
};

const BoardColumn: FC<BoardColumnProps> = ({
  entry,
  isFocused,
  isDimmed,
  onCompleteTask,
  onSkipTask,
  showDebugTelemetry
}) => {
  const { session, child, progress, telemetry, nudgeEvents, pending, error } = entry;
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const computeElapsed = () => {
      if (!session.actualStartAt) {
        setElapsedSeconds(0);
        return;
      }

      const startMs = new Date(session.actualStartAt).getTime();
      const endMs = session.actualEndAt ? new Date(session.actualEndAt).getTime() : Date.now();
      const durationSeconds = Math.max(0, Math.round((endMs - startMs) / 1000));
      setElapsedSeconds(durationSeconds);
    };

    computeElapsed();

    if (session.actualStartAt && !session.actualEndAt) {
      const interval = window.setInterval(computeElapsed, 1000);
      return () => window.clearInterval(interval);
    }

    return () => undefined;
  }, [session.actualEndAt, session.actualStartAt]);

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

  const completedCount = useMemo(
    () => progress.filter((state) => state.completed).length,
    [progress]
  );

  const totalTasks = session.tasks.length;
  const completionPercent = totalTasks === 0 ? 0 : Math.round((completedCount / totalTasks) * 100);
  const sessionComplete = Boolean(session.medal);
  const awaitingMedal = allTasksHandled && !sessionComplete;

  const columnClasses = [
    'rounded-3xl border border-slate-800 bg-slate-950/60 p-6 shadow-xl transition',
    isFocused ? 'ring-4 ring-emerald-400' : '',
    isDimmed ? 'opacity-60' : ''
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section className={columnClasses}>
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-wide text-emerald-300">{session.templateSnapshot.name}</p>
          <h3 className="mt-1 text-3xl font-semibold text-slate-50">{child.firstName}</h3>
          <p className="text-sm text-slate-400">
            {session.tasks.length} task{session.tasks.length === 1 ? '' : 's'} · Elapsed {formatSeconds(elapsedSeconds)}
          </p>
        </div>
        <div className="flex flex-col items-end text-right text-sm text-slate-300">
          <span className="font-semibold uppercase tracking-wide text-slate-400">Urgency</span>
          <span className="text-xl font-bold text-emerald-200">
            {telemetry ? `L${telemetry.urgencyLevel}` : '–'}
          </span>
          <span className="text-xs text-slate-500">
            {telemetry ? `${telemetry.timeRemainingMinutes}m left` : 'calculating…'}
          </span>
        </div>
      </header>

      <div className="mt-4 flex items-center gap-3">
        <div className="h-3 flex-1 rounded-full bg-slate-800" aria-hidden>
          <div
            className="h-3 rounded-full bg-emerald-400 transition-all"
            style={{ width: `${completionPercent}%` }}
          />
        </div>
        <div className="text-sm font-semibold text-emerald-200">
          {completedCount} / {totalTasks}
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-lg border border-rose-500/40 bg-rose-500/15 px-3 py-2 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {sessionComplete ? (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl bg-emerald-500/10 p-6 text-center">
          <span className="text-5xl">{session.medal ? medalEmoji[session.medal] : '🎉'}</span>
          <p className="text-lg font-semibold text-emerald-200">
            {session.medal ? `${medalLabel[session.medal]} medal earned` : 'Session complete!'}
          </p>
        </div>
      ) : awaitingMedal ? (
        <div className="mt-6 rounded-2xl bg-slate-900/70 p-5 text-center text-slate-200">
          Computing medal… hang tight!
        </div>
      ) : (
        <div className="mt-6">
          <h4 className="text-sm uppercase tracking-wide text-emerald-300">Current task</h4>
          <div className="mt-2 rounded-2xl bg-slate-950/70 p-5">
            <p className="text-2xl font-semibold text-slate-50">
              {currentTask?.emoji && <span className="mr-2 text-3xl">{currentTask.emoji}</span>}
              {currentTask?.title ?? 'All done!'}
            </p>
            <p className="mt-2 text-base text-slate-300">
              {currentTask?.hint ?? 'Tap complete when you finish.'}
            </p>
            <p className="mt-3 text-xs text-slate-500">
              Expected {currentTask ? Math.round(currentTask.expectedMinutes) : 0} minute(s)
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => currentIndex !== -1 && onCompleteTask(currentIndex)}
                disabled={pending || currentIndex === -1}
                className="flex-1 rounded-2xl bg-emerald-400 px-4 py-3 text-xl font-semibold text-slate-950 shadow-lg transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-emerald-400/50 disabled:text-slate-700"
              >
                {pending ? 'Working…' : 'Complete ✅'}
              </button>
              {session.allowSkip ? (
                <button
                  type="button"
                  onClick={() => currentIndex !== -1 && onSkipTask(currentIndex)}
                  disabled={pending || currentIndex === -1}
                  className="flex-1 rounded-2xl border-2 border-slate-500 bg-slate-900 px-4 py-3 text-lg font-semibold text-slate-100 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500"
                >
                  Skip ⏭️
                </button>
              ) : null}
            </div>
          </div>
          <div className="mt-4 rounded-2xl bg-slate-950/40 p-4">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">Up next</p>
            <p className="mt-2 text-lg text-slate-200">
              {nextTask ? (
                <>
                  {nextTask.emoji && <span className="mr-2 text-xl">{nextTask.emoji}</span>}
                  {nextTask.title}
                </>
              ) : (
                'You are almost finished!'
              )}
            </p>
          </div>
        </div>
      )}

      {showDebugTelemetry ? (
        <div className="mt-6 space-y-2 rounded-2xl border border-emerald-400/30 bg-slate-950/60 p-4 text-xs text-emerald-100">
          <p>
            Pace Δ {telemetry ? telemetry.paceDelta.toFixed(2) : '0.00'} ·
            {' '}
            {telemetry ? `${telemetry.timeRemainingMinutes}m remaining` : 'estimating…'}
          </p>
          <p>Last nudge: {nudgeEvents.length > 0 ? nudgeEvents[nudgeEvents.length - 1].threshold : 'none'}</p>
          <p>
            Current task ID: {telemetry?.currentTask?.sessionTaskId ?? '–'} · Next nudge:
            {' '}
            {telemetry?.currentTask?.nextNudgeThreshold ?? 'none'}
          </p>
        </div>
      ) : null}
    </section>
  );
};

type MultiChildBoardProps = {
  sessions: BoardSessionState[];
  focusedSessionId: string | null;
  onFocusSession: (sessionId: string | null) => void;
  onCompleteTask: (sessionId: string, index: number) => void;
  onSkipTask: (sessionId: string, index: number) => void;
  showDebugTelemetry: boolean;
};

export const MultiChildBoard: FC<MultiChildBoardProps> = ({
  sessions,
  focusedSessionId,
  onFocusSession,
  onCompleteTask,
  onSkipTask,
  showDebugTelemetry
}) => {
  if (sessions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/40 p-6 text-center text-sm text-slate-300">
        Start a session to populate the board.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Focus</span>
        <button
          type="button"
          onClick={() => onFocusSession(null)}
          className={`rounded-full px-3 py-1 text-sm font-medium transition ${
            focusedSessionId === null
              ? 'bg-emerald-500 text-slate-950'
              : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
          }`}
        >
          All kids
        </button>
        {sessions.map((entry) => (
          <button
            key={entry.session.id}
            type="button"
            onClick={() => onFocusSession(entry.session.id)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition ${
              focusedSessionId === entry.session.id
                ? 'bg-emerald-500 text-slate-950'
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
          >
            {entry.child.firstName}
          </button>
        ))}
      </div>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {sessions.map((entry) => (
          <BoardColumn
            key={entry.session.id}
            entry={entry}
            isFocused={focusedSessionId === entry.session.id}
            isDimmed={focusedSessionId !== null && focusedSessionId !== entry.session.id}
            onCompleteTask={(index) => onCompleteTask(entry.session.id, index)}
            onSkipTask={(index) => onSkipTask(entry.session.id, index)}
            showDebugTelemetry={showDebugTelemetry}
          />
        ))}
      </div>
    </div>
  );
};
