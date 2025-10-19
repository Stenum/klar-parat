import type { Template, TemplateTaskInput } from '@shared/schemas';
import type { FC, FormEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

type TemplateTaskForm = {
  id?: string;
  title: string;
  expectedMinutes: number | string;
  emoji?: string;
  hint?: string;
};

type TemplateFormState = {
  id?: string;
  name: string;
  defaultStartTime: string;
  defaultEndTime: string;
  tasks: TemplateTaskForm[];
  error: string | null;
};

const blankTask = (): TemplateTaskForm => ({
  title: '',
  expectedMinutes: 1,
  emoji: '',
  hint: ''
});

const createInitialTemplateForm = (): TemplateFormState => ({
  name: '',
  defaultStartTime: '07:00',
  defaultEndTime: '08:00',
  tasks: [blankTask(), blankTask()],
  error: null
});

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const TemplatesManager: FC = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<TemplateFormState>(createInitialTemplateForm());

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/templates');
      if (!response.ok) {
        throw new Error('Failed to load templates');
      }
      const data = (await response.json()) as { templates: Template[] };
      setTemplates(data.templates);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Unable to load templates. Please retry.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTemplates();
  }, [fetchTemplates]);

  const resetForm = useCallback(() => setForm(createInitialTemplateForm()), []);

  const validateTemplateForm = useCallback((state: TemplateFormState): string | null => {
    if (!state.name.trim()) {
      return 'Template name is required.';
    }
    if (!timePattern.test(state.defaultStartTime)) {
      return 'Start time must be HH:MM (24h).';
    }
    if (!timePattern.test(state.defaultEndTime)) {
      return 'End time must be HH:MM (24h).';
    }
    if (state.tasks.length === 0) {
      return 'Add at least one task.';
    }
    for (const task of state.tasks) {
      if (!task.title.trim()) {
        return 'Each task needs a title.';
      }
      const minutes = Number(task.expectedMinutes);
      if (Number.isNaN(minutes) || minutes < 0) {
        return 'Expected minutes must be 0 or greater.';
      }
    }
    return null;
  }, []);

  const normaliseTasks = useCallback(
    (tasks: TemplateTaskForm[]): TemplateTaskInput[] =>
      tasks.map((task) => ({
        id: task.id,
        title: task.title.trim(),
        emoji: task.emoji?.trim() || undefined,
        hint: task.hint?.trim() || undefined,
        expectedMinutes: Number(task.expectedMinutes)
      })),
    []
  );

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const validationMessage = validateTemplateForm(form);
      if (validationMessage) {
        setForm((prev) => ({ ...prev, error: validationMessage }));
        return;
      }

      const payload = {
        name: form.name.trim(),
        defaultStartTime: form.defaultStartTime,
        defaultEndTime: form.defaultEndTime,
        tasks: normaliseTasks(form.tasks)
      };

      try {
        const response = await fetch(form.id ? `/api/templates/${form.id}` : '/api/templates', {
          method: form.id ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const body = await response.json();
          throw new Error(body.error?.message ?? 'Failed to save template');
        }

        await fetchTemplates();
        resetForm();
      } catch (err) {
        console.error(err);
        setForm((prev) => ({
          ...prev,
          error: err instanceof Error ? err.message : 'Failed to save template.'
        }));
      }
    },
    [fetchTemplates, form, normaliseTasks, validateTemplateForm, resetForm]
  );

  const handleEdit = useCallback((template: Template) => {
    setForm({
      id: template.id,
      name: template.name,
      defaultStartTime: template.defaultStartTime,
      defaultEndTime: template.defaultEndTime,
      tasks: template.tasks.map((task) => ({
        id: task.id,
        title: task.title,
        expectedMinutes: task.expectedMinutes,
        emoji: task.emoji ?? '',
        hint: task.hint ?? ''
      })),
      error: null
    });
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!window.confirm('Remove this template?')) return;
      try {
        const response = await fetch(`/api/templates/${id}`, { method: 'DELETE' });
        if (!response.ok) {
          throw new Error('Failed to delete template');
        }
        await fetchTemplates();
      } catch (err) {
        console.error(err);
        setError('Unable to delete template.');
      }
    },
    [fetchTemplates]
  );

  const moveTask = useCallback((index: number, direction: -1 | 1) => {
    setForm((prev) => {
      const nextTasks = [...prev.tasks];
      const target = index + direction;
      if (target < 0 || target >= nextTasks.length) {
        return prev;
      }
      [nextTasks[index], nextTasks[target]] = [nextTasks[target], nextTasks[index]];
      return { ...prev, tasks: nextTasks };
    });
  }, []);

  const updateTaskField = useCallback((index: number, field: 'title' | 'expectedMinutes' | 'emoji' | 'hint', value: string) => {
    setForm((prev) => {
      const tasks = prev.tasks.map((task, taskIndex) =>
        taskIndex === index
          ? {
              ...task,
              [field]: value
            }
          : task
      );
      return { ...prev, tasks };
    });
  }, []);

  const removeTask = useCallback((index: number) => {
    setForm((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((_, taskIndex) => taskIndex !== index)
    }));
  }, []);

  const addTask = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      tasks: [...prev.tasks, blankTask()]
    }));
  }, []);

  const expectedTotalMinutes = useMemo(
    () =>
      form.tasks.reduce((total, task) => {
        const minutes = Number(task.expectedMinutes);
        return total + (Number.isNaN(minutes) ? 0 : minutes);
      }, 0),
    [form.tasks]
  );

  return (
    <section className="rounded-2xl bg-slate-900/80 p-6 shadow-xl">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Templates</h2>
          <p className="text-sm text-slate-400">Build the routine once, reuse daily. Tasks render in kid mode soon.</p>
        </div>
        {loading && <span className="text-sm text-emerald-400">Loading…</span>}
      </header>
      {error && <p className="mb-4 rounded-lg bg-rose-500/20 p-3 text-rose-200">{error}</p>}
      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-xl bg-slate-950/40 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold">{form.id ? 'Edit Template' : 'New Template'}</h3>
            <span className="text-sm text-slate-400">Total {expectedTotalMinutes} min</span>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-200">Template name</span>
            <input
              type="text"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-base text-slate-50 focus:border-emerald-400 focus:outline-none"
            />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-200">Start time</span>
              <input
                type="time"
                value={form.defaultStartTime}
                onChange={(event) => setForm((prev) => ({ ...prev, defaultStartTime: event.target.value }))}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-base text-slate-50 focus:border-emerald-400 focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-200">End time</span>
              <input
                type="time"
                value={form.defaultEndTime}
                onChange={(event) => setForm((prev) => ({ ...prev, defaultEndTime: event.target.value }))}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-base text-slate-50 focus:border-emerald-400 focus:outline-none"
              />
            </label>
          </div>
          <div className="space-y-4">
            {form.tasks.map((task, index) => (
              <div key={index} className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-200">Task {index + 1}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => moveTask(index, -1)}
                      className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:border-emerald-400"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveTask(index, 1)}
                      className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:border-emerald-400"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => removeTask(index)}
                      className="rounded border border-rose-400 px-2 py-1 text-xs text-rose-300 hover:bg-rose-500/10"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-slate-200">Title</span>
                    <input
                      type="text"
                      value={task.title}
                      onChange={(event) => updateTaskField(index, 'title', event.target.value)}
                      className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-base text-slate-50 focus:border-emerald-400 focus:outline-none"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-slate-200">Expected minutes</span>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={task.expectedMinutes}
                      onChange={(event) => updateTaskField(index, 'expectedMinutes', event.target.value)}
                      className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-base text-slate-50 focus:border-emerald-400 focus:outline-none"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-slate-200">Emoji (optional)</span>
                    <input
                      type="text"
                      value={task.emoji ?? ''}
                      onChange={(event) => updateTaskField(index, 'emoji', event.target.value)}
                      className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-base text-slate-50 focus:border-emerald-400 focus:outline-none"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-slate-200">Hint (optional)</span>
                    <input
                      type="text"
                      value={task.hint ?? ''}
                      onChange={(event) => updateTaskField(index, 'hint', event.target.value)}
                      className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-base text-slate-50 focus:border-emerald-400 focus:outline-none"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addTask}
            className="rounded-lg border border-dashed border-emerald-400 px-4 py-2 text-base font-semibold text-emerald-300 transition hover:border-emerald-300"
          >
            Add another task
          </button>
          <button
            type="submit"
            className="rounded-lg bg-emerald-500 px-4 py-3 text-lg font-semibold text-slate-900 shadow transition hover:bg-emerald-400"
          >
            {form.id ? 'Save template' : 'Create template'}
          </button>
          {form.error && <p className="rounded bg-rose-500/20 px-3 py-2 text-sm text-rose-200">{form.error}</p>}
        </form>
        <div className="space-y-4">
          {templates.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-slate-400">
              Create your first routine to get started.
            </p>
          ) : (
            templates.map((template) => (
              <article key={template.id} className="rounded-xl bg-slate-950/40 p-5 shadow">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold text-slate-100">{template.name}</h3>
                    <p className="text-sm text-slate-400">
                      {template.tasks.length} task{template.tasks.length === 1 ? '' : 's'} · {template.defaultStartTime}–
                      {template.defaultEndTime}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleEdit(template)}
                      className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-emerald-400"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(template.id)}
                      className="rounded-lg bg-rose-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-rose-400"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
};
