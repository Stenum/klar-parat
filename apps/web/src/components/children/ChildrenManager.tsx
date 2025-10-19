import type { Child } from '@shared/schemas';
import type { FC, FormEvent } from 'react';
import { useCallback, useEffect, useState } from 'react';

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

export const ChildrenManager: FC = () => {
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<ChildFormState>(createInitialChildForm());

  const fetchChildren = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    void fetchChildren();
  }, [fetchChildren]);

  const resetForm = useCallback(() => setForm(createInitialChildForm()), []);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
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
        setForm((prev) => ({
          ...prev,
          error: err instanceof Error ? err.message : 'Failed to save child.'
        }));
      }
    },
    [fetchChildren, form.active, form.birthdate, form.firstName, form.id, resetForm]
  );

  const handleEdit = useCallback((child: Child) => {
    setForm({
      id: child.id,
      firstName: child.firstName,
      birthdate: child.birthdate,
      active: child.active,
      error: null
    });
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
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
    },
    [fetchChildren]
  );

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
              <article key={child.id} className="flex items-center justify-between rounded-xl bg-slate-950/40 p-5 shadow">
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
