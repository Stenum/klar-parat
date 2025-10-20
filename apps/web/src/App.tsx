import type { Child, Session } from '@shared/schemas';
import { useCallback, useEffect, useState } from 'react';

import { ChildrenManager } from './components/children/ChildrenManager';
import { KidMode } from './components/kid-mode/KidMode';
import { getInitialNavKey, type NavKey, SidebarNav } from './components/navigation/SidebarNav';
import { TemplatesManager } from './components/templates/TemplatesManager';
import { TodayManager } from './components/today/TodayManager';
import type { SessionNudgeEvent, SessionProgressState, SessionTelemetry } from './types/session';
import { deriveSessionProgress } from './utils/sessionProgress';

const App = () => {
  const [activeNav, setActiveNav] = useState<NavKey>(getInitialNavKey());
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [activeChild, setActiveChild] = useState<Child | null>(null);
  const [showKidMode, setShowKidMode] = useState(false);
  const [sessionProgress, setSessionProgress] = useState<SessionProgressState[]>([]);
  const [sessionActionPending, setSessionActionPending] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState<SessionTelemetry | null>(null);
  const [nudgeEvents, setNudgeEvents] = useState<SessionNudgeEvent[]>([]);

  const applySessionUpdate = useCallback((session: Session | null) => {
    setActiveSession(session);
    setSessionProgress(deriveSessionProgress(session));
  }, []);

  const resetSessionState = useCallback(() => {
    applySessionUpdate(null);
    setActiveChild(null);
    setShowKidMode(false);
    setSessionError(null);
    setSessionActionPending(false);
    setTelemetry(null);
    setNudgeEvents([]);
  }, [applySessionUpdate]);

  const handleSessionStarted = useCallback(
    (session: Session, child: Child) => {
      applySessionUpdate(session);
      setActiveChild(child);
      setShowKidMode(true);
      setSessionError(null);
      setSessionActionPending(false);
      setTelemetry(null);
      setNudgeEvents([]);
    },
    [applySessionUpdate]
  );

  const handleEnterKidMode = useCallback(() => {
    setShowKidMode(true);
  }, []);

  const handleReturnToParent = useCallback(() => {
    setShowKidMode(false);
  }, []);

  useEffect(() => {
    if (!activeSession || !showKidMode) {
      return undefined;
    }

    let cancelled = false;
    let interval: number | null = null;

    const fetchTelemetry = async () => {
      try {
        const response = await fetch(`/api/sessions/${activeSession.id}/telemetry`);
        if (!response.ok) {
          throw new Error('Failed to load telemetry');
        }
        const data = (await response.json()) as { telemetry: SessionTelemetry };
        if (cancelled) {
          return;
        }
        setTelemetry(data.telemetry);
        if (data.telemetry.nudges.length > 0) {
          setNudgeEvents((current) => {
            const existing = new Set(current.map((event) => `${event.sessionTaskId}:${event.threshold}`));
            const additions = data.telemetry.nudges.filter(
              (event) => !existing.has(`${event.sessionTaskId}:${event.threshold}`)
            );
            return additions.length > 0 ? [...current, ...additions] : current;
          });
        }
      } catch (error) {
        console.error(error);
      }
    };

    void fetchTelemetry();
    interval = window.setInterval(fetchTelemetry, 5000);

    return () => {
      cancelled = true;
      if (interval !== null) {
        window.clearInterval(interval);
      }
    };
  }, [activeSession, showKidMode]);

  const finishSession = useCallback(
    async (sessionId: string) => {
      try {
        const response = await fetch(`/api/sessions/${sessionId}/finish`, {
          method: 'POST'
        });
        if (!response.ok) {
          throw new Error('Failed to finalise session');
        }
        const data = (await response.json()) as { session: Session };
        applySessionUpdate(data.session);
        setSessionError(null);
      } catch (error) {
        console.error(error);
        setSessionError('Unable to finalise the session. Please try again.');
      }
    },
    [applySessionUpdate]
  );

  const handleCompleteTask = useCallback(
    async (index: number) => {
      if (!activeSession) {
        return;
      }

      setSessionActionPending(true);
      try {
        const response = await fetch(`/api/sessions/${activeSession.id}/task/${index}/complete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ skipped: false })
        });

        if (!response.ok) {
          throw new Error('Failed to update task');
        }

        const data = (await response.json()) as { session: Session };
        applySessionUpdate(data.session);
        setSessionError(null);

        const allHandled = data.session.tasks.every((task) => task.completedAt || task.skipped);
        if (allHandled && !data.session.medal) {
          await finishSession(data.session.id);
        }
      } catch (error) {
        console.error(error);
        setSessionError('Unable to update this task. Please try again.');
      } finally {
        setSessionActionPending(false);
      }
    },
    [activeSession, applySessionUpdate, finishSession]
  );

  const handleSkipTask = useCallback(
    async (index: number) => {
      if (!activeSession) {
        return;
      }

      setSessionActionPending(true);
      try {
        const response = await fetch(`/api/sessions/${activeSession.id}/task/${index}/complete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ skipped: true })
        });

        if (!response.ok) {
          throw new Error('Failed to skip task');
        }

        const data = (await response.json()) as { session: Session };
        applySessionUpdate(data.session);
        setSessionError(null);

        const allHandled = data.session.tasks.every((task) => task.completedAt || task.skipped);
        if (allHandled && !data.session.medal) {
          await finishSession(data.session.id);
        }
      } catch (error) {
        console.error(error);
        setSessionError('Unable to skip this task. Please try again.');
      } finally {
        setSessionActionPending(false);
      }
    },
    [activeSession, applySessionUpdate, finishSession]
  );

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-50">
      <aside className="flex w-64 flex-col gap-8 border-r border-slate-800 bg-slate-900 p-6">
        <div>
          <h1 className="text-2xl font-semibold">Klar Parat</h1>
          <p className="text-sm text-slate-400">Morning routine assistant</p>
        </div>
        <SidebarNav activeKey={activeNav} onSelect={setActiveNav} />
      </aside>
      <main className="flex-1 overflow-y-auto bg-slate-900/40 p-8">
        <div className="mx-auto flex max-w-5xl flex-col gap-8">
          {activeNav === 'children' ? <ChildrenManager /> : null}
          {activeNav === 'templates' ? <TemplatesManager /> : null}
          {activeNav === 'today' && (
            activeSession && showKidMode && activeChild ? (
              <KidMode
                session={activeSession}
                child={activeChild}
                progress={sessionProgress}
                actionPending={sessionActionPending}
                error={sessionError}
                telemetry={telemetry}
                nudgeEvents={nudgeEvents}
                onCompleteTask={handleCompleteTask}
                onSkipTask={handleSkipTask}
                onReturnToParent={handleReturnToParent}
                onEndSession={resetSessionState}
              />
            ) : (
              <TodayManager
                activeSession={activeSession}
                activeChild={activeChild}
                onSessionStarted={handleSessionStarted}
                onEnterKidMode={handleEnterKidMode}
                onEndSession={resetSessionState}
              />
            )
          )}
          {activeNav === 'history' && (
            <p className="text-lg text-slate-400">History tracking is coming later.</p>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
