import type { Child, Session, Template } from '@shared/schemas';
import type { FC } from 'react';
import { useCallback, useEffect, useState } from 'react';

type TodayManagerProps = {
  activeSession: Session | null;
  activeChild: Child | null;
  onSessionStarted: (session: Session, child: Child) => void;
  onEnterKidMode: () => void;
  onEndSession: () => void;
};

export const TodayManager: FC<TodayManagerProps> = ({
  activeSession,
  activeChild,
  onSessionStarted,
  onEnterKidMode,
  onEndSession
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
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Unable to start session.');
    } finally {
      setStarting(false);
    }
  }, [allowSkip, children, onSessionStarted, selectedChildId, selectedTemplateId]);

  return (
    <section className="rounded-2xl bg-slate-900/80 p-6 shadow-xl">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Today Session</h2>
          <p className="text-sm text-slate-400">Pick the kid + routine, then hand over to Kid Mode.</p>
        </div>
        {loading && <span className="text-sm text-emerald-400">Loading…</span>}
      </header>
      {error && <p className="mb-4 rounded-lg bg-rose-500/20 p-3 text-rose-200">{error}</p>}
      {activeSession && activeChild ? (
        <div className="flex flex-col gap-4 rounded-xl bg-emerald-500/10 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-semibold text-emerald-200">Session in progress</h3>
              <p className="text-slate-200">
                {activeChild.firstName} is working on <span className="font-semibold">{activeSession.templateSnapshot.name}</span>.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onEnterKidMode}
                className="rounded-lg bg-emerald-500 px-4 py-2 text-base font-semibold text-slate-900 shadow hover:bg-emerald-400"
              >
                Open Kid Mode
              </button>
              <button
                type="button"
                onClick={onEndSession}
                className="rounded-lg border border-rose-300 px-4 py-2 text-base font-semibold text-rose-200 hover:bg-rose-400/10"
              >
                End Session
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-emerald-200">
            <span>{activeSession.tasks.length} tasks</span>
            <span>
              Starts {new Date(activeSession.plannedStartAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            {activeSession.allowSkip && <span>Skipping allowed</span>}
          </div>
        </div>
      ) : (
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
              <p className="text-sm text-slate-400">Add at least one child and template first to enable Kid Mode.</p>
            )}
          </div>
          <div className="space-y-3 rounded-xl border border-dashed border-slate-700 bg-slate-950/20 p-5 text-sm text-slate-300">
            <p className="text-base font-semibold text-slate-100">What happens next?</p>
            <p>Kid Mode will show one task at a time with a giant Complete button.</p>
            <p>Progress sticks even if you refresh—Kid Mode now tracks time and medals automatically.</p>
          </div>
        </div>
      )}
    </section>
  );
};
