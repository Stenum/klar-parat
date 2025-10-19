import type { Child, Template } from '@shared/schemas';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
            id: `task-${index}`,
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

      return jsonResponse({ error: { message: 'Unknown request' } }, 500);
    });

    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders navigation with disabled items', async () => {
    render(<App />);

    await waitFor(() => expect(window.fetch).toHaveBeenCalled());

    expect(screen.getByRole('button', { name: /Children/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Templates/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Today/ })).toBeDisabled();
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
});
