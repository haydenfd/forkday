import { useState } from 'react';
import {
  Check,
  CircleAlert,
  Globe,
  LoaderCircle,
  Wand2,
  X,
} from 'lucide-react';
import type { AccountFormResult, Run } from '../../shared/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { isWorking, runSteps } from '@/lib/runs';
import { toast } from '@/lib/toast';
import { cn, errorMessage } from '@/lib/utils';

const progress = [
  { label: 'Open the job', steps: ['opening'] },
  { label: 'Sign in to Workday', steps: ['signing_in'] },
  { label: 'Fill the page', steps: ['filling'] },
  { label: 'Your review', steps: ['review', 'attention'] },
] as const;

/** Browser page: the live application on the left, the embedded page on the right. */
export default function Workspace({
  runs,
}: {
  runs: Run[];
}): React.JSX.Element {
  const active = runs.find((run) => run.step !== 'queued');
  const queued = runs.filter((run) => run.step === 'queued');
  return (
    <div className="grid min-h-0 flex-1 grid-cols-2">
      <main className="page-enter overflow-y-auto px-8 py-8">
        {active ? <ActiveRun run={active} /> : <ManualOpen />}
        {queued.length > 0 && (
          <section className="mt-8">
            <h2 className="eyebrow mb-3">Up next · {queued.length}</h2>
            <ol className="divide-y overflow-hidden rounded-xl border bg-card">
              {queued.map((run, index) => (
                <li key={run.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="w-5 text-sm tabular-nums text-muted-foreground">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{run.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {run.company}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground"
                    aria-label={`Remove ${run.title} from the line`}
                    title="Remove from the line"
                    onClick={() =>
                      void window.forkday
                        .finishRun(run.id, 'dequeue')
                        .catch((error: unknown) =>
                          toast(errorMessage(error), 'error'),
                        )
                    }
                  >
                    <X />
                  </Button>
                </li>
              ))}
            </ol>
          </section>
        )}
      </main>

      {/* Placeholder under the native browser view; visible until a page loads. */}
      <aside className="grid place-items-center border-l bg-card">
        <div className="flex flex-col items-center gap-3 text-center text-muted-foreground">
          {active ? (
            <LoaderCircle className="size-6 animate-spin stroke-[1.5]" />
          ) : (
            <Globe className="size-8 stroke-[1.5]" />
          )}
          <p className="text-sm">{active ? 'Loading page…' : 'No page open'}</p>
        </div>
      </aside>
    </div>
  );
}

function ActiveRun({ run }: { run: Run }): React.JSX.Element {
  const [pending, setPending] = useState<string>();
  const working = isWorking(run);
  const current = progress.findIndex((item) =>
    (item.steps as readonly string[]).includes(run.step),
  );
  const act = async (
    label: string,
    action: () => Promise<unknown>,
    done?: string,
  ): Promise<void> => {
    setPending(label);
    try {
      await action();
      if (done) toast(done);
    } catch (error) {
      toast(errorMessage(error), 'error');
    } finally {
      setPending(undefined);
    }
  };
  return (
    <section aria-labelledby="run-title" aria-busy={working}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{run.company}</p>
          <h1
            id="run-title"
            className="mt-0.5 break-words text-2xl font-semibold tracking-tight"
          >
            {run.title}
          </h1>
        </div>
        <Badge
          variant={runSteps[run.step].variant}
          dot={working ? 'pulse' : true}
          className="mt-1"
        >
          {runSteps[run.step].label}
        </Badge>
      </div>

      <ol className="mt-6 grid grid-cols-4 gap-2" aria-label="Progress">
        {progress.map((item, index) => {
          const state =
            index < current
              ? 'done'
              : index === current
                ? run.step === 'attention'
                  ? 'blocked'
                  : run.step === 'review'
                    ? 'done'
                    : 'current'
                : 'todo';
          return (
            <li key={item.label} className="min-w-0">
              <div
                className={cn(
                  'h-1 rounded-full bg-secondary transition-colors duration-300',
                  state === 'done' && 'bg-brand',
                  state === 'current' && 'animate-pulse bg-brand/60',
                  state === 'blocked' && 'bg-warning',
                )}
              />
              <p
                className={cn(
                  'mt-2 truncate text-xs text-muted-foreground',
                  (state === 'current' || state === 'blocked') &&
                    'text-foreground',
                )}
              >
                {item.label}
              </p>
            </li>
          );
        })}
      </ol>

      <div
        role="status"
        className={cn(
          'mt-6 flex gap-3 rounded-lg px-4 py-3 text-sm',
          run.step === 'attention'
            ? 'bg-warning-soft text-warning'
            : run.step === 'review'
              ? 'bg-success-soft text-success'
              : 'bg-secondary text-muted-foreground',
        )}
      >
        {working ? (
          <LoaderCircle
            aria-hidden
            className="mt-0.5 size-4 shrink-0 animate-spin"
          />
        ) : run.step === 'attention' ? (
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
        ) : (
          <Check aria-hidden className="mt-0.5 size-4 shrink-0" />
        )}
        <p>{run.detail}</p>
      </div>

      {run.missing.length > 0 && !working && (
        <div className="mt-4">
          <h2 className="eyebrow mb-2">Needs your answer</h2>
          <ul className="flex flex-wrap gap-1.5">
            {run.missing.map((label) => (
              <li
                key={label}
                className="rounded-md border px-2 py-1 text-xs text-muted-foreground"
              >
                {label}
              </li>
            ))}
          </ul>
        </div>
      )}
      {run.filled.length > 0 && (
        <details className="group mt-4 text-sm">
          <summary className="w-fit rounded text-muted-foreground hover:text-foreground">
            Filled {run.filled.length} field{run.filled.length === 1 ? '' : 's'}
          </summary>
          <p className="mt-2 text-muted-foreground">{run.filled.join(', ')}</p>
        </details>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={working || pending !== undefined}
          onClick={() =>
            void act('continue', () => window.forkday.continueRun(run.id))
          }
        >
          {working || pending === 'continue' ? (
            <LoaderCircle aria-hidden className="animate-spin" />
          ) : (
            <Wand2 aria-hidden />
          )}
          {working
            ? 'Working…'
            : run.step === 'attention'
              ? 'Continue'
              : 'Fill page'}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={working || pending !== undefined}
          onClick={() =>
            void act(
              'completed',
              () => window.forkday.finishRun(run.id, 'completed'),
              `Marked ${run.title} as applied.`,
            )
          }
        >
          <Check aria-hidden />I submitted it
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="text-muted-foreground"
          disabled={working || pending !== undefined}
          onClick={() =>
            void act(
              'stopped',
              () => window.forkday.finishRun(run.id, 'stopped'),
              `Stopped ${run.title}.`,
            )
          }
        >
          Stop
        </Button>
      </div>
      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        Forkday never submits for you. Check each page, use Save and Continue in
        the browser, then press Fill page on the next one.
      </p>
    </section>
  );
}

function ManualOpen(): React.JSX.Element {
  const [draft, setDraft] = useState('');
  const [pageUrl, setPageUrl] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [filling, setFilling] = useState(false);
  const [error, setError] = useState<string>();
  const [fillResult, setFillResult] = useState<AccountFormResult>();

  const openPage = async (): Promise<void> => {
    setLoading(true);
    setFillResult(undefined);
    setError(undefined);
    try {
      await window.forkday.openBrowser(draft);
      setPageUrl(draft);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const fillAccount = async (): Promise<void> => {
    setFilling(true);
    setError(undefined);
    setFillResult(undefined);
    try {
      setFillResult(await window.forkday.fillAccountForm());
    } catch (error) {
      const message = errorMessage(error);
      setError(
        message.includes('Add your email in Profile.')
          ? 'Add your email in Profile.'
          : message,
      );
    } finally {
      setFilling(false);
    }
  };

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Open a job</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Paste a job URL to load it in the browser on the right. To have Forkday
        fill it, use Apply in the Job queue or the browser extension.
      </p>

      <form
        className="mt-6 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void openPage();
        }}
      >
        <label className="sr-only" htmlFor="job-url">
          Job URL
        </label>
        <Input
          id="job-url"
          type="url"
          required
          maxLength={8192}
          placeholder="https://company.myworkdayjobs.com/…"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <Button type="submit" disabled={loading || filling || !draft.trim()}>
          {loading && <LoaderCircle aria-hidden className="animate-spin" />}
          {loading ? 'Opening…' : 'Open'}
        </Button>
      </form>

      <Card className="mt-8 p-5">
        <h2 className="font-semibold">Workday account</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Click Apply in the browser first. Saved credentials sign you in;
          otherwise Forkday creates an account using your Profile email.
        </p>
        <form
          className="mt-4"
          onSubmit={(event) => {
            event.preventDefault();
            void fillAccount();
          }}
        >
          <Button
            type="submit"
            variant="outline"
            disabled={!pageUrl || loading || filling}
          >
            {filling && <LoaderCircle aria-hidden className="animate-spin" />}
            {filling ? 'Signing in…' : 'Create Account / Sign In'}
          </Button>
        </form>
        {fillResult && (
          <p role="status" className="mt-4 text-sm text-muted-foreground">
            Page: {fillResult.page}. Filled:{' '}
            {fillResult.filled.join(', ') || 'none'}.
            {fillResult.submission === 'submitted' &&
              ' Account form submitted. Continue in the browser.'}
            {fillResult.submission === 'failed' &&
              ' Sign-in was not completed. Review the browser for errors or verification.'}
          </p>
        )}
      </Card>

      {error && (
        <p
          className="mt-4 rounded-lg bg-destructive-soft px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      )}
    </>
  );
}
