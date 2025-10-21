import type { Child, Session, Template } from '@shared/schemas';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from './App';

describe('App', () => {
  const jsonResponse = (data: unknown, status = 200) =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: async () => data
    } as Response);

  type TemplateTaskPayload = {
    title: string;
    expectedMinutes: number;
    emoji?: string;
    hint?: string;
  };

  type TemplatePayload = {
    name: string;
    defaultStartTime: string;
    defaultEndTime: string;
    tasks: TemplateTaskPayload[];
  };

  type ChildPayload = {
    firstName: string;
    birthdate: string;
    active?: boolean;
  };

  beforeEach(() => {
    const children: Child[] = [];
    const templates: Template[] = [];
    let currentSession: Session | null = null;
    let sessionCounter = 0;

    vi.spyOn(window, 'fetch').mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = (init?.method ?? 'GET').toUpperCase();

      if (url.endsWith('/api/children') && method === 'GET') {
        return jsonResponse({ children });
      }

      if (url.endsWith('/api/children') && method === 'POST') {
        const body = JSON.parse(init?.body as string) as ChildPayload;
        const child: Child = {
          id: `child-${children.length + 1}`,
          firstName: body.firstName,
          birthdate: body.birthdate,
          active: body.active ?? true,
          createdAt: new Date().toISOString()
        };
        children.push(child);
        return jsonResponse({ child }, 201);
      }

      if (url.match(/\/api\/children\//) && method === 'PUT') {
        const childId = url.split('/').pop()!;
        const body = JSON.parse(init?.body as string) as Partial<ChildPayload>;
        const child = children.find((item) => item.id === childId);
        if (!child) {
          return jsonResponse({ error: { message: 'Not found' } }, 404);
        }
        Object.assign(child, body);
        return jsonResponse({ child });
      }

      if (url.match(/\/api\/children\//) && method === 'DELETE') {
        const childId = url.split('/').pop()!;
        const index = children.findIndex((item) => item.id === childId);
        if (index === -1) {
          return jsonResponse({ error: { message: 'Not found' } }, 404);
        }
        children.splice(index, 1);
        return jsonResponse(undefined, 204);
      }

      if (url.endsWith('/api/templates') && method === 'GET') {
        return jsonResponse({ templates });
      }

      if (url.endsWith('/api/templates') && method === 'POST') {
        const body = JSON.parse(init?.body as string) as TemplatePayload;
        const template: Template = {
          id: `template-${templates.length + 1}`,
          name: body.name,
          defaultStartTime: body.defaultStartTime,
          defaultEndTime: body.defaultEndTime,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          tasks: body.tasks.map((task, index) => ({
            id: `task-${index}-${templates.length + 1}`,
            title: task.title,
            expectedMinutes: task.expectedMinutes,
            emoji: task.emoji,
            hint: task.hint,
            orderIndex: index
          }))
        };
        templates.push(template);
        return jsonResponse({ template }, 201);
      }

      if (url.match(/\/api\/templates\//) && method === 'DELETE') {
        const templateId = url.split('/').pop()!;
        const index = templates.findIndex((item) => item.id === templateId);
        if (index === -1) {
          return jsonResponse({ error: { message: 'Not found' } }, 404);
        }
        templates.splice(index, 1);
        return jsonResponse(undefined, 204);
      }

      if (url.endsWith('/api/sessions/start') && method === 'POST') {
        const body = JSON.parse(init?.body as string) as {
          childId: string;
          templateId: string;
          allowSkip?: boolean;
        };
        const template = templates.find((item) => item.id === body.templateId);
        if (!template) {
          return jsonResponse({ error: { message: 'Template not found' } }, 404);
        }
        const expectedTotal = template.tasks.reduce((sum, task) => sum + task.expectedMinutes, 0);
        const plannedStartAt = new Date().toISOString();
        const plannedEndAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
        const actualStartAt = new Date().toISOString();
        const session: Session = {
          id: `session-${++sessionCounter}`,
          childId: body.childId,
          allowSkip: body.allowSkip ?? false,
          plannedStartAt,
          plannedEndAt,
          actualStartAt,
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
            id: `session-task-${task.id}`,
            title: task.title,
            expectedMinutes: task.expectedMinutes,
            completedAt: null,
            skipped: false,
            orderIndex: task.orderIndex
          }))
        };
        currentSession = session;
        return jsonResponse({ session }, 201);
      }

      if (url.endsWith('/telemetry') && method === 'GET') {
        if (!currentSession) {
          return jsonResponse({ error: { message: 'Not found' } }, 404);
        }

        return jsonResponse({
          telemetry: {
            urgencyLevel: 1,
            timeRemainingMinutes: 42,
            paceDelta: 0.05,
            nudges: []
          }
        });
      }

      if (url.match(/\/api\/sessions\//) && method === 'GET') {
        const sessionId = url.split('/').pop()!;
        if (currentSession && currentSession.id === sessionId) {
          return jsonResponse({ session: currentSession });
        }
        return jsonResponse({ error: { message: 'Not found' } }, 404);
      }

      const completeMatch = url.match(/\/api\/sessions\/([^/]+)\/task\/(\d+)\/complete$/);
      if (completeMatch && method === 'POST') {
        if (!currentSession) {
          return jsonResponse({ error: { message: 'Not found' } }, 404);
        }

        const [, sessionId, index] = completeMatch;
        if (currentSession.id !== sessionId) {
          return jsonResponse({ error: { message: 'Not found' } }, 404);
        }

        const { skipped = false } = init?.body ? (JSON.parse(init.body as string) as { skipped?: boolean }) : {};
        const orderIndex = Number.parseInt(index, 10);
        const task = currentSession.tasks.find((item) => item.orderIndex === orderIndex);
        if (!task) {
          return jsonResponse({ error: { message: 'Task not found' } }, 404);
        }

        const now = new Date().toISOString();
        const updatedTasks = currentSession.tasks.map((item) => {
          if (item.orderIndex !== orderIndex) {
            return item;
          }
          return {
            ...item,
            skipped,
            completedAt: skipped ? null : now
          };
        });

        const actualStartAt = skipped
          ? currentSession.actualStartAt
          : currentSession.actualStartAt ?? now;

        currentSession = {
          ...currentSession,
          actualStartAt,
          tasks: updatedTasks
        };

        return jsonResponse({ session: currentSession });
      }

      const finishMatch = url.match(/\/api\/sessions\/([^/]+)\/finish$/);
      if (finishMatch && method === 'POST') {
        if (!currentSession) {
          return jsonResponse({ error: { message: 'Not found' } }, 404);
        }

        const [, sessionId] = finishMatch;
        if (currentSession.id !== sessionId) {
          return jsonResponse({ error: { message: 'Not found' } }, 404);
        }

        const remaining = currentSession.tasks.some((task) => !task.completedAt && !task.skipped);
        if (remaining) {
          return jsonResponse(
            { error: { message: 'All tasks must be completed or skipped before finishing' } },
            400
          );
        }

        const now = new Date().toISOString();
        const completedTimes = currentSession.tasks
          .map((task) => task.completedAt)
          .filter((value): value is string => Boolean(value));
        const earliest = completedTimes.length
          ? completedTimes.reduce((earliestTime, current) => (current < earliestTime ? current : earliestTime))
          : now;

        currentSession = {
          ...currentSession,
          actualStartAt: currentSession.actualStartAt ?? earliest,
          actualEndAt: now,
          medal: 'gold'
        };

        return jsonResponse({ session: currentSession });
      }

      return jsonResponse({ error: { message: 'Unknown request' } }, 500);
    });

    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders navigation with Today enabled', async () => {
    render(<App />);

    await waitFor(() => expect(window.fetch).toHaveBeenCalled());

    expect(screen.getByRole('button', { name: /Children/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Templates/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Today/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /History/ })).toBeDisabled();
  });

  it('shows validation error when child form is incomplete', async () => {
    render(<App />);

    await waitFor(() => expect(window.fetch).toHaveBeenCalled());

    const [submitButton] = screen.getAllByRole('button', { name: /Add child/i });
    await userEvent.click(submitButton);

    expect(await screen.findByText(/First name is required/i)).toBeInTheDocument();
  });

  it('creates a child and refreshes the list', async () => {
    render(<App />);

    await waitFor(() => expect(window.fetch).toHaveBeenCalled());

    const [firstNameInput] = screen.getAllByLabelText(/First name/i);
    const [birthdateInput] = screen.getAllByLabelText(/Birthdate/i);
    const [submitButton] = screen.getAllByRole('button', { name: /Add child/i });

    await userEvent.type(firstNameInput, 'Ada');
    fireEvent.change(birthdateInput, { target: { value: '2015-04-03' } });
    await userEvent.click(submitButton);

    await waitFor(() => expect(screen.getByText('Ada')).toBeInTheDocument());
  });

  it('starts a session and enters kid mode', async () => {
    window.history.pushState({}, '', '/?debug=1');
    render(<App />);

    await waitFor(() => expect(window.fetch).toHaveBeenCalled());

    // Create child
    const [firstNameInput] = screen.getAllByLabelText(/First name/i);
    const [birthdateInput] = screen.getAllByLabelText(/Birthdate/i);
    const [addChildButton] = screen.getAllByRole('button', { name: /Add child/i });
    await userEvent.type(firstNameInput, 'Ada');
    fireEvent.change(birthdateInput, { target: { value: '2015-04-03' } });
    await userEvent.click(addChildButton);
    await screen.findByText('Ada');

    // Create template
    const [templatesNavButton] = screen.getAllByRole('button', { name: /^Templates$/i });
    await userEvent.click(templatesNavButton);
    await screen.findByText(/Create template/i);
    await userEvent.type(screen.getByLabelText(/Template name/i), 'Morning');
    const taskTitleInputs = screen.getAllByLabelText(/Title/i);
    await userEvent.clear(taskTitleInputs[0]);
    await userEvent.type(taskTitleInputs[0], 'Wake up');
    await userEvent.clear(taskTitleInputs[1]);
    await userEvent.type(taskTitleInputs[1], 'Brush Teeth');
    await userEvent.click(screen.getByRole('button', { name: /Create template/i }));
    await screen.findByText('Morning');

    // Start session
    const [todayNavButton] = screen.getAllByRole('button', { name: /^Today$/i });
    await userEvent.click(todayNavButton);
    await screen.findByText(/Who is playing today/i);
    const childSelect = screen.getByLabelText(/^Child$/i, { selector: 'select' }) as HTMLSelectElement;
    const templateSelect = screen.getByLabelText(/^Routine template$/i, { selector: 'select' }) as HTMLSelectElement;
    await userEvent.selectOptions(childSelect, ['child-1']);
    await userEvent.selectOptions(templateSelect, ['template-1']);
    await userEvent.click(screen.getByRole('button', { name: /Start Session/i }));

    await screen.findByText(/Kid Mode/i);
    await screen.findByText(/Urgency: L1/i);
    expect(screen.getByRole('button', { name: /Complete/i })).toBeInTheDocument();
  });

  it('completes tasks and shows the medal summary', async () => {
    window.history.pushState({}, '', '/?debug=1');
    render(<App />);

    await waitFor(() => expect(window.fetch).toHaveBeenCalled());

    const [firstNameInput] = screen.getAllByLabelText(/First name/i);
    const [birthdateInput] = screen.getAllByLabelText(/Birthdate/i);
    const [addChildButton] = screen.getAllByRole('button', { name: /Add child/i });
    await userEvent.type(firstNameInput, 'Ada');
    fireEvent.change(birthdateInput, { target: { value: '2015-04-03' } });
    await userEvent.click(addChildButton);
    const [templatesNavButton] = screen.getAllByRole('button', { name: /^Templates$/i });
    await userEvent.click(templatesNavButton);
    await userEvent.type(screen.getByLabelText(/Template name/i), 'Morning');
    const taskTitleInputs = screen.getAllByLabelText(/Title/i);
    await userEvent.clear(taskTitleInputs[0]);
    await userEvent.type(taskTitleInputs[0], 'Wake up');
    await userEvent.clear(taskTitleInputs[1]);
    await userEvent.type(taskTitleInputs[1], 'Brush Teeth');
    await userEvent.click(screen.getByRole('button', { name: /Create template/i }));
    await screen.findByText('Morning');

    const [todayNavButton] = screen.getAllByRole('button', { name: /^Today$/i });
    await userEvent.click(todayNavButton);
    await screen.findByText(/Who is playing today/i);
    const childSelect = screen.getByLabelText(/^Child$/i, { selector: 'select' }) as HTMLSelectElement;
    const templateSelect = screen.getByLabelText(/^Routine template$/i, { selector: 'select' }) as HTMLSelectElement;
    await userEvent.selectOptions(childSelect, ['child-1']);
    await userEvent.selectOptions(templateSelect, ['template-1']);
    await userEvent.click(screen.getByRole('button', { name: /Start Session/i }));

    await screen.findByText(/Kid Mode/i);
    await screen.findByText(/Urgency: L1/i);
    const completeButton = screen.getByRole('button', { name: /Complete/i });
    await userEvent.click(completeButton);
    await screen.findByText(/1 \/ 2 done/i);

    await userEvent.click(screen.getByRole('button', { name: /Complete/i }));

    await screen.findByText(/You earned a Gold medal!/i);
  });
});
