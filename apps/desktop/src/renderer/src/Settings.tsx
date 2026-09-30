import { useCallback, useEffect, useState } from 'react';

import type {
  InvocationRecord,
  ModelResponse,
  ProviderHealth,
} from '../../shared/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function Settings(): React.JSX.Element {
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
      setHistory(await window.forkday.getRecentInvocations());
    } catch (error) {
      setResult(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const authenticate = async (): Promise<void> => {
    setBusy(true);
    try {
      setResult((await window.forkday.authenticate()).message);
    } catch (error) {
      setResult(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connections Forkday uses on this computer.
        </p>
      </header>

      <Button asChild variant="outline" className="mt-6">
        <a href="#/profile">Profile</a>
      </Button>

      <div className="mt-8 grid gap-6 @5xl:grid-cols-2">
        <section>
          <h2 className="eyebrow mb-3">Codex connection</h2>
          <Card className="p-6" aria-busy={!health || busy}>
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-base font-semibold tracking-tight">
                Provider status
              </h3>
              <span
                aria-hidden
                className={cn(
                  'size-2 rounded-full bg-border',
                  health?.authenticated && 'bg-success',
                )}
              />
            </div>
            <dl className="mt-2 divide-y">
              <Status label="Installed" value={yesNo(health?.installed)} />
              <Status
                label="Authenticated"
                value={yesNo(health?.authenticated)}
              />
              <Status label="CLI version" value={health?.version ?? '—'} />
              <Status label="Auth method" value={health?.authMethod ?? '—'} />
            </dl>
            {health?.error && (
              <p className="mt-4 rounded-lg bg-destructive-soft px-4 py-3 text-sm text-destructive">
                {health.error}
              </p>
            )}
            <p className="mt-4 rounded-lg bg-secondary px-4 py-3 text-sm text-muted-foreground">
              {health?.usageInformation ?? 'Checking Codex…'}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                variant="outline"
                type="button"
                onClick={() => void refresh()}
                disabled={busy}
              >
                Check again
              </Button>
              {health?.installed && !health.authenticated && (
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => void authenticate()}
                  disabled={busy}
                >
                  Authenticate
                </Button>
              )}
              <Button
                type="button"
                onClick={() => void testProvider()}
                disabled={busy || !health?.authenticated}
              >
                Test Codex
              </Button>
            </div>
            {result && (
              <p className="mt-4 rounded-lg bg-secondary px-4 py-3 text-sm">
                {result}
              </p>
            )}
          </Card>
        </section>

        <section>
          <h2 className="eyebrow mb-3">Recent calls</h2>
          <Card className="px-6 py-2">
            {history.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">
                No local invocations yet.
              </p>
            ) : (
              <ul className="list-none divide-y p-0">
                {history.map((record) => (
                  <li
                    className="flex items-center justify-between py-3 text-sm"
                    key={`${record.timestamp}-${record.durationMs}`}
                  >
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={record.success ? 'success' : 'destructive'}
                      >
                        {record.success ? 'Succeeded' : 'Failed'}
                      </Badge>
                      <span className="text-muted-foreground">
                        {new Date(record.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex flex-col items-end text-xs text-muted-foreground">
                      <span>{record.durationMs} ms</span>
                      {record.errorType && <span>{record.errorType}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>
      </div>
    </>
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
    <div className="grid grid-cols-2 gap-5 py-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

function yesNo(value: boolean | undefined): string {
  return value === undefined ? 'Checking…' : value ? 'Yes' : 'No';
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
