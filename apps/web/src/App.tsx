import type { Child, Session } from '@shared/schemas';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ChildrenManager } from './components/children/ChildrenManager';
import { getInitialNavKey, type NavKey, SidebarNav } from './components/navigation/SidebarNav';
import { TemplatesManager } from './components/templates/TemplatesManager';
import { TodayManager } from './components/today/TodayManager';
import type {
  SessionNudgeEvent,
  SessionProgressState,
  SessionTelemetry
} from './types/session';
import { deriveSessionProgress } from './utils/sessionProgress';
import { useVoicePlayer } from './utils/voice';

type VoiceRequest =
  | {
      type: 'session_start';
      sessionId: string;
      sessionTaskId: string;
      language: string;
    }
  | {
      type: 'completion';
      sessionId: string;
      sessionTaskId: string;
      language: string;
    }
  | {
      type: 'nudge';
      sessionId: string;
      sessionTaskId: string;
      nudgeThreshold: 'first' | 'second' | 'final';
      language: string;
    }
  | {
      type: 'custom';
      language: string;
      text: string;
    };

type SessionUIState = {
  session: Session;
  child: Child;
  progress: SessionProgressState[];
  pending: boolean;
  error: string | null;
  telemetry: SessionTelemetry | null;
  nudgeEvents: SessionNudgeEvent[];
};

const VOICE_LANGUAGE = 'en-US';
const VOICE_ID = 'kiddo';

type TodayViewMode = 'planner' | 'board';

const formatList = (values: string[]): string => {
  if (values.length === 0) {
    return '';
  }
  if (values.length === 1) {
    return values[0];
  }
  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`;
  }
  return `${values.slice(0, -1).join(', ')}, and ${values[values.length - 1]}`;
};

const describeTask = (task: Session['tasks'][number] | undefined): string => {
  if (!task) {
    return 'your first task';
  }
  const emoji = task.emoji ? `${task.emoji} ` : '';
  return `${emoji}${task.title}`;
};

const buildBoardIntroduction = (entries: Array<{ session: Session; child: Child }>): string => {
  if (entries.length === 0) {
    return '';
  }

  const names = formatList(entries.map((entry) => entry.child.firstName));
  const routines = formatList(
    Array.from(new Set(entries.map((entry) => entry.session.templateSnapshot.name)))
  );
  const taskSentences = entries
    .map((entry) => {
      const firstTask = entry.session.tasks.find((task) => !task.completedAt && !task.skipped);
      return `${entry.child.firstName}, start with ${describeTask(firstTask ?? entry.session.tasks[0])}.`;
    })
    .join(' ');

  return `Hej ${names}! Today we're tackling ${routines}. ${taskSentences} You've got this!`;
};

const App = () => {
  const [activeNav, setActiveNav] = useState<NavKey>(getInitialNavKey());
  const [sessions, setSessions] = useState<Record<string, SessionUIState>>({});
  const [focusedSessionId, setFocusedSessionId] = useState<string | null>(null);
  const [todayMode, setTodayMode] = useState<TodayViewMode>('planner');
  const [debugMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return new URLSearchParams(window.location.search).get('debug') === '1';
  });
  const sessionStateRef = useRef<Record<string, SessionUIState>>({});
  const voiceQueueRef = useRef<VoiceRequest[]>([]);
  const voiceProcessingRef = useRef(false);
  const processedNudgeKeysRef = useRef<Map<string, Set<string>>>(new Map());
  const boardIntroDeliveredRef = useRef(false);
  const {
    enabled: voiceEnabled,
    enabling: voiceEnabling,
    enable: enableVoice,
    play: playVoice,
    error: voiceError,
    setError: setVoiceError
  } = useVoicePlayer();
  const [endingSessions, setEndingSessions] = useState(false);
  const [endSessionsError, setEndSessionsError] = useState<string | null>(null);

  const sessionList = useMemo(() => Object.values(sessions), [sessions]);
  const sessionIds = useMemo(() => Object.keys(sessions), [sessions]);
  const sessionIdsKey = useMemo(() => sessionIds.join('|'), [sessionIds]);

  useEffect(() => {
    sessionStateRef.current = sessions;
  }, [sessions]);

  const ensureProcessedSet = useCallback((sessionId: string) => {
    let set = processedNudgeKeysRef.current.get(sessionId);
    if (!set) {
      set = new Set();
      processedNudgeKeysRef.current.set(sessionId, set);
    }
    return set;
  }, []);

  const requestSpeechAudio = useCallback(
    async (request: VoiceRequest) => {
      if (request.type === 'custom') {
        const ttsResponse = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: request.text,
            language: request.language,
            voice: VOICE_ID
          })
        });

        const ttsPayload = (await ttsResponse.json()) as {
          audioUrl?: string;
          error?: { message?: string };
        };

        if (!ttsResponse.ok || !ttsPayload.audioUrl) {
          throw new Error(ttsPayload.error?.message ?? 'Unable to create voice audio.');
        }

        return ttsPayload.audioUrl;
      }

      const llmResponse = await fetch(`/api/sessions/${request.sessionId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: request.type,
          sessionTaskId: request.sessionTaskId,
          language: request.language,
          nudgeThreshold: request.type === 'nudge' ? request.nudgeThreshold : undefined
        })
      });

      const llmPayload = (await llmResponse.json()) as {
        text?: string;
        error?: { message?: string };
      };

      if (!llmResponse.ok || !llmPayload.text) {
        throw new Error(llmPayload.error?.message ?? 'Unable to generate encouragement text.');
      }

      const ttsResponse = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: llmPayload.text,
          language: request.language,
          voice: VOICE_ID
        })
      });

      const ttsPayload = (await ttsResponse.json()) as {
        audioUrl?: string;
        error?: { message?: string };
      };

      if (!ttsResponse.ok || !ttsPayload.audioUrl) {
        throw new Error(ttsPayload.error?.message ?? 'Unable to create voice audio.');
      }

      return ttsPayload.audioUrl;
    },
    []
  );

  const processVoiceQueue = useCallback(async () => {
    if (!voiceEnabled) {
      return;
    }

    if (voiceProcessingRef.current || voiceQueueRef.current.length === 0) {
      return;
    }

    voiceProcessingRef.current = true;
    let encounteredError = false;

    try {
      while (voiceEnabled && voiceQueueRef.current.length > 0) {
        const next = voiceQueueRef.current.shift();
        if (!next) {
          break;
        }

        const audioUrl = await requestSpeechAudio(next);
        await playVoice(audioUrl);
      }
      setVoiceError(null);
    } catch (error) {
      console.error(error);
      encounteredError = true;
      setVoiceError(
        error instanceof Error ? error.message : 'Unable to play encouragement right now. Please try again.'
      );
    } finally {
      voiceProcessingRef.current = false;
    }

    if (!encounteredError && voiceEnabled && voiceQueueRef.current.length > 0) {
      void processVoiceQueue();
    }
  }, [playVoice, requestSpeechAudio, setVoiceError, voiceEnabled]);

  const enqueueVoiceRequest = useCallback(
    (request: VoiceRequest) => {
      voiceQueueRef.current.push(request);
      if (voiceEnabled) {
        void processVoiceQueue();
      }
    },
    [processVoiceQueue, voiceEnabled]
  );

  const addSessionEntry = useCallback((session: Session, child: Child) => {
    setSessions((prev) => ({
      ...prev,
      [session.id]: {
        session,
        child,
        progress: deriveSessionProgress(session),
        pending: false,
        error: null,
        telemetry: null,
        nudgeEvents: []
      }
    }));
    processedNudgeKeysRef.current.set(session.id, new Set());
  }, []);

  const applySessionUpdate = useCallback((session: Session) => {
    setSessions((prev) => {
      const existing = prev[session.id];
      if (!existing) {
        return prev;
      }
      return {
        ...prev,
        [session.id]: {
          ...existing,
          session,
          progress: deriveSessionProgress(session),
          pending: false,
          error: null
        }
      };
    });
  }, []);

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
      } catch (error) {
        console.error(error);
        setSessions((prev) => {
          const existing = prev[sessionId];
          if (!existing) {
            return prev;
          }
          return {
            ...prev,
            [sessionId]: {
              ...existing,
              pending: false,
              error: 'Unable to finalise the session. Please try again.'
            }
          };
        });
      }
    },
    [applySessionUpdate]
  );
  const handleSessionStarted = useCallback(
    (session: Session, child: Child) => {
      addSessionEntry(session, child);
      setFocusedSessionId(session.id);
      setVoiceError(null);
      processedNudgeKeysRef.current.set(session.id, new Set());
      setTodayMode('board');

      if (boardIntroDeliveredRef.current) {
        const firstTask = session.tasks.find((task) => !task.completedAt && !task.skipped);
        if (firstTask) {
          enqueueVoiceRequest({
            type: 'session_start',
            sessionId: session.id,
            sessionTaskId: firstTask.id,
            language: VOICE_LANGUAGE
          });
        }
      }
    },
    [addSessionEntry, enqueueVoiceRequest, setVoiceError]
  );

  const handleEnableVoice = useCallback(async () => {
    setVoiceError(null);
    const success = await enableVoice();
    if (success) {
      await processVoiceQueue();
    }
  }, [enableVoice, processVoiceQueue, setVoiceError]);

  useEffect(() => {
    if (voiceEnabled) {
      void processVoiceQueue();
    }
  }, [processVoiceQueue, voiceEnabled]);

  const fetchActiveSessions = useCallback(async (): Promise<number> => {
    let count = 0;
    try {
      const response = await fetch('/api/sessions/active');
      if (!response.ok) {
        throw new Error('Failed to load active sessions');
      }
      const data = (await response.json()) as {
        sessions: Array<{ session: Session; child: Child }>;
      };

      const nextState: Record<string, SessionUIState> = {};
      const processed = new Map<string, Set<string>>();
      data.sessions.forEach(({ session, child }) => {
        nextState[session.id] = {
          session,
          child,
          progress: deriveSessionProgress(session),
          pending: false,
          error: null,
          telemetry: null,
          nudgeEvents: []
        };
        processed.set(session.id, new Set());
      });

      processedNudgeKeysRef.current = processed;
      boardIntroDeliveredRef.current = data.sessions.length > 0;
      setSessions(nextState);
      setTodayMode(data.sessions.length > 0 ? 'board' : 'planner');
      count = data.sessions.length;

      setFocusedSessionId((current) => {
        if (current && nextState[current]) {
          return current;
        }
        const firstId = data.sessions[0]?.session.id ?? null;
        return firstId;
      });
    } catch (error) {
      console.error(error);
    }
    return count;
  }, []);

  useEffect(() => {
    void fetchActiveSessions();
  }, [fetchActiveSessions]);

  useEffect(() => {
    if (sessionIds.length === 0) {
      setFocusedSessionId(null);
      boardIntroDeliveredRef.current = false;
      voiceQueueRef.current = [];
      voiceProcessingRef.current = false;
      processedNudgeKeysRef.current = new Map();
      setTodayMode('planner');
    } else if (focusedSessionId && !sessions[focusedSessionId]) {
      setFocusedSessionId(sessionIds[0] ?? null);
    }
  }, [focusedSessionId, sessionIds, sessions]);

  const handleSessionsBatchStarted = useCallback(
    (entries: Array<{ session: Session; child: Child }>) => {
      if (entries.length > 0) {
        setTodayMode('board');
      }

      if (boardIntroDeliveredRef.current || entries.length === 0) {
        return;
      }
      const text = buildBoardIntroduction(entries);
      enqueueVoiceRequest({ type: 'custom', language: VOICE_LANGUAGE, text });
      boardIntroDeliveredRef.current = true;
    },
    [enqueueVoiceRequest]
  );

  const handleEndAllSessions = useCallback(async () => {
    if (endingSessions) {
      return;
    }

    const entries = Object.values(sessionStateRef.current);
    if (entries.length === 0) {
      setTodayMode('planner');
      return;
    }

    setEndingSessions(true);
    setEndSessionsError(null);

    try {
      for (const entry of entries) {
        const { session } = entry;
        for (let index = 0; index < session.tasks.length; index += 1) {
          const task = session.tasks[index];
          if (task.completedAt || task.skipped) {
            continue;
          }

          const response = await fetch(`/api/sessions/${session.id}/task/${index}/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ skipped: true })
          });

          if (!response.ok) {
            const payload = await response.json().catch(() => ({} as { error?: { message?: string } }));
            throw new Error(payload.error?.message ?? 'Unable to skip remaining tasks.');
          }
        }

        const finishResponse = await fetch(`/api/sessions/${session.id}/finish`, { method: 'POST' });
        if (!finishResponse.ok) {
          const payload = await finishResponse.json().catch(() => ({} as { error?: { message?: string } }));
          throw new Error(payload.error?.message ?? 'Unable to end the session.');
        }
      }

      const remaining = await fetchActiveSessions();
      setTodayMode(remaining > 0 ? 'board' : 'planner');
    } catch (error) {
      console.error(error);
      setEndSessionsError(
        error instanceof Error ? error.message : 'Unable to end sessions right now. Please try again.'
      );
    } finally {
      setEndingSessions(false);
    }
  }, [endingSessions, fetchActiveSessions]);

  useEffect(() => {
    if (sessionIdsKey.length === 0) {
      return undefined;
    }

    let cancelled = false;
    const ids = sessionIdsKey.split('|').filter(Boolean);

    const fetchTelemetry = async () => {
      await Promise.all(
        ids.map(async (sessionId) => {
          try {
            const response = await fetch(`/api/sessions/${sessionId}/telemetry`);
            if (!response.ok) {
              throw new Error('Failed to load telemetry');
            }
            const data = (await response.json()) as { telemetry: SessionTelemetry };
            if (cancelled) {
              return;
            }

            setSessions((prev) => {
              const existing = prev[sessionId];
              if (!existing) {
                return prev;
              }

              const existingEvents = existing.nudgeEvents;
              const processed = ensureProcessedSet(sessionId);
              const additions = data.telemetry.nudges.filter((event) => {
                const key = `${event.sessionTaskId}:${event.threshold}`;
                return (
                  !processed.has(key) &&
                  !existingEvents.some(
                    (current) =>
                      current.sessionTaskId === event.sessionTaskId && current.threshold === event.threshold
                  )
                );
              });

              if (additions.length > 0) {
                additions.forEach((event) => {
                  const key = `${event.sessionTaskId}:${event.threshold}`;
                  processed.add(key);
                  enqueueVoiceRequest({
                    type: 'nudge',
                    sessionId,
                    sessionTaskId: event.sessionTaskId,
                    nudgeThreshold: event.threshold,
                    language: VOICE_LANGUAGE
                  });
                });
              }

              return {
                ...prev,
                [sessionId]: {
                  ...existing,
                  telemetry: data.telemetry,
                  nudgeEvents: additions.length > 0 ? [...existingEvents, ...additions] : existingEvents
                }
              };
            });
          } catch (error) {
            console.error(error);
          }
        })
      );
    };

    void fetchTelemetry();
    const interval = window.setInterval(fetchTelemetry, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [enqueueVoiceRequest, ensureProcessedSet, sessionIdsKey]);
  const handleCompleteTask = useCallback(
    async (sessionId: string, index: number) => {
      const entry = sessionStateRef.current[sessionId];
      if (!entry) {
        return;
      }

      setSessions((prev) => {
        const existing = prev[sessionId];
        if (!existing) {
          return prev;
        }
        return {
          ...prev,
          [sessionId]: { ...existing, pending: true, error: null }
        };
      });

      try {
        const response = await fetch(`/api/sessions/${sessionId}/task/${index}/complete`, {
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

        const updatedTask = data.session.tasks[index];
        if (updatedTask && !updatedTask.skipped && updatedTask.completedAt) {
          enqueueVoiceRequest({
            type: 'completion',
            sessionId: data.session.id,
            sessionTaskId: updatedTask.id,
            language: VOICE_LANGUAGE
          });
        }

        const allHandled = data.session.tasks.every((task) => task.completedAt || task.skipped);
        if (allHandled && !data.session.medal) {
          await finishSession(data.session.id);
        }
      } catch (error) {
        console.error(error);
        setSessions((prev) => {
          const existing = prev[sessionId];
          if (!existing) {
            return prev;
          }
          return {
            ...prev,
            [sessionId]: {
              ...existing,
              pending: false,
              error: 'Unable to update this task. Please try again.'
            }
          };
        });
      }
    },
    [applySessionUpdate, enqueueVoiceRequest, finishSession]
  );

  const handleSkipTask = useCallback(
    async (sessionId: string, index: number) => {
      const entry = sessionStateRef.current[sessionId];
      if (!entry) {
        return;
      }

      setSessions((prev) => {
        const existing = prev[sessionId];
        if (!existing) {
          return prev;
        }
        return {
          ...prev,
          [sessionId]: { ...existing, pending: true, error: null }
        };
      });

      try {
        const response = await fetch(`/api/sessions/${sessionId}/task/${index}/complete`, {
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

        const allHandled = data.session.tasks.every((task) => task.completedAt || task.skipped);
        if (allHandled && !data.session.medal) {
          await finishSession(data.session.id);
        }
      } catch (error) {
        console.error(error);
        setSessions((prev) => {
          const existing = prev[sessionId];
          if (!existing) {
            return prev;
          }
          return {
            ...prev,
            [sessionId]: {
              ...existing,
              pending: false,
              error: 'Unable to skip this task. Please try again.'
            }
          };
        });
      }
    },
    [applySessionUpdate, finishSession]
  );

  const isTodayBoardFullScreen = activeNav === 'today' && todayMode === 'board';
  const mainClasses = [
    'flex-1 bg-slate-900/40',
    isTodayBoardFullScreen ? 'overflow-hidden p-0' : 'overflow-y-auto p-8'
  ].join(' ');
  const containerClasses = [
    'flex flex-col gap-8',
    isTodayBoardFullScreen ? 'h-full w-full' : 'mx-auto max-w-6xl'
  ].join(' ');

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-50">
      <aside className="flex w-64 flex-col gap-8 border-r border-slate-800 bg-slate-900 p-6">
        <div>
          <h1 className="text-2xl font-semibold">Klar Parat</h1>
          <p className="text-sm text-slate-400">Morning routine assistant</p>
        </div>
        <SidebarNav activeKey={activeNav} onSelect={setActiveNav} />
      </aside>
      <main className={mainClasses}>
        <div className={containerClasses}>
          {activeNav === 'children' ? <ChildrenManager /> : null}
          {activeNav === 'templates' ? <TemplatesManager /> : null}
          {activeNav === 'today' ? (
            <TodayManager
              sessions={sessionList}
              focusedSessionId={focusedSessionId}
              onFocusSession={setFocusedSessionId}
              onSessionStarted={handleSessionStarted}
              onSessionsBatchStarted={handleSessionsBatchStarted}
              onCompleteTask={handleCompleteTask}
              onSkipTask={handleSkipTask}
              onEnableVoice={handleEnableVoice}
              voiceEnabled={voiceEnabled}
              voiceEnabling={voiceEnabling}
              voiceError={voiceError}
              showDebugTelemetry={debugMode}
              mode={todayMode}
              onLaunchBoard={() => setTodayMode('board')}
              onEndAllSessions={handleEndAllSessions}
              endingSessions={endingSessions}
              endSessionsError={endSessionsError}
            />
          ) : null}
          {activeNav === 'history' && (
            <p className="text-lg text-slate-400">History tracking is coming later.</p>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
