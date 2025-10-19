import { useEffect, useState } from "react";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

function App() {
  const [apiStatus, setApiStatus] = useState<string>("Loading...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    fetch(`${apiBaseUrl}/health`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Unexpected status ${response.status}`);
        }
        const text = await response.text();
        if (isActive) {
          setApiStatus(text);
        }
      })
      .catch((err: Error) => {
        if (isActive) {
          setError(err.message);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-md rounded-3xl bg-white p-10 text-center shadow-2xl">
          <h1 className="text-3xl font-extrabold tracking-tight">Klar Parat</h1>
          <p className="mt-6 text-xl font-semibold text-emerald-600">Web App: OK</p>
          <p className="mt-2 text-lg font-medium">
            API: {error ? `Error — ${error}` : apiStatus}
          </p>
        </div>
      </div>
    </main>
  );
}

export default App;
