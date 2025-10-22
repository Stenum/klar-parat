import type { Child, Session, Template } from '@shared/schemas';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from './App';

type ActiveSessionRecord = { session: Session; child: Child };

describe('App (multi-child board)', () => {
  const jsonResponse = (data: unknown, status = 200) =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: async () => data
    } as Response);

  let activeSessions: ActiveSessionRecord[];
  let sessionsById: Map<string, Session>;
  let children: Child[];
  let templates: Template[];
  let sessionCounter: number;
  let fetchMock: vi.SpiedFunction<typeof window.fetch>;

  beforeEach(() => {
    activeSessions = [];
    sessionsById = new Map();
    sessionCounter = 0;

    children = [
      { id: 'child-1', firstName: 'Ada', birthdate: '2015-04-03', active: true, createdAt: new Date().toISOString() },
      { id: 'child-2', firstName: 'Ben', birthdate: '2014-09-12', active: true, createdAt: new Date().toISOString() }
    ];

    templates = [
      {
        id: 'template-1',
        name: 'Morning Blast',
        defaultStartTime: '07:00',
        defaultEndTime: '08:00',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tasks: [
          {
            id: 'task-1',
            title: 'Brush Teeth',
            expectedMinutes: 3,
            emoji: '🪥',
            hint: 'Sparkly smiles!',
            orderIndex: 0
          },
          {
            id: 'task-2',
            title: 'Get Dressed',
            expectedMinutes: 5,
            emoji: '👕',
            hint: 'Clothes on fast!',
            orderIndex: 1
          }
        ]
      }
    ];

    const createSessionFromTemplate = (childId: string, templateId: string, allowSkip: boolean): Session => {
      const template = templates.find((item) => item.id === templateId);
      if (!template) {
        throw new Error('Template not found');
      }

      const expectedTotal = template.tasks.reduce((sum, task) => sum + task.expectedMinutes, 0);
      const start = new Date();
      const plannedEnd = new Date(start.getTime() + 45 * 60 * 1000);
      const sessionId = `session-${++sessionCounter}`;
      const session: Session = {
        id: sessionId,
        childId,
        allowSkip,
        plannedStartAt: start.toISOString(),
        plannedEndAt: plannedEnd.toISOString(),
        actualStartAt: start.toISOString(),
        actualEndAt: null,
        expectedTotalMinutes: expectedTotal,
        medal: null,
        templateSnapshot: {
          templateId: template.id,
          name: template.name,
          defaultStartTime: template.defaultStartTime,
          defaultEndTime: template.defaultEndTime,
          tasks: template.tasks.map((task) => ({
            title: task.title,
            emoji: task.emoji,
            hint: task.hint,
            expectedMinutes: task.expectedMinutes,
            orderIndex: task.orderIndex
          })),
          expectedTotalMinutes: expectedTotal
        },
        tasks: template.tasks.map((task) => ({
          id: `${sessionId}-task-${task.orderIndex}`,
          title: task.title,
          expectedMinutes: task.expectedMinutes,
          completedAt: null,
          skipped: false,
          orderIndex: task.orderIndex,
          emoji: task.emoji,
          hint: task.hint
        }))
      };

      return session;
    };

    fetchMock = vi
      .spyOn(window, 'fetch')
      .mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        const method = (init?.method ?? 'GET').toUpperCase();

        if (url.endsWith('/api/sessions/active') && method === 'GET') {
          return jsonResponse({ sessions: activeSessions });
      }

      if (url.endsWith('/api/children') && method === 'GET') {
        return jsonResponse({ children });
      }

      if (url.endsWith('/api/templates') && method === 'GET') {
        return jsonResponse({ templates });
      }

      if (url.endsWith('/api/sessions/start') && method === 'POST') {
        const body = JSON.parse(init?.body as string) as {
          childId: string;
          templateId: string;
          allowSkip?: boolean;
        };
        const child = children.find((item) => item.id === body.childId);
        if (!child) {
          return jsonResponse({ error: { message: 'Child not found' } }, 404);
        }
        const session = createSessionFromTemplate(body.childId, body.templateId, body.allowSkip ?? false);
        sessionsById.set(session.id, session);
        activeSessions.push({ session, child });
        return jsonResponse({ session }, 201);
      }

      const telemetryMatch = url.match(/\/api\/sessions\/([^/]+)\/telemetry$/);
      if (telemetryMatch && method === 'GET') {
        const session = sessionsById.get(telemetryMatch[1]);
        if (!session) {
          return jsonResponse({ error: { message: 'Session not found' } }, 404);
        }
        return jsonResponse({
          telemetry: {
            urgencyLevel: 1,
            timeRemainingMinutes: 20,
            paceDelta: 0.05,
            sessionEndsAt: session.plannedEndAt,
            nudges: [],
            currentTask: session.tasks.find((task) => !task.completedAt && !task.skipped)
              ? {
                  sessionTaskId: session.tasks.find((task) => !task.completedAt && !task.skipped)!.id,
                  title: session.tasks.find((task) => !task.completedAt && !task.skipped)!.title,
                  expectedMinutes: session.tasks.find((task) => !task.completedAt && !task.skipped)!.expectedMinutes,
                  hint: session.tasks.find((task) => !task.completedAt && !task.skipped)!.hint,
                  startedAt: session.actualStartAt!,
                  elapsedSeconds: 60,
                  remainingSeconds: 120,
                  nudgesFiredCount: 0,
                  totalScheduledNudges: 3,
                  nextNudgeThreshold: 'second',
                  lastNudgeFiredAt: null
                }
              : null,
            nextTask: null
          }
        });
      }

      const completeMatch = url.match(/\/api\/sessions\/([^/]+)\/task\/(\d+)\/complete$/);
      if (completeMatch && method === 'POST') {
        const [, sessionId, index] = completeMatch;
        const session = sessionsById.get(sessionId);
        if (!session) {
          return jsonResponse({ error: { message: 'Session not found' } }, 404);
        }
        const orderIndex = Number.parseInt(index, 10);
        const task = session.tasks.find((item) => item.orderIndex === orderIndex);
        if (!task) {
          return jsonResponse({ error: { message: 'Task not found' } }, 404);
        }
        const body = JSON.parse(init?.body as string) as { skipped?: boolean };
        if (body.skipped) {
          task.skipped = true;
          task.completedAt = null;
        } else {
          task.skipped = false;
          task.completedAt = new Date().toISOString();
        }
        sessionsById.set(sessionId, { ...session, tasks: [...session.tasks] });
        const record = activeSessions.find((entry) => entry.session.id === sessionId);
        if (record) {
          record.session = sessionsById.get(sessionId)!;
        }
        return jsonResponse({ session: sessionsById.get(sessionId) });
      }

      if (url.match(/\/api\/sessions\/[^/]+\/finish$/) && method === 'POST') {
        const sessionId = url.split('/')[url.split('/').length - 2];
        const session = sessionsById.get(sessionId);
        if (!session) {
          return jsonResponse({ error: { message: 'Session not found' } }, 404);
        }
        const updated: Session = {
          ...session,
          medal: 'gold',
          actualEndAt: new Date().toISOString()
        };
        sessionsById.set(sessionId, updated);
        activeSessions = activeSessions.filter((entry) => entry.session.id !== sessionId);
        return jsonResponse({ session: updated });
      }

      if (url.match(/\/api\/sessions\/[^/]+\/message$/) && method === 'POST') {
        return jsonResponse({ text: 'Great job!' });
      }

      if (url.endsWith('/api/tts') && method === 'POST') {
        return jsonResponse({ audioUrl: 'data:audio/wav;base64,AA==' });
      }

      return jsonResponse({ error: { message: `Unhandled fetch ${url}` } }, 500);
      });

    vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(async () => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('shows the voice status indicator on the Today planner', async () => {
    const user = userEvent.setup();
    render(<App />);

    const todayNav = await screen.findByRole('button', { name: 'Today' });
    await user.click(todayNav);

    expect(await screen.findByText(/will enable when you start/i)).toBeInTheDocument();
  });

  it('navigates between sections without leaving the board setup', async () => {
    const user = userEvent.setup();
    render(<App />);

    const todayNav = await screen.findByRole('button', { name: 'Today' });
    await user.click(todayNav);

    await waitFor(() => expect(screen.getByLabelText('Child')).toBeInTheDocument());

    await user.click(await screen.findByRole('button', { name: 'Templates' }));
    expect(await screen.findByRole('heading', { name: /templates/i })).toBeInTheDocument();
  });

  it('lets the parent stage multiple kids and introduces them together first', async () => {
    const user = userEvent.setup();
    render(<App />);

    const todayNav = await screen.findByRole('button', { name: 'Today' });
    await user.click(todayNav);

    await waitFor(() => expect(screen.getByLabelText('Child')).toBeInTheDocument());

    await user.selectOptions(screen.getByLabelText('Child'), 'child-1');
    await user.selectOptions(screen.getByLabelText('Routine template'), 'template-1');
    await user.click(screen.getByRole('button', { name: 'Add to plan' }));

    await user.selectOptions(screen.getByLabelText('Child'), 'child-2');
    await user.selectOptions(screen.getByLabelText('Routine template'), 'template-1');
    await user.click(screen.getByRole('button', { name: 'Add to plan' }));

    expect(screen.getAllByRole('button', { name: 'Remove' })).toHaveLength(2);

    const startButton = screen.getByRole('button', { name: 'Start 2 sessions' });
    await user.click(startButton);

    expect(await screen.findByRole('button', { name: 'End all sessions' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Ada' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Ben' })).toBeInTheDocument();

    await waitFor(() => {
      const introCall = fetchMock.mock.calls.find(([input, init]) => {
        if (typeof input !== 'string' || !input.endsWith('/api/tts') || !init?.body) {
          return false;
        }
        try {
          const payload = JSON.parse(init.body as string) as { text?: string };
          return payload.text?.includes('Hej Ada and Ben') ?? false;
        } catch {
          return false;
        }
      });
      expect(introCall).toBeDefined();
    });

    const startMessageCalls = fetchMock.mock.calls.filter(([input, init]) => {
      if (typeof input !== 'string' || !/\/api\/sessions\/[^/]+\/message$/.test(input)) {
        return false;
      }
      return (init?.method ?? 'GET').toUpperCase() === 'POST' && Boolean(init?.body);
    });
    expect(startMessageCalls).toHaveLength(0);
  });

  it('lets the parent end all sessions and return to planning', async () => {
    const user = userEvent.setup();
    render(<App />);

    const todayNav = await screen.findByRole('button', { name: 'Today' });
    await user.click(todayNav);

    await waitFor(() => expect(screen.getByLabelText('Child')).toBeInTheDocument());

    await user.selectOptions(screen.getByLabelText('Child'), 'child-1');
    await user.selectOptions(screen.getByLabelText('Routine template'), 'template-1');
    await user.click(screen.getByRole('button', { name: 'Add to plan' }));

    await user.click(screen.getByRole('button', { name: 'Start 1 session' }));

    const endButton = await screen.findByRole('button', { name: 'End all sessions' });
    await user.click(endButton);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Add to plan' })).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'End all sessions' })).not.toBeInTheDocument();

    const skipCalls = fetchMock.mock.calls.filter(([input, init]) => {
      if (typeof input !== 'string' || !/task\/\d+\/complete$/.test(input)) {
        return false;
      }
      if (!init?.body) {
        return false;
      }
      try {
        const body = JSON.parse(init.body as string) as { skipped?: boolean };
        return body.skipped === true;
      } catch {
        return false;
      }
    });

    const finishCalls = fetchMock.mock.calls.filter(([input, init]) => {
      if (typeof input !== 'string' || !/\/api\/sessions\/[^/]+\/finish$/.test(input)) {
        return false;
      }
      return (init?.method ?? 'GET').toUpperCase() === 'POST';
    });

    expect(skipCalls.length).toBeGreaterThan(0);
    expect(finishCalls.length).toBeGreaterThan(0);
  });
});
