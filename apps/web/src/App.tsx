import type { Child, Template, TemplateTaskInput } from '@shared/schemas';
import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';

const navItems = [
  { key: 'children', label: 'Children', enabled: true },
  { key: 'templates', label: 'Templates', enabled: true },
  { key: 'today', label: 'Today', enabled: false },
  { key: 'history', label: 'History', enabled: false }
] as const;

type NavKey = (typeof navItems)[number]['key'];

type ChildFormState = {
  id?: string;
  firstName: string;
  birthdate: string;
  active: boolean;
  error: string | null;
};

const createInitialChildForm = (): ChildFormState => ({
  firstName: '',
  birthdate: '',
  active: true,
  error: null
});

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

const App = () => {
  const [activeNav, setActiveNav] = useState<NavKey>('children');

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-50">
      <aside className="flex w-64 flex-col gap-8 border-r border-slate-800 bg-slate-900 p-6">
        <div>
          <h1 className="text-2xl font-semibold">Klar Parat</h1>
          <p className="text-sm text-slate-400">Morning routine assistant</p>
        </div>
        <nav className="flex flex-col gap-2">
          {navItems.map((item) => (
            <button
              key={item.key}
              type="button"
              disabled={!item.enabled}
              onClick={() => item.enabled && setActiveNav(item.key)}
              className={`rounded-lg px-4 py-3 text-left text-lg font-medium transition ${
                activeNav === item.key
                  ? 'bg-emerald-500 text-slate-900 shadow'
                  : item.enabled
                  ? 'bg-slate-800 text-slate-100 hover:bg-slate-700'
                  : 'cursor-not-allowed bg-slate-900 text-slate-600'
              }`}
            >
              {item.label}
              {!item.enabled && <span className="ml-2 text-xs uppercase">(coming soon)</span>}
            </button>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-y-auto bg-slate-900/40 p-8">
        <div className="mx-auto flex max-w-4xl flex-col gap-8">
          {activeNav === 'children' ? <ChildrenManager /> : null}
          {activeNav === 'templates' ? <TemplatesManager /> : null}
          {activeNav === 'today' && (
            <p className="text-lg text-slate-400">Today view arrives in the next iteration.</p>
          )}
          {activeNav === 'history' && (
            <p className="text-lg text-slate-400">History tracking is coming later.</p>
          )}
        </div>
      </main>
    </div>
  );
};

const ChildrenManager = () => {
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<ChildFormState>(createInitialChildForm());

  const fetchChildren = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/children');
      if (!response.ok) {
        throw new Error('Failed to load children');
      }
      const data = (await response.json()) as { children: Child[] };
      setChildren(data.children);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Unable to load children. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchChildren();
  }, []);

  const resetForm = () => setForm(createInitialChildForm());

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.firstName.trim()) {
      setForm((prev) => ({ ...prev, error: 'First name is required.' }));
      return;
    }
    if (!form.birthdate) {
      setForm((prev) => ({ ...prev, error: 'Birthdate is required.' }));
      return;
    }

    const payload = {
      firstName: form.firstName.trim(),
      birthdate: form.birthdate,
      active: form.active
    };

    try {
      const response = await fetch(form.id ? `/api/children/${form.id}` : '/api/children', {
        method: form.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error?.message ?? 'Failed to save child');
      }

      await fetchChildren();
      resetForm();
    } catch (err) {
      console.error(err);
      setForm((prev) => ({ ...prev, error: err instanceof Error ? err.message : 'Failed to save child.' }));
    }
  };

  const handleEdit = (child: Child) => {
    setForm({
      id: child.id,
      firstName: child.firstName,
      birthdate: child.birthdate,
      active: child.active,
      error: null
    });
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Remove this child?')) return;
    try {
      const response = await fetch(`/api/children/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error('Failed to delete child');
      }
      await fetchChildren();
    } catch (err) {
      console.error(err);
      setError('Unable to delete child.');
    }
  };

  return (
    <section className="rounded-2xl bg-slate-900/80 p-6 shadow-xl">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Children</h2>
          <p className="text-sm text-slate-400">Add each kid once. No logins required.</p>
        </div>
        {loading && <span className="text-sm text-emerald-400">Loading…</span>}
      </header>
      {error && <p className="mb-4 rounded-lg bg-rose-500/20 p-3 text-rose-200">{error}</p>}
      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-xl bg-slate-950/40 p-5">
          <h3 className="text-xl font-semibold">{form.id ? 'Edit Child' : 'New Child'}</h3>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-200">First name</span>
            <input
              type="text"
              value={form.firstName}
              onChange={(event) => setForm((prev) => ({ ...prev, firstName: event.target.value }))}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-base text-slate-50 focus:border-emerald-400 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-200">Birthdate</span>
            <input
              type="date"
              value={form.birthdate}
              onChange={(event) => setForm((prev) => ({ ...prev, birthdate: event.target.value }))}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-base text-slate-50 focus:border-emerald-400 focus:outline-none"
            />
          </label>
          <label className="flex items-center gap-3 text-base">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) => setForm((prev) => ({ ...prev, active: event.target.checked }))}
              className="h-5 w-5 rounded border-slate-600 bg-slate-800 text-emerald-400 focus:ring-emerald-300"
            />
            <span className="text-slate-200">Active child</span>
          </label>
          {form.error && <p className="rounded bg-rose-500/20 px-3 py-2 text-sm text-rose-200">{form.error}</p>}
          <div className="mt-2 flex gap-3">
            <button
              type="submit"
              className="flex-1 rounded-lg bg-emerald-500 px-4 py-3 text-lg font-semibold text-slate-900 shadow transition hover:bg-emerald-400"
            >
              {form.id ? 'Save changes' : 'Add child'}
            </button>
            {form.id && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-slate-600 px-4 py-3 text-lg font-semibold text-slate-200 transition hover:border-slate-400"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
        <div className="space-y-4">
          {children.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-slate-400">
              Add your first child to begin building routines.
            </p>
          ) : (
            children.map((child) => (
              <article
                key={child.id}
                className="flex items-center justify-between rounded-xl bg-slate-950/40 p-5 shadow"
              >
                <div>
                  <h3 className="text-xl font-semibold text-slate-100">{child.firstName}</h3>
                  <p className="text-sm text-slate-400">Born {child.birthdate}</p>
                  <p className={`text-sm font-medium ${child.active ? 'text-emerald-400' : 'text-slate-500'}`}>
                    {child.active ? 'Active' : 'Inactive'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleEdit(child)}
                    className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-emerald-400"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(child.id)}
                    className="rounded-lg bg-rose-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-rose-400"
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
};

const TemplatesManager = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<TemplateFormState>(createInitialTemplateForm());

  const fetchTemplates = async () => {
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
  };

  useEffect(() => {
    void fetchTemplates();
  }, []);

  const resetForm = () => setForm(createInitialTemplateForm());

  const validateTemplateForm = (state: TemplateFormState) => {
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
  };

  const normaliseTasks = (tasks: TemplateTaskForm[]): TemplateTaskInput[] =>
    tasks.map((task) => ({
      id: task.id,
      title: task.title.trim(),
      emoji: task.emoji?.trim() || undefined,
      hint: task.hint?.trim() || undefined,
      expectedMinutes: Number(task.expectedMinutes)
    }));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
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
      setForm((prev) => ({ ...prev, error: err instanceof Error ? err.message : 'Failed to save template.' }));
    }
  };

  const handleEdit = (template: Template) => {
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
  };

  const handleDelete = async (id: string) => {
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
  };

  const expectedTotalMinutes = useMemo(
    () =>
      form.tasks.reduce((total, task) => {
        const minutes = Number(task.expectedMinutes);
        return total + (Number.isNaN(minutes) ? 0 : minutes);
      }, 0),
    [form.tasks]
  );

  const moveTask = (index: number, direction: -1 | 1) => {
    setForm((prev) => {
      const nextTasks = [...prev.tasks];
      const target = index + direction;
      if (target < 0 || target >= nextTasks.length) {
        return prev;
      }
      const temp = nextTasks[index];
      nextTasks[index] = nextTasks[target];
      nextTasks[target] = temp;
      return { ...prev, tasks: nextTasks };
    });
  };

  const updateTaskField = (
    index: number,
    field: 'title' | 'expectedMinutes' | 'emoji' | 'hint',
    value: string
  ) => {
    setForm((prev) => {
      const tasks = prev.tasks.map((task, i) =>
        i === index
          ? {
              ...task,
              [field]: field === 'expectedMinutes' ? value : value
            }
          : task
      );
      return { ...prev, tasks };
    });
  };

  const removeTask = (index: number) => {
    setForm((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((_, i) => i !== index)
    }));
  };

  const addTask = () => {
    setForm((prev) => ({
      ...prev,
      tasks: [...prev.tasks, blankTask()]
    }));
  };

  return (
    <section className="rounded-2xl bg-slate-900/80 p-6 shadow-xl">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Templates</h2>
          <p className="text-sm text-slate-400">
            Build the routine once, reuse daily. Tasks render in kid mode soon.
          </p>
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
              <div key={index} className="rounded-lg border border-slate-700 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-lg font-semibold text-slate-100">Task {index + 1}</h4>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => moveTask(index, -1)}
                      className="rounded border border-slate-600 px-3 py-1 text-xs text-slate-100 disabled:opacity-40"
                      disabled={index === 0}
                    >
                      Move up
                    </button>
                    <button
                      type="button"
                      onClick={() => moveTask(index, 1)}
                      className="rounded border border-slate-600 px-3 py-1 text-xs text-slate-100 disabled:opacity-40"
                      disabled={index === form.tasks.length - 1}
                    >
                      Move down
                    </button>
                    <button
                      type="button"
                      onClick={() => removeTask(index)}
                      className="rounded bg-rose-500 px-3 py-1 text-xs font-semibold text-slate-950 disabled:opacity-40"
                      disabled={form.tasks.length === 1}
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <label className="mb-3 flex flex-col gap-1 text-sm">
                  <span className="font-medium text-slate-200">Title</span>
                  <input
                    type="text"
                    value={task.title}
                    onChange={(event) => updateTaskField(index, 'title', event.target.value)}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-base text-slate-50 focus:border-emerald-400 focus:outline-none"
                  />
                </label>
                <div className="grid grid-cols-3 gap-3">
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
            className="w-full rounded-lg border border-dashed border-emerald-400 px-4 py-3 text-base font-semibold text-emerald-300 hover:bg-emerald-500/10"
          >
            Add another task
          </button>
          {form.error && <p className="rounded bg-rose-500/20 px-3 py-2 text-sm text-rose-200">{form.error}</p>}
          <div className="mt-2 flex gap-3">
            <button
              type="submit"
              className="flex-1 rounded-lg bg-emerald-500 px-4 py-3 text-lg font-semibold text-slate-900 shadow transition hover:bg-emerald-400"
            >
              {form.id ? 'Save changes' : 'Create template'}
            </button>
            {form.id && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-slate-600 px-4 py-3 text-lg font-semibold text-slate-200 transition hover:border-slate-400"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
        <div className="space-y-4">
          {templates.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-slate-400">
              Create a template to plan the morning flow.
            </p>
          ) : (
            templates.map((template) => (
              <article
                key={template.id}
                className="rounded-xl bg-slate-950/40 p-5 shadow"
              >
                <header className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-slate-100">{template.name}</h3>
                    <p className="text-sm text-slate-400">
                      {template.defaultStartTime} → {template.defaultEndTime}
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
                </header>
                <ul className="space-y-2 text-sm text-slate-300">
                  {template.tasks.map((task) => (
                    <li key={task.id} className="flex items-center justify-between rounded bg-slate-900/70 px-3 py-2">
                      <span>
                        {task.emoji && <span className="mr-2 text-lg">{task.emoji}</span>}
                        <span className="font-medium text-slate-100">{task.title}</span>
                        {task.hint && <span className="ml-2 text-xs text-slate-400">{task.hint}</span>}
                      </span>
                      <span className="text-xs font-semibold text-emerald-300">{task.expectedMinutes} min</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
};

export default App;
