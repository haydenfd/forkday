import { StrictMode, useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

import type {
  InvocationRecord,
  ModelResponse,
  ProviderHealth,
} from '../../shared/contracts';
import './styles.css';

function App(): React.JSX.Element {
  const [health, setHealth] = useState<ProviderHealth>();
  const [history, setHistory] = useState<InvocationRecord[]>([]);
  const [result, setResult] = useState<string>();
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async (): Promise<void> => {
    setBusy(true);
    setResult(undefined);
    try {
      const [nextHealth, nextHistory] = await Promise.all([
        window.forkday.getProviderStatus(),
        window.forkday.getRecentInvocations(),
      ]);
      setHealth(nextHealth);
      setHistory(nextHistory);
    } catch (error) {
      setResult(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const testProvider = async (): Promise<void> => {
    setBusy(true);
    setResult(undefined);
    try {
      const response: ModelResponse = await window.forkday.testProvider();
      setResult(response.message);
    } catch (error) {
      setResult(errorMessage(error));
    } finally {
      setHistory(await window.forkday.getRecentInvocations());
      setBusy(false);
    }
  };

  const authenticate = async (): Promise<void> => {
    setBusy(true);
    try {
      const launch = await window.forkday.authenticate();
      setResult(launch.message);
    } catch (error) {
      setResult(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main>
      <header>
        <span className="eyebrow">Local desktop shell</span>
        <h1>Forkday</h1>
        <p>Provider: Codex</p>
      </header>

      <section className="card" aria-busy={!health || busy}>
        <div className="section-heading">
          <h2>Provider status</h2>
          <span
            className={`status-dot ${health?.authenticated ? 'ready' : ''}`}
          />
        </div>
        <dl>
          <Status label="Installed" value={yesNo(health?.installed)} />
          <Status label="Authenticated" value={yesNo(health?.authenticated)} />
          <Status label="CLI version" value={health?.version ?? '—'} />
          <Status label="Auth method" value={health?.authMethod ?? '—'} />
        </dl>
        {health?.error && <p className="notice error">{health.error}</p>}
        <p className="notice">
          {health?.usageInformation ?? 'Checking Codex…'}
        </p>
        <div className="actions">
          <button type="button" onClick={() => void refresh()} disabled={busy}>
            Check again
          </button>
          {health?.installed && !health.authenticated && (
            <button
              type="button"
              onClick={() => void authenticate()}
              disabled={busy}
            >
              Authenticate
            </button>
          )}
          <button
            className="primary"
            type="button"
            onClick={() => void testProvider()}
            disabled={busy || !health?.authenticated}
          >
            Test Codex
          </button>
        </div>
        {result && <p className="result">{result}</p>}
      </section>

      <section className="card">
        <h2>Recent calls</h2>
        {history.length === 0 ? (
          <p className="empty">No local invocations yet.</p>
        ) : (
          <ul className="history">
            {history.map((record) => (
              <li key={`${record.timestamp}-${record.durationMs}`}>
                <div>
                  <strong>{record.success ? 'Succeeded' : 'Failed'}</strong>
                  <span>{new Date(record.timestamp).toLocaleString()}</span>
                </div>
                <div className="history-meta">
                  <span>{record.durationMs} ms</span>
                  {record.errorType && <span>{record.errorType}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function Status({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.JSX.Element {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function yesNo(value: boolean | undefined): string {
  return value === undefined ? 'Checking…' : value ? 'Yes' : 'No';
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
