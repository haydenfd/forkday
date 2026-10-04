import { useEffect, useState } from 'react';
import { ArrowRight, Inbox } from 'lucide-react';
import type { Application } from '../../shared/applications';
import type { Run } from '../../shared/contracts';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Monogram } from '@/components/ui/monogram';
import { isWorking, runSteps } from '@/lib/runs';
import { errorMessage, timeAgo } from '@/lib/utils';

const finished = {
  completed: 'success',
  rejected: 'destructive',
  stopped: 'secondary',
} as const;

export default function Tasks({ runs }: { runs: Run[] }): React.JSX.Element {
  const [applications, setApplications] = useState<Application[]>();
  const [error, setError] = useState<string>();
  // Runs change application statuses; reload when one finishes or starts.
  const runKey = runs.map((run) => run.id).join();
  useEffect(() => {
    void window.forkday
      .listApplications()
      .then(setApplications)
      .catch((error: unknown) => setError(errorMessage(error)));
  }, [runKey]);
  const items = applications ?? [];
  const current = items
    .filter((item) => ['continuing', 'waiting'].includes(item.status))
    .sort(
      (a, b) =>
        Number(b.status === 'continuing') - Number(a.status === 'continuing') ||
        b.updatedAt.localeCompare(a.updatedAt),
    );
  const past = items
    .filter((item) => !['waiting', 'continuing'].includes(item.status))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const active = current.filter((item) => item.status === 'continuing').length;
  const waiting = current.length - active;

  return (
    <section className="mx-auto w-full max-w-6xl">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {!applications
            ? 'Loading your applications…'
            : current.length
              ? [
                  active && `${active} in progress`,
                  waiting && `${waiting} waiting`,
                ]
                  .filter(Boolean)
                  .join(' · ')
              : 'Nothing in progress.'}
        </p>
      </header>
      {error && (
        <p
          role="alert"
          className="mb-6 rounded-lg bg-destructive-soft px-4 py-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      <SectionHeader title="Current" href="#/queue" link="Open queue" />
      <div className="grid gap-3 @3xl:grid-cols-2">
        {!applications &&
          [0, 1].map((key) => <div key={key} className="skeleton h-32" />)}
        {current.slice(0, 6).map((item) => {
          const run = runs.find((run) => run.id === item.id);
          return (
            <a
              key={item.id}
              href={
                run && run.step !== 'queued'
                  ? '#/browser'
                  : `#/queue/${item.id}`
              }
              className="card-link group flex flex-col rounded-xl border bg-card p-5 shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <div className="flex items-start gap-3">
                <Monogram name={item.company} />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold">{item.title}</h3>
                  <p className="truncate text-sm text-muted-foreground">
                    {item.company}
                  </p>
                </div>
                {run ? (
                  <Badge
                    variant={runSteps[run.step].variant}
                    dot={isWorking(run) ? 'pulse' : true}
                  >
                    {runSteps[run.step].label}
                  </Badge>
                ) : (
                  <Badge
                    variant={
                      item.status === 'continuing' ? 'active' : 'warning'
                    }
                  >
                    {item.status === 'continuing' ? 'Continuing' : 'Waiting'}
                  </Badge>
                )}
              </div>
              <p className="mt-4 line-clamp-2 flex-1 text-sm text-muted-foreground">
                {run && run.step !== 'queued'
                  ? run.detail
                  : item.notes || 'No notes yet.'}
              </p>
              <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                <span>Updated {timeAgo(item.updatedAt)}</span>
                <ArrowRight
                  aria-hidden
                  className="size-4 -translate-x-1 opacity-0 transition duration-150 group-hover:translate-x-0 group-hover:opacity-100"
                />
              </div>
            </a>
          );
        })}
        {applications && !current.length && (
          <Card className="grid justify-items-center gap-2 border-dashed px-6 py-12 text-center @3xl:col-span-2">
            <Inbox aria-hidden className="mb-1 size-7 text-muted-foreground" />
            <p className="font-medium">No current tasks</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Click Apply with Forkday on a Workday job, or{' '}
              <a href="#/queue" className="text-brand hover:underline">
                add a job to the queue
              </a>
              .
            </p>
          </Card>
        )}
      </div>

      <div className="mt-10">
        <SectionHeader
          title="Recently processed"
          href="#/queue/history"
          link="See all"
        />
      </div>
      <Card className="overflow-hidden">
        {past.length ? (
          <ul className="divide-y">
            {past.slice(0, 5).map((item) => (
              <li key={item.id}>
                <a
                  href={`#/queue/${item.id}`}
                  aria-label={`View ${item.title}`}
                  className="group flex items-center gap-4 px-5 py-3.5 hover:bg-secondary/50 focus-visible:bg-secondary/50 focus-visible:outline-none"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.company}
                      {item.notes && ` · ${item.notes}`}
                    </p>
                  </div>
                  <Badge
                    variant={finished[item.status as keyof typeof finished]}
                  >
                    {item.status[0].toUpperCase() + item.status.slice(1)}
                  </Badge>
                  <span className="w-24 text-right text-xs text-muted-foreground">
                    {timeAgo(item.updatedAt)}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            {applications ? 'Finished applications show up here.' : 'Loading…'}
          </p>
        )}
      </Card>
    </section>
  );
}

function SectionHeader({
  title,
  href,
  link,
}: {
  title: string;
  href: string;
  link: string;
}): React.JSX.Element {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="eyebrow">{title}</h2>
      <a
        href={href}
        className="group inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        {link}
        <ArrowRight
          aria-hidden
          className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5"
        />
      </a>
    </div>
  );
}
