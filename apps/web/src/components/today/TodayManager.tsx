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

type TodayManagerProps = {
  sessions: BoardSessionState[];
  focusedSessionId: string | null;
  onFocusSession: (sessionId: string | null) => void;
  onSessionStarted: (session: Session, child: Child) => void;
  onCompleteTask: (sessionId: string, index: number) => void;
  onSkipTask: (sessionId: string, index: number) => void;
  onEnableVoice: () => Promise<void>;
  voiceEnabled: boolean;
  voiceEnabling: boolean;
  voiceError: string | null;
  showDebugTelemetry: boolean;
};

export const TodayManager: FC<TodayManagerProps> = ({
  sessions,
  focusedSessionId,
  onFocusSession,
  onSessionStarted,
  onCompleteTask,
  onSkipTask,
  onEnableVoice,
  voiceEnabled,
  voiceEnabling,
  voiceError,
  showDebugTelemetry
}) => {
  const [children, setChildren] = useState<Child[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedChildId, setSelectedChildId] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [allowSkip, setAllowSkip] = useState(false);
  const [starting, setStarting] = useState(false);

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

  const handleStartSession = useCallback(async () => {
    if (!selectedChildId || !selectedTemplateId) {
      setError('Pick a child and template to start.');
      return;
    }

    const child = children.find((item) => item.id === selectedChildId);
    if (!child) {
      setError('Selected child could not be found.');
      return;
    }

    try {
      setStarting(true);
      const response = await fetch('/api/sessions/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          childId: selectedChildId,
          templateId: selectedTemplateId,
          allowSkip
        })
      });

      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error?.message ?? 'Unable to start session');
      }

      const data = (await response.json()) as { session: Session };
      onSessionStarted(data.session, child);
      setSelectedTemplateId('');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Unable to start session.');
    } finally {
      setStarting(false);
    }
  }, [allowSkip, children, onSessionStarted, selectedChildId, selectedTemplateId]);

  const activeNames = useMemo(
    () => sessions.map((entry) => entry.child.firstName).join(', '),
    [sessions]
  );

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-slate-900/80 p-6 shadow-xl">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Today Session</h2>
            <p className="text-sm text-slate-400">
              Pick the kid + routine, enable voice once, and the board will guide everyone together.
            </p>
          </div>
          {loading && <span className="text-sm text-emerald-400">Loading…</span>}
        </header>

        <div className="mb-6 rounded-xl border border-emerald-500/30 bg-slate-950/60 p-5 text-sm text-emerald-100">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-semibold uppercase tracking-wide text-emerald-200">Voice feedback</p>
            {voiceEnabled ? (
              <span className="flex items-center gap-2 text-xs text-emerald-300">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" aria-hidden /> Ready to cheer
              </span>
            ) : (
              <button
                type="button"
                onClick={() => void onEnableVoice()}
                disabled={voiceEnabling}
                className="rounded-lg bg-emerald-400 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-emerald-400/60"
              >
                {voiceEnabling ? 'Enabling…' : 'Enable Voice 🔊'}
              </button>
            )}
          </div>
          <p className="mt-2 text-xs text-emerald-200/80">Enable once on the parent view so every column can speak.</p>
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
          <div className="flex flex-col gap-4 rounded-xl bg-slate-950/40 p-5">
            <h3 className="text-xl font-semibold">Who is playing today?</h3>
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
              onClick={handleStartSession}
              disabled={starting || !children.length || !templates.length}
              className="rounded-lg bg-emerald-500 px-4 py-3 text-lg font-semibold text-slate-900 shadow transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-500/40"
            >
              {starting ? 'Starting…' : 'Start Session'}
            </button>
            {(!children.length || !templates.length) && (
              <p className="text-sm text-slate-400">Add at least one child and template first to enable the board.</p>
            )}
          </div>
          <div className="space-y-3 rounded-xl border border-dashed border-slate-700 bg-slate-950/20 p-5 text-sm text-slate-300">
            <p className="text-base font-semibold text-slate-100">What happens next?</p>
            <p>The board shows every kid at once with independent timers, urgency, and voice.</p>
            <p>Progress sticks even if you refresh—the board keeps medals and timing live.</p>
            <p>Tap a child chip above the board to highlight their column during the morning rush.</p>
          </div>
        </div>
      </section>

      <MultiChildBoard
        sessions={sessions}
        focusedSessionId={focusedSessionId}
        onFocusSession={onFocusSession}
        onCompleteTask={onCompleteTask}
        onSkipTask={onSkipTask}
        showDebugTelemetry={showDebugTelemetry}
      />
    </div>
  );
};
