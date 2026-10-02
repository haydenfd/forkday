import { useCallback, useEffect, useState } from 'react';

import type { ModelResponse, ProviderHealth } from '../../shared/contracts';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function CodexSettings(): React.JSX.Element {
  const [health, setHealth] = useState<ProviderHealth>();
  const [result, setResult] = useState<string>();
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async (): Promise<void> => {
    setBusy(true);
    setResult(undefined);
    try {
      setHealth(await window.forkday.getProviderStatus());
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
      <div className="max-w-2xl">
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
              <p
                role="status"
                className="mt-4 rounded-lg bg-secondary px-4 py-3 text-sm"
              >
                {result}
              </p>
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
