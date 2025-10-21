import type { Child, Session, Template } from '@shared/schemas';
import type { FC } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type {
  SessionNudgeEvent,
  SessionProgressState,
  SessionTelemetry
} from '../../types/session';
import { MultiChildBoard } from './MultiChildBoard';

type BoardSessionState = {
  session: Session;
  child: Child;
  progress: SessionProgressState[];
  telemetry: SessionTelemetry | null;
  nudgeEvents: SessionNudgeEvent[];
  pending: boolean;
  error: string | null;
};

type PlannedEntry = {
  id: string;
  child: Child;
  template: Template;
  allowSkip: boolean;
};

type TodayViewMode = 'planner' | 'board';

type TodayManagerProps = {
  sessions: BoardSessionState[];
  focusedSessionId: string | null;
  onFocusSession: (sessionId: string | null) => void;
  onSessionStarted: (session: Session, child: Child) => void;
  onSessionsBatchStarted: (entries: Array<{ session: Session; child: Child }>) => void;
  onCompleteTask: (sessionId: string, index: number) => void;
  onSkipTask: (sessionId: string, index: number) => void;
  onEnableVoice: () => Promise<void>;
  voiceEnabled: boolean;
  voiceEnabling: boolean;
  voiceError: string | null;
  showDebugTelemetry: boolean;
  mode: TodayViewMode;
  onLaunchBoard: () => void;
  onEndAllSessions: () => Promise<void>;
  endingSessions: boolean;
  endSessionsError: string | null;
};

export const TodayManager: FC<TodayManagerProps> = ({
  sessions,
  focusedSessionId,
  onFocusSession,
  onSessionStarted,
  onSessionsBatchStarted,
  onCompleteTask,
  onSkipTask,
  onEnableVoice,
  voiceEnabled,
  voiceEnabling,
  voiceError,
  showDebugTelemetry,
  mode,
  onLaunchBoard,
  onEndAllSessions,
  endingSessions,
  endSessionsError
}) => {
  const [children, setChildren] = useState<Child[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedChildId, setSelectedChildId] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [allowSkip, setAllowSkip] = useState(false);
  const [starting, setStarting] = useState(false);
  const [plannedEntries, setPlannedEntries] = useState<PlannedEntry[]>([]);

  const fetchTodayData = useCallback(async () => {
    try {
      setLoading(true);
      const [childrenResponse, templatesResponse] = await Promise.all([
        fetch('/api/children'),
        fetch('/api/templates')
      ]);

      if (!childrenResponse.ok || !templatesResponse.ok) {
        throw new Error('Failed to load today data');
      }

      const childrenData = (await childrenResponse.json()) as { children: Child[] };
      const templatesData = (await templatesResponse.json()) as { templates: Template[] };

      setChildren(childrenData.children);
      setTemplates(templatesData.templates);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Unable to load selections. Please retry.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTodayData();
  }, [fetchTodayData]);

  const handleAddToPlan = useCallback(() => {
    if (!selectedChildId || !selectedTemplateId) {
      setError('Pick a child and template, then add them to the plan.');
      return;
    }

    const child = children.find((item) => item.id === selectedChildId);
    if (!child) {
      setError('Selected child could not be found.');
      return;
    }

    const template = templates.find((item) => item.id === selectedTemplateId);
    if (!template) {
      setError('Selected template could not be found.');
      return;
    }

    if (sessions.some((entry) => entry.child.id === child.id)) {
      setError(`${child.firstName} is already on the board.`);
      return;
    }

    if (plannedEntries.some((entry) => entry.child.id === child.id)) {
      setError(`${child.firstName} is already planned.`);
      return;
    }

    const entry: PlannedEntry = {
      id: `${child.id}-${template.id}`,
      child,
      template,
      allowSkip
    };

    setPlannedEntries((prev) => [...prev, entry]);
    setSelectedChildId('');
    setSelectedTemplateId('');
    setAllowSkip(false);
    setError(null);
  }, [allowSkip, children, plannedEntries, selectedChildId, selectedTemplateId, sessions, templates]);

  const handleRemovePlannedEntry = useCallback((id: string) => {
    setPlannedEntries((prev) => prev.filter((entry) => entry.id !== id));
  }, []);

  const handleStartPlannedSessions = useCallback(async () => {
    if (plannedEntries.length === 0) {
      setError('Add at least one child to the plan.');
      return;
    }

    setStarting(true);
    setError(null);

    const startedEntries: Array<{ session: Session; child: Child }> = [];

    try {
      for (const entry of plannedEntries) {
        const response = await fetch('/api/sessions/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            childId: entry.child.id,
            templateId: entry.template.id,
            allowSkip: entry.allowSkip
          })
        });

        if (!response.ok) {
          const body = await response.json();
          throw new Error(body.error?.message ?? `Unable to start ${entry.child.firstName}'s session.`);
        }

        const data = (await response.json()) as { session: Session };
        onSessionStarted(data.session, entry.child);
        startedEntries.push({ session: data.session, child: entry.child });
      }

      if (startedEntries.length > 0) {
        onSessionsBatchStarted(startedEntries);
        onLaunchBoard();
        await onEnableVoice();
      }
      setPlannedEntries([]);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Unable to start planned sessions.');
    } finally {
      setStarting(false);
    }
  }, [onEnableVoice, onLaunchBoard, onSessionStarted, onSessionsBatchStarted, plannedEntries]);

  const activeNames = useMemo(() => sessions.map((entry) => entry.child.firstName).join(', '), [sessions]);

  if (mode === 'board') {
    return (
      <div className="flex h-full flex-col gap-6 bg-slate-950 p-6">
        <header className="flex flex-col gap-4 rounded-3xl bg-slate-900/60 p-6 shadow-lg md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-wide text-emerald-300">Kid screen</p>
            <h2 className="mt-1 text-3xl font-semibold text-slate-50">
              {activeNames ? `${activeNames} are up!` : 'Morning routine time!'}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Tap a kid to spotlight their column. Voice cheer kicks off automatically.
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-3 text-sm text-slate-200 md:items-end">
            <button
              type="button"
              onClick={() => void onEndAllSessions()}
              disabled={endingSessions}
              className="rounded-xl bg-rose-500 px-4 py-3 text-base font-semibold text-slate-950 shadow transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:bg-rose-500/60"
            >
              {endingSessions ? 'Ending…' : 'End all sessions'}
            </button>
            {!voiceEnabled && voiceEnabling ? (
              <span className="text-xs text-emerald-300">Connecting voice…</span>
            ) : null}
            {voiceEnabled ? (
              <span className="text-xs text-emerald-300">Voice ready to cheer</span>
            ) : null}
          </div>
        </header>

        {voiceError ? (
          <p className="rounded-2xl bg-rose-500/15 px-4 py-3 text-sm text-rose-100">{voiceError}</p>
        ) : null}
        {endSessionsError ? (
          <p className="rounded-2xl bg-rose-500/15 px-4 py-3 text-sm text-rose-100">{endSessionsError}</p>
        ) : null}

        <div className="flex-1 overflow-y-auto">
          <MultiChildBoard
            sessions={sessions}
            focusedSessionId={focusedSessionId}
            onFocusSession={onFocusSession}
            onCompleteTask={onCompleteTask}
            onSkipTask={onSkipTask}
            showDebugTelemetry={showDebugTelemetry}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-slate-900/80 p-6 shadow-xl">
        <header className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold">Today Session</h2>
              <p className="text-sm text-slate-400">
                Pick the kid + routine and the board will guide everyone together as soon as you tap start.
              </p>
            </div>
          {loading && <span className="text-sm text-emerald-400">Loading…</span>}
        </header>

        <div className="mb-6 rounded-xl border border-emerald-500/30 bg-slate-950/60 p-5 text-sm text-emerald-100">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-semibold uppercase tracking-wide text-emerald-200">Voice feedback</p>
            <span className="flex items-center gap-2 text-xs text-emerald-300">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" aria-hidden />
              {voiceEnabled ? 'Ready to cheer' : 'Will enable when you start'}
            </span>
          </div>
          <p className="mt-2 text-xs text-emerald-200/80">
            Voice starts automatically as soon as you launch the kid screen.
          </p>
          {voiceError ? (
            <p className="mt-2 rounded-lg bg-rose-500/20 px-3 py-2 text-xs text-rose-100">{voiceError}</p>
          ) : null}
        </div>

        {sessions.length > 0 ? (
          <div className="mb-6 rounded-xl bg-emerald-500/10 p-5 text-sm text-emerald-100">
            <p className="font-semibold text-emerald-200">Board running</p>
            <p>
              {activeNames ? `${activeNames} are active.` : 'Sessions in progress.'} Tap a column focus button to spotlight a kid.
            </p>
          </div>
        ) : null}

        {error && <p className="mb-4 rounded-lg bg-rose-500/20 p-3 text-rose-200">{error}</p>}

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-5 rounded-xl bg-slate-950/40 p-5">
            <div>
              <h3 className="text-xl font-semibold">Step 1 · Build the plan</h3>
              <p className="mt-1 text-sm text-slate-400">
                Pick every kid and their routine before you kick things off. You can reuse the same template for multiple kids.
              </p>
            </div>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-200">Child</span>
              <select
                value={selectedChildId}
                onChange={(event) => setSelectedChildId(event.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-base text-slate-50 focus:border-emerald-400 focus:outline-none"
              >
                <option value="">Select a child</option>
                {children.map((child) => (
                  <option key={child.id} value={child.id}>
                    {child.firstName}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-200">Routine template</span>
              <select
                value={selectedTemplateId}
                onChange={(event) => setSelectedTemplateId(event.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-base text-slate-50 focus:border-emerald-400 focus:outline-none"
              >
                <option value="">Select a template</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-3 text-base">
              <input
                type="checkbox"
                checked={allowSkip}
                onChange={(event) => setAllowSkip(event.target.checked)}
                className="h-5 w-5 rounded border-slate-600 bg-slate-800 text-emerald-400 focus:ring-emerald-300"
              />
              <span className="text-slate-200">Allow skipping tasks</span>
            </label>
            <button
              type="button"
              onClick={handleAddToPlan}
              disabled={starting || !children.length || !templates.length}
              className="rounded-lg bg-emerald-500 px-4 py-3 text-lg font-semibold text-slate-900 shadow transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-500/40"
            >
              Add to plan
            </button>
            {plannedEntries.length > 0 ? (
              <ul className="space-y-3">
                {plannedEntries.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-slate-200"
                  >
                    <div>
                      <p className="text-base font-semibold text-slate-100">{entry.child.firstName}</p>
                      <p className="text-xs text-slate-400">{entry.template.name}</p>
                      {entry.allowSkip ? (
                        <p className="mt-1 text-xs text-emerald-300">Skip allowed</p>
                      ) : (
                        <p className="mt-1 text-xs text-slate-500">Skip disabled</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemovePlannedEntry(entry.id)}
                      className="rounded-lg border border-slate-600 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:border-rose-400 hover:text-rose-200"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-lg border border-dashed border-slate-700 bg-slate-950/40 p-4 text-sm text-slate-400">
                Your plan is empty. Add each kid you want on the board before starting.
              </p>
            )}
          </div>
          <div className="space-y-4 rounded-xl border border-dashed border-slate-700 bg-slate-950/20 p-5 text-sm text-slate-300">
            <div>
              <h3 className="text-base font-semibold text-slate-100">Step 2 · Launch the board</h3>
              <p className="mt-1 text-slate-400">
                When you hit start, the board switches to the kid-facing view and introduces everyone together.
              </p>
            </div>
            <button
              type="button"
              onClick={handleStartPlannedSessions}
              disabled={starting || plannedEntries.length === 0}
              className="w-full rounded-lg bg-emerald-400 px-4 py-3 text-lg font-semibold text-slate-900 shadow transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-emerald-400/40"
            >
              {starting ? 'Starting…' : `Start ${plannedEntries.length || ''} ${plannedEntries.length === 1 ? 'session' : 'sessions'}`.trim()}
            </button>
            <p>Progress sticks even if you refresh—the board keeps medals and timing live.</p>
            <p>Tap a child chip above the board to highlight their column during the morning rush.</p>
          </div>
        </div>
      </section>
    </div>
  );
};
