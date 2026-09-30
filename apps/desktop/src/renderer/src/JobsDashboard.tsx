import { useEffect, useState } from 'react';
import { Settings as SettingsIcon } from 'lucide-react';

import type { Job } from '../../shared/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Monogram } from '@/components/ui/monogram';
import { cn } from '@/lib/utils';
import Settings from './Settings';

// Parked: the job queue UI. Not rendered right now (App shows the single
// URL + browser split instead). Render <JobsDashboard /> from main.tsx to restore.

// ponytail: hash routes, swap for TanStack Router once there are more pages
const SETTINGS_ROUTE = '#/settings';

export default function JobsDashboard(): React.JSX.Element {
  const [route, setRoute] = useState(location.hash);
  const [jobUrl, setJobUrl] = useState('');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [jobBusy, setJobBusy] = useState(false);
  const [jobError, setJobError] = useState<string>();
  const selected = jobs.find((job) => job.id === selectedId);
  const active = jobs.find((job) => isLive(job.status));
  const browserVisible = selected && isLive(selected.status);
  const queued = jobs.filter((job) => job.status === 'queued');
  const finished = jobs.filter(
    (job) => job.status === 'completed' || job.status === 'failed',
  );

  useEffect(() => {
    let disposed = false;
    const refreshJobs = async (): Promise<void> => {
      try {
        const next = await window.forkday.listJobs();
        if (!disposed) setJobs(next);
      } catch (error) {
        if (!disposed) setJobError(errorMessage(error));
      }
    };
    void refreshJobs();
    const timer = setInterval(() => void refreshJobs(), 1000);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, []);

  const addJob = async (): Promise<void> => {
    setJobBusy(true);
    setJobError(undefined);
    try {
      setJobs(await window.forkday.addJob(jobUrl));
      setJobUrl('');
    } catch (error) {
      setJobError(errorMessage(error));
    } finally {
      setJobBusy(false);
    }
  };

  const showJob = async (id: string): Promise<void> => {
    try {
      await window.forkday.showJob(id);
      setSelectedId(id);
      setJobError(undefined);
    } catch (error) {
      setJobError(errorMessage(error));
    }
  };

  const showDashboard = async (): Promise<void> => {
    try {
      await window.forkday.showDashboard();
      setSelectedId(undefined);
      setJobError(undefined);
    } catch (error) {
      setJobError(errorMessage(error));
    }
  };

  // Any navigation leaves the job workspace and hides the embedded browser.
  useEffect(() => {
    const onHashChange = (): void => {
      setRoute(location.hash);
      void showDashboard();
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const completeJob = async (): Promise<void> => {
    if (!selected) return;
    setJobBusy(true);
    try {
      setJobs(await window.forkday.completeJob(selected.id));
      setSelectedId(undefined);
    } catch (error) {
      setJobError(errorMessage(error));
    } finally {
      setJobBusy(false);
    }
  };

  const onSettings = route === SETTINGS_ROUTE;

  return (
    <div className={cn('min-h-screen', browserVisible ? 'w-1/2' : 'w-full')}>
      <nav className="sticky top-0 z-10 flex h-14 items-center justify-between border-b bg-card/80 px-8 backdrop-blur">
        <a href="#/" className="text-lg font-semibold tracking-tight">
          forkday
        </a>
        <Button
          asChild
          variant="ghost"
          size="icon"
          className={cn(
            'text-muted-foreground',
            onSettings && 'bg-secondary text-foreground',
          )}
        >
          <a
            href={SETTINGS_ROUTE}
            aria-label="Settings"
            aria-current={onSettings ? 'page' : undefined}
          >
            <SettingsIcon />
          </a>
        </Button>
      </nav>

      <main className="@container px-8 py-8">
        {onSettings ? (
          <Settings />
        ) : selected ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              className="-ml-3 text-muted-foreground"
              onClick={() => void showDashboard()}
            >
              ← All jobs
            </Button>
            <Card className="mt-4 p-6">
              <div className="flex items-start justify-between gap-4">
                <Monogram name={selected.title} />
                <Badge
                  variant={jobStatusVariant(selected.status)}
                  dot={isLive(selected.status) && 'pulse'}
                >
                  {statusLabel(selected.status)}
                </Badge>
              </div>
              <p className="eyebrow mt-6">Application workspace</p>
              <h1 className="mt-2 break-words text-2xl font-semibold tracking-tight">
                {selected.title}
              </h1>
              <p className="mt-2 break-all text-sm text-muted-foreground">
                {selected.url}
              </p>
              <div className="mt-6 rounded-lg bg-secondary px-4 py-3 text-sm">
                {selected.status === 'opening' && (
                  <p role="status">Opening the job page…</p>
                )}
                {selected.status === 'running' && (
                  <p>
                    Continue your application in the browser. Mark it complete
                    when you finish.
                  </p>
                )}
                {selected.status === 'queued' && (
                  <p>Waiting for the current application to finish.</p>
                )}
                {selected.status === 'completed' && (
                  <p>This application was marked complete.</p>
                )}
                {selected.status === 'failed' && (
                  <p>This application failed.</p>
                )}
              </div>
              {selected.error && (
                <p className="mt-4 rounded-lg bg-destructive-soft px-4 py-3 text-sm text-destructive">
                  {selected.error}
                </p>
              )}
              {selected.status === 'running' && (
                <Button
                  type="button"
                  className="mt-6"
                  disabled={jobBusy}
                  onClick={() => void completeJob()}
                >
                  Mark complete
                </Button>
              )}
            </Card>
            {active && active.id !== selected.id && (
              <Button
                variant="outline"
                type="button"
                className="mt-4"
                onClick={() => void showJob(active.id)}
              >
                View active application →
              </Button>
            )}
          </>
        ) : (
          <div className="grid items-start gap-10 @5xl:grid-cols-2">
            <div>
              <header>
                <h1 className="text-2xl font-semibold tracking-tight">
                  Your applications
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  One active application at a time. Everything else waits in
                  your queue.
                </p>
              </header>

              <form
                className="mt-6 flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void addJob();
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
                  placeholder="Paste a job URL, e.g. https://company.myworkdayjobs.com/…"
                  value={jobUrl}
                  onChange={(event) => setJobUrl(event.target.value)}
                />
                <Button type="submit" disabled={jobBusy || !jobUrl.trim()}>
                  {jobBusy ? 'Adding…' : 'Add job'}
                </Button>
              </form>

              <section className="mt-10">
                <h2 className="eyebrow mb-3">Active application</h2>
                {active ? (
                  <Card className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <Monogram name={active.title} />
                      <Badge
                        variant={jobStatusVariant(active.status)}
                        dot="pulse"
                      >
                        {statusLabel(active.status)}
                      </Badge>
                    </div>
                    <h3 className="mt-4 break-words text-xl font-semibold tracking-tight">
                      {active.title}
                    </h3>
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      {active.url}
                    </p>
                    <Button
                      type="button"
                      className="mt-6"
                      onClick={() => void showJob(active.id)}
                    >
                      Open workspace
                    </Button>
                  </Card>
                ) : (
                  <p className="rounded-xl border border-dashed px-6 py-8 text-center text-sm text-muted-foreground">
                    No application running. Add a job to start one.
                  </p>
                )}
              </section>
            </div>

            <div className="flex flex-col gap-10">
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="eyebrow">Up next</h2>
                  <span className="text-xs font-medium text-muted-foreground">
                    {queued.length} queued
                  </span>
                </div>
                {queued.length === 0 ? (
                  <p className="rounded-xl border border-dashed px-6 py-8 text-center text-sm text-muted-foreground">
                    Nothing waiting.
                  </p>
                ) : (
                  <Card className="divide-y overflow-hidden">
                    {queued.map((job) => (
                      <JobRow key={job.id} job={job} onOpen={showJob} />
                    ))}
                  </Card>
                )}
              </section>

              {finished.length > 0 && (
                <section>
                  <h2 className="eyebrow mb-3">Recent results</h2>
                  <Card className="divide-y overflow-hidden">
                    {finished.map((job) => (
                      <JobRow key={job.id} job={job} onOpen={showJob} />
                    ))}
                  </Card>
                </section>
              )}
            </div>
          </div>
        )}
        {jobError && (
          <p
            className="mt-6 rounded-lg bg-destructive-soft px-4 py-3 text-sm text-destructive"
            role="alert"
          >
            {jobError}
          </p>
        )}
      </main>
    </div>
  );
}

function JobRow({
  job,
  onOpen,
}: {
  job: Job;
  onOpen: (id: string) => Promise<void>;
}): React.JSX.Element {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-secondary/60 focus-visible:bg-secondary focus-visible:outline-none"
      onClick={() => void onOpen(job.id)}
    >
      <Monogram name={job.title} />
      <span className="flex min-w-0 flex-1 flex-col">
        <strong className="font-medium">{job.title}</strong>
        <span className="truncate text-xs text-muted-foreground">
          {job.url}
        </span>
      </span>
      <Badge
        variant={jobStatusVariant(job.status)}
        dot={isLive(job.status) && 'pulse'}
      >
        {statusLabel(job.status)}
      </Badge>
    </button>
  );
}

function isLive(status: Job['status']): boolean {
  return status === 'running' || status === 'opening';
}

function jobStatusVariant(
  status: Job['status'],
): 'active' | 'warning' | 'success' | 'destructive' | 'secondary' {
  return (
    {
      queued: 'secondary',
      opening: 'warning',
      running: 'active',
      completed: 'success',
      failed: 'destructive',
    } as const
  )[status];
}

function statusLabel(status: Job['status']): string {
  return {
    queued: 'Queued',
    opening: 'Opening',
    running: 'Active',
    completed: 'Completed',
    failed: 'Failed',
  }[status];
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
