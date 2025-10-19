import { defaultFeatureFlags } from '@shared/flags';

const App = () => {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 p-8 text-center text-slate-50">
      <h1 className="text-4xl font-semibold tracking-tight">Klar Parat</h1>
      <p className="text-lg uppercase text-emerald-400">OK</p>
      <section className="rounded-lg bg-slate-900/60 p-4 shadow-lg">
        <h2 className="mb-2 text-sm font-medium text-slate-300">Feature Flags (defaults)</h2>
        <ul className="space-y-1 text-left text-xs text-slate-200">
          {Object.entries(defaultFeatureFlags).map(([flag, value]) => (
            <li key={flag}>
              <span className="font-semibold">{flag}:</span> {value ? 'on' : 'off'}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
};

export default App;
