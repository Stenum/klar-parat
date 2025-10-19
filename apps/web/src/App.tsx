import type { Child, Session, Template, TemplateTaskInput } from '@shared/schemas';
import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';

type NavKey = 'children' | 'templates' | 'today' | 'history';

type SessionProgressState = {
  completed: boolean;
  skipped: boolean;
};

const navItems: Array<{ key: NavKey; label: string; enabled: boolean }> = [
  { key: 'children', label: 'Children', enabled: true },
  { key: 'templates', label: 'Templates', enabled: true },
  { key: 'today', label: 'Today', enabled: true },
  { key: 'history', label: 'History', enabled: false }
];

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
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [activeChild, setActiveChild] = useState<Child | null>(null);
  const [showKidMode, setShowKidMode] = useState(false);
  const [sessionProgress, setSessionProgress] = useState<SessionProgressState[]>([]);

  const resetSessionState = () => {
    setActiveSession(null);
    setActiveChild(null);
    setShowKidMode(false);
    setSessionProgress([]);
  };

  const handleSessionStarted = (session: Session, child: Child) => {
    setActiveSession(session);
    setActiveChild(child);
    setShowKidMode(true);
    setSessionProgress(
      session.tasks.map((task) => ({
        completed: Boolean(task.completedAt),
        skipped: task.skipped
      }))
    );
  };

  const handleCompleteTask = (index: number) => {
    setSessionProgress((prev) =>
      prev.map((state, idx) =>
        idx === index
          ? {
              completed: true,
              skipped: false
            }
          : state
      )
    );
  };

  const handleSkipTask = (index: number) => {
    setSessionProgress((prev) =>
      prev.map((state, idx) =>
        idx === index
          ? {
              completed: false,
              skipped: true
            }
          : state
      )
    );
  };

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
        <div className="mx-auto flex max-w-5xl flex-col gap-8">
          {activeNav === 'children' ? <ChildrenManager /> : null}
          {activeNav === 'templates' ? <TemplatesManager /> : null}
          {activeNav === 'today' && (
            activeSession && showKidMode && activeChild ? (
              <KidMode
                session={activeSession}
                child={activeChild}
                progress={sessionProgress}
                onCompleteTask={handleCompleteTask}
                onSkipTask={handleSkipTask}
                onReturnToParent={() => setShowKidMode(false)}
                onEndSession={resetSessionState}
              />
            ) : (
              <TodayManager
                activeSession={activeSession}
                activeChild={activeChild}
                onSessionStarted={handleSessionStarted}
                onEnterKidMode={() => setShowKidMode(true)}
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
              [field]: value
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
              <article key={template.id} className="rounded-xl bg-slate-950/40 p-5 shadow">
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

type TodayManagerProps = {
  activeSession: Session | null;
  activeChild: Child | null;
  onSessionStarted: (session: Session, child: Child) => void;
  onEnterKidMode: () => void;
  onEndSession: () => void;
};

const TodayManager = ({ activeSession, activeChild, onSessionStarted, onEnterKidMode, onEndSession }: TodayManagerProps) => {
  const [children, setChildren] = useState<Child[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedChildId, setSelectedChildId] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [allowSkip, setAllowSkip] = useState(false);
  const [starting, setStarting] = useState(false);

  const fetchTodayData = async () => {
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
  };

  useEffect(() => {
    void fetchTodayData();
  }, []);

  const handleStartSession = async () => {
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
  };

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
            <span>Starts {new Date(activeSession.plannedStartAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
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
              <p className="text-sm text-slate-400">
                Add at least one child and template first to enable Kid Mode.
              </p>
            )}
          </div>
          <div className="space-y-3 rounded-xl border border-dashed border-slate-700 bg-slate-950/20 p-5 text-sm text-slate-300">
            <p className="text-base font-semibold text-slate-100">What happens next?</p>
            <p>Kid Mode will show one task at a time with a giant Complete button.</p>
            <p>Progress sticks even if you refresh—timing and medals arrive in the next iteration.</p>
          </div>
        </div>
      )}
    </section>
  );
};

type KidModeProps = {
  session: Session;
  child: Child;
  progress: SessionProgressState[];
  onCompleteTask: (index: number) => void;
  onSkipTask: (index: number) => void;
  onReturnToParent: () => void;
  onEndSession: () => void;
};

const KidMode = ({ session, child, progress, onCompleteTask, onSkipTask, onReturnToParent, onEndSession }: KidModeProps) => {
  const totalTasks = session.tasks.length;
  const completedCount = progress.filter((state) => state.completed).length;
  const completionPercent = totalTasks === 0 ? 0 : Math.round((completedCount / totalTasks) * 100);
  const currentIndex = progress.findIndex((state) => !state.completed && !state.skipped);
  const sessionComplete = currentIndex === -1;
  const currentTask = sessionComplete ? null : session.tasks[currentIndex];
  const nextTaskIndex = session.tasks.findIndex((_, index) => index > currentIndex && !progress[index]?.completed && !progress[index]?.skipped);
  const nextTask = nextTaskIndex === -1 ? null : session.tasks[nextTaskIndex];

  return (
    <section className="rounded-3xl bg-gradient-to-br from-emerald-500/20 via-slate-900 to-slate-950 p-8 shadow-2xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-wide text-emerald-200">Kid Mode</p>
          <h2 className="text-3xl font-semibold text-slate-50">Good morning, {child.firstName}!</h2>
          <p className="text-slate-200">Today’s mission: {session.templateSnapshot.name}</p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onReturnToParent}
            className="rounded-lg border border-slate-300/40 px-4 py-2 text-base font-semibold text-slate-100 transition hover:border-slate-200"
          >
            Parent controls
          </button>
          <button
            type="button"
            onClick={onEndSession}
            className="rounded-lg bg-rose-500 px-4 py-2 text-base font-semibold text-slate-950 transition hover:bg-rose-400"
          >
            End session
          </button>
        </div>
      </div>
      <div className="mb-8 h-4 w-full rounded-full bg-slate-800">
        <div
          className="h-4 rounded-full bg-emerald-400 transition-all"
          style={{ width: `${completionPercent}%` }}
          aria-valuenow={completionPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          role="progressbar"
        />
      </div>
      {sessionComplete ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl bg-slate-950/60 p-10 text-center shadow-inner">
          <p className="text-5xl">🎉</p>
          <h3 className="text-3xl font-semibold text-emerald-200">All tasks complete!</h3>
          <p className="text-slate-200">Great job! Medals unlock in the next iteration.</p>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[2fr,1fr]">
          <div className="rounded-2xl bg-slate-950/70 p-8 shadow-inner">
            <p className="text-sm uppercase tracking-wide text-emerald-300">Current Task</p>
            <h3 className="mt-2 text-4xl font-bold text-slate-50">
              {currentTask?.emoji && <span className="mr-3">{currentTask.emoji}</span>}
              {currentTask?.title}
            </h3>
            <p className="mt-3 text-lg text-slate-200">
              {currentTask?.hint ?? 'Tap the big button when you finish!'}
            </p>
            <p className="mt-4 text-sm text-slate-400">Expected {currentTask?.expectedMinutes} minute(s)</p>
            <div className="mt-8 flex flex-wrap gap-4">
              <button
                type="button"
                onClick={() => currentIndex !== -1 && onCompleteTask(currentIndex)}
                className="flex-1 rounded-2xl bg-emerald-400 px-6 py-6 text-3xl font-bold text-slate-950 shadow-xl transition hover:bg-emerald-300"
              >
                Complete ✅
              </button>
              {session.allowSkip && (
                <button
                  type="button"
                  onClick={() => currentIndex !== -1 && onSkipTask(currentIndex)}
                  className="flex-1 rounded-2xl border-2 border-slate-500 bg-slate-900 px-6 py-6 text-2xl font-semibold text-slate-200 transition hover:border-slate-300"
                >
                  Skip ⏭️
                </button>
              )}
            </div>
          </div>
          <aside className="space-y-4">
            <div className="rounded-2xl bg-slate-950/50 p-6">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">Progress</p>
              <p className="mt-2 text-3xl font-bold text-emerald-200">
                {completedCount} / {totalTasks}
              </p>
              <p className="text-sm text-slate-400">Done so far</p>
            </div>
            <div className="rounded-2xl bg-slate-950/40 p-6">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">Up next</p>
              {nextTask ? (
                <p className="mt-2 text-lg text-slate-200">
                  {nextTask.emoji && <span className="mr-2 text-xl">{nextTask.emoji}</span>}
                  {nextTask.title}
                </p>
              ) : (
                <p className="mt-2 text-lg text-slate-200">You’re almost done!</p>
              )}
            </div>
            <div className="rounded-2xl bg-slate-950/40 p-6 text-sm text-slate-400">
              <p>Timing & medals unlock soon. For now, celebrate each win together!</p>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
};

export default App;
