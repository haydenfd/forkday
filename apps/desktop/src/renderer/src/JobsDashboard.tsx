import { useEffect, useState } from 'react';
import {
  ClipboardList,
  ExternalLink,
  LoaderCircle,
  Plus,
  Search,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import {
  type Application,
  type ApplicationStatus,
} from '../../shared/applications';
import type { Run } from '../../shared/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Monogram } from '@/components/ui/monogram';
import { Select } from '@/components/ui/select';
import { isWorking, runSteps } from '@/lib/runs';
import { toast } from '@/lib/toast';
import { cn, errorMessage, timeAgo } from '@/lib/utils';
import { useUnsavedChanges } from '@/lib/useUnsavedChanges';

const statuses = [
  {
    id: 'waiting',
    label: 'Waiting',
    description: 'Saved jobs you plan to apply to.',
  },
  {
    id: 'continuing',
    label: 'Continuing',
    description: 'Applications in progress or awaiting a response.',
  },
  {
    id: 'rejected',
    label: 'Rejected',
    description: 'Applications that did not move forward.',
  },
  {
    id: 'completed',
    label: 'Completed',
    description: 'Finished applications.',
  },
  {
    id: 'stopped',
    label: 'Stopped',
    description: 'Applications paused or stopped by you.',
  },
] as const;

const isWorkday = (url: string): boolean =>
  /^https:\/\/[^/]+\.myworkdayjobs\.com\//.test(url);

export default function JobsDashboard({
  route,
  runs,
}: {
  route: string;
  runs: Run[];
}): React.JSX.Element {
  const [applications, setApplications] = useState<Application[]>([]);
  const [filter, setFilter] = useState<ApplicationStatus | 'history'>(
    'waiting',
  );
  const [search, setSearch] = useState('');
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [selectedId, setSelectedId] = useState<string>();
  const [notes, setNotes] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);
  const selected = applications.find((item) => item.id === selectedId);
  const notesDirty = Boolean(selected && notes !== selected.notes);
  useUnsavedChanges(notesDirty);
  const canDiscardNotes = (): boolean =>
    !notesDirty || window.confirm('Discard your unsaved application notes?');
  const query = search.trim().toLowerCase();
  const visible = applications.filter(
    (item) =>
      (item.status === filter ||
        (filter === 'history' &&
          !['waiting', 'continuing'].includes(item.status))) &&
      `${item.title} ${item.company} ${item.url}`.toLowerCase().includes(query),
  );
  const heading =
    filter === 'history'
      ? {
          label: 'Past processed',
          description: 'Everything you have finished.',
        }
      : statuses.find((item) => item.id === filter)!;
  // Runs move applications between statuses; refresh when they change.
  const runKey = runs.map((run) => `${run.id}:${run.step}`).join();

  useEffect(() => {
    void window.forkday
      .listApplications()
      .then(setApplications)
      .catch((error: unknown) => setError(errorMessage(error)))
      .finally(() => setLoaded(true));
  }, [runKey]);

  useEffect(() => {
    void window.forkday.listApplications().then((items) => {
      const requested = route.split('/')[2];
      const selected = items.find((item) => item.id === requested);
      if (selected) {
        setSelectedId(selected.id);
        setNotes(selected.notes);
        setFilter(selected.status);
      } else if (requested === 'history') setFilter('history');
      else if (statuses.some((status) => status.id === requested))
        setFilter(requested as ApplicationStatus);
    });
  }, [route]);

  const select = (application?: Application): void => {
    if (application?.id === selectedId || !canDiscardNotes()) return;
    setSelectedId(application?.id);
    setNotes(application?.notes ?? '');
    setConfirmRemove(false);
  };

  const add = async (): Promise<void> => {
    setBusy(true);
    setError(undefined);
    try {
      setApplications(
        await window.forkday.addApplication({
          url: url.trim(),
          title,
          company,
        }),
      );
      setUrl('');
      setTitle('');
      setCompany('');
      setFilter('waiting');
      setSearch('');
      toast('Job added to Waiting.');
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  const update = async (
    id: string,
    patch: { status?: ApplicationStatus; notes?: string },
  ): Promise<void> => {
    setBusy(true);
    setError(undefined);
    try {
      setApplications(await window.forkday.updateApplication({ id, ...patch }));
      if (patch.status) {
        setFilter(patch.status);
        setSelectedId(undefined);
        toast(
          `Moved to ${statuses.find((item) => item.id === patch.status)?.label}.`,
        );
      } else toast('Notes saved.');
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  const remove = async (application: Application): Promise<void> => {
    setBusy(true);
    try {
      setApplications(await window.forkday.removeApplication(application.id));
      setSelectedId(undefined);
      toast(`Removed ${application.title}.`);
    } catch (error) {
      toast(errorMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  };
  const apply = async (application: Application): Promise<void> => {
    try {
      await window.forkday.startRun(application.id);
      toast(`${application.title} is in line. Follow it in Browser.`);
    } catch (error) {
      toast(errorMessage(error), 'error');
    }
  };

  return (
    <section className="mx-auto w-full max-w-6xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Job queue</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Save jobs, let Forkday fill Workday applications, and track every
          response.
        </p>
      </header>

      <Card className="mb-8 p-5">
        <form
          className="grid gap-4 @4xl:grid-cols-[2fr_1fr_1fr_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            void add();
          }}
        >
          <div className="space-y-2">
            <label className="block text-sm font-medium" htmlFor="queue-url">
              Job URL *
            </label>
            <Input
              id="queue-url"
              type="url"
              required
              maxLength={8192}
              placeholder="https://company.myworkdayjobs.com/…"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              disabled={busy}
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium" htmlFor="queue-title">
              Job title
            </label>
            <Input
              id="queue-title"
              placeholder="Software engineer"
              maxLength={500}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              disabled={busy}
            />
          </div>
          <div className="space-y-2">
            <label
              className="block text-sm font-medium"
              htmlFor="queue-company"
            >
              Company
            </label>
            <Input
              id="queue-company"
              placeholder="Company name"
              maxLength={500}
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              disabled={busy}
            />
          </div>
          <Button
            type="submit"
            className="self-end"
            disabled={busy || !url.trim()}
          >
            <Plus />
            Add job
          </Button>
        </form>
      </Card>

      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div
          className="flex gap-0.5 rounded-lg border bg-card p-0.5"
          role="group"
          aria-label="Filter applications by status"
        >
          {statuses.map(({ id, label }) => {
            const count = applications.filter(
              (item) => item.status === id,
            ).length;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={filter === id}
                onClick={() => {
                  if (!canDiscardNotes()) return;
                  setFilter(id);
                  setSelectedId(undefined);
                }}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-1 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
                  filter === id && 'bg-secondary text-foreground',
                )}
              >
                {label}
                <span className="min-w-4 text-xs tabular-nums text-muted-foreground">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        <div className="relative w-full sm:w-72">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground"
          />
          <Input
            type="search"
            aria-label="Search applications"
            placeholder="Search title or company"
            className="pl-9"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>
      <div className="mb-4">
        <h2 className="text-lg font-semibold">{heading.label}</h2>
        <p className="text-sm text-muted-foreground">{heading.description}</p>
      </div>
      {error && (
        <p
          role="alert"
          className="mb-4 rounded-lg bg-destructive-soft px-4 py-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      <div
        className={cn(
          'grid items-start gap-5',
          selected && '@4xl:grid-cols-[3fr_2fr]',
        )}
      >
        <div className="space-y-2">
          {!loaded ? (
            [0, 1, 2].map((key) => <div key={key} className="skeleton h-24" />)
          ) : visible.length === 0 ? (
            <Card className="grid justify-items-center gap-2 border-dashed px-6 py-12 text-center">
              <ClipboardList
                aria-hidden
                className="mb-1 size-7 text-muted-foreground"
              />
              <h3 className="font-medium">
                {search
                  ? 'No matching applications'
                  : `No ${heading.label.toLowerCase()} jobs yet`}
              </h3>
              <p className="max-w-md text-sm text-muted-foreground">
                {search
                  ? 'Try another title or company.'
                  : filter === 'waiting'
                    ? 'Paste a job URL above, or click Apply with Forkday on a Workday job.'
                    : 'Applications show up here when their status changes.'}
              </p>
            </Card>
          ) : (
            visible.map((application) => {
              const run = runs.find((item) => item.id === application.id);
              const canApply =
                !run &&
                isWorkday(application.url) &&
                ['waiting', 'continuing', 'stopped'].includes(
                  application.status,
                );
              return (
                <Card
                  key={application.id}
                  onClick={(event) => {
                    // Whole card opens details; its own controls keep their clicks.
                    if (
                      !(event.target as HTMLElement).closest(
                        'button, a, [role=combobox], [role=listbox]',
                      )
                    )
                      select(application);
                  }}
                  className={cn(
                    'card-link cursor-pointer p-4',
                    selectedId === application.id &&
                      'border-brand hover:border-brand',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Monogram name={application.company} />
                    <div className="min-w-0 flex-1">
                      <h3 className="break-words font-semibold">
                        {application.title}
                      </h3>
                      <p className="truncate text-sm text-muted-foreground">
                        {application.company} · Updated{' '}
                        {timeAgo(application.updatedAt)}
                      </p>
                    </div>
                    <Select
                      aria-label={`Status for ${application.title}`}
                      className="w-36"
                      value={application.status}
                      disabled={busy || Boolean(run)}
                      options={statuses.map(({ id, label }) => ({
                        value: id,
                        label,
                      }))}
                      onValueChange={(value) => {
                        if (canDiscardNotes())
                          void update(application.id, {
                            status: value as ApplicationStatus,
                          });
                      }}
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 pl-12">
                    {run ? (
                      <a
                        href="#/browser"
                        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                      >
                        <Badge
                          variant={runSteps[run.step].variant}
                          dot={isWorking(run) ? 'pulse' : true}
                        >
                          {runSteps[run.step].label}
                        </Badge>
                        <span className="line-clamp-1">{run.detail}</span>
                      </a>
                    ) : (
                      canApply && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => void apply(application)}
                        >
                          <Wand2 />
                          Apply with Forkday
                        </Button>
                      )
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground"
                      onClick={() => select(application)}
                    >
                      View details
                    </Button>
                  </div>
                </Card>
              );
            })
          )}
        </div>
        {selected && (
          <Card
            key={selected.id}
            className="slide-in sticky top-0 p-5"
            aria-label={`${selected.title} details`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="break-words text-lg font-semibold">
                  {selected.title}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {selected.company}
                </p>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="-mr-2 -mt-1 shrink-0 text-muted-foreground"
                aria-label="Close"
                onClick={() => {
                  if (canDiscardNotes()) setSelectedId(undefined);
                }}
              >
                <X />
              </Button>
            </div>
            <button
              type="button"
              className="mt-3 inline-flex max-w-full items-center gap-1.5 text-left text-xs text-muted-foreground hover:text-foreground"
              title="Open in the Forkday browser"
              onClick={() =>
                void window.forkday
                  .openBrowser(selected.url)
                  .then(() => (location.hash = '#/browser'))
                  .catch((error: unknown) =>
                    toast(errorMessage(error), 'error'),
                  )
              }
            >
              <span className="truncate">{selected.url}</span>
              <ExternalLink aria-hidden className="size-3 shrink-0" />
            </button>
            <form
              className="mt-5 space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void update(selected.id, { notes });
              }}
            >
              <label
                className="block text-sm font-medium"
                htmlFor="application-notes"
              >
                Application notes
              </label>
              <textarea
                id="application-notes"
                rows={7}
                className="field-control resize-y"
                placeholder="Next steps, recruiter details, interview dates…"
                maxLength={20000}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 's' && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault();
                    if (notesDirty) void update(selected.id, { notes });
                  }
                }}
                disabled={busy}
              />
              <div className="flex items-center justify-between gap-2">
                <Button
                  type="submit"
                  disabled={busy || notes === selected.notes}
                >
                  {busy && <LoaderCircle className="animate-spin" />}
                  Save notes
                </Button>
                {confirmRemove ? (
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmRemove(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={busy}
                      onClick={() => void remove(selected)}
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setConfirmRemove(true)}
                  >
                    <Trash2 />
                    Remove from queue
                  </Button>
                )}
              </div>
            </form>
          </Card>
        )}
      </div>
    </section>
  );
}
