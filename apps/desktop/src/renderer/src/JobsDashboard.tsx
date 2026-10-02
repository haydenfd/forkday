import { useEffect, useState } from 'react';
import { ClipboardList, Plus, Search } from 'lucide-react';
import {
  type Application,
  type ApplicationStatus,
} from '../../shared/applications';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useUnsavedChanges } from '@/lib/useUnsavedChanges';

const statuses = [
  {
    id: 'waiting',
    label: 'Waiting',
    description: 'Saved jobs you plan to apply to.',
    variant: 'warning',
  },
  {
    id: 'continuing',
    label: 'Continuing',
    description: 'Applications in progress or awaiting a response.',
    variant: 'active',
  },
  {
    id: 'rejected',
    label: 'Rejected',
    description: 'Applications that did not move forward.',
    variant: 'destructive',
  },
  {
    id: 'completed',
    label: 'Completed',
    description: 'Finished applications.',
    variant: 'success',
  },
  {
    id: 'stopped',
    label: 'Stopped',
    description: 'Applications paused or stopped by you.',
    variant: 'warning',
  },
] as const;

export default function JobsDashboard({
  route,
}: {
  route: string;
}): React.JSX.Element {
  const [applications, setApplications] = useState<Application[]>([]);
  const [filter, setFilter] = useState<ApplicationStatus | 'history'>(
    'waiting',
  );
  const [search, setSearch] = useState('');
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [selectedId, setSelectedId] = useState<string>();
  const [notes, setNotes] = useState('');
  const selected = applications.find((item) => item.id === selectedId);
  const notesDirty = Boolean(selected && notes !== selected.notes);
  useUnsavedChanges(notesDirty);
  const canDiscardNotes = (): boolean =>
    !notesDirty || window.confirm('Discard your unsaved application notes?');
  const visible = applications.filter(
    (item) =>
      (item.status === filter ||
        (filter === 'history' &&
          !['waiting', 'continuing'].includes(item.status))) &&
      `${item.title} ${item.company} ${item.url}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );

  useEffect(() => {
    void window.forkday
      .listApplications()
      .then((items) => {
        setApplications(items);
        const requested = route.split('/')[2];
        const selected = items.find((item) => item.id === requested);
        if (selected) {
          setSelectedId(selected.id);
          setNotes(selected.notes);
          setFilter(selected.status);
        } else if (requested === 'history') setFilter('history');
        else if (statuses.some((status) => status.id === requested))
          setFilter(requested as ApplicationStatus);
      })
      .catch((error: unknown) => setError(errorMessage(error)))
      .finally(() => setBusy(false));
  }, [route]);
  const add = async (): Promise<void> => {
    setBusy(true);
    setError(undefined);
    setMessage(undefined);
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
      setMessage('Job added to Waiting.');
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
    setMessage(undefined);
    try {
      setApplications(await window.forkday.updateApplication({ id, ...patch }));
      if (patch.status) {
        setFilter(patch.status);
        setSelectedId(undefined);
        setMessage(
          `Moved to ${statuses.find((item) => item.id === patch.status)?.label}.`,
        );
      } else setMessage('Notes saved.');
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-6xl">
      <header className="mb-7">
        <h1 className="text-2xl font-semibold tracking-tight">Job queue</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Save jobs, track progress, and pick up where you left off. Adding a
          job saves it locally.
        </p>
      </header>
      <Card className="mb-7 p-5">
        <h2 className="mb-4 text-base font-semibold">Add a job</h2>
        <form
          className="grid gap-4 lg:grid-cols-[2fr_1fr_1fr_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            void add();
          }}
        >
          <div className="space-y-2">
            <label className="block text-sm" htmlFor="queue-url">
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
            <label className="block text-sm" htmlFor="queue-title">
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
            <label className="block text-sm" htmlFor="queue-company">
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
      <div
        className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5"
        role="group"
        aria-label="Filter applications by status"
      >
        {statuses.map(({ id, label, variant }) => (
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
              'rounded-xl border p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
              filter === id
                ? 'border-brand bg-brand-soft'
                : 'bg-card hover:bg-secondary',
            )}
          >
            <Badge variant={variant}>{label}</Badge>
            <span className="mt-3 block text-2xl font-semibold">
              {applications.filter((item) => item.status === id).length}
            </span>
          </button>
        ))}
      </div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">
            {filter === 'history'
              ? 'Past processed'
              : statuses.find((item) => item.id === filter)?.label}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {filter === 'history'
              ? ''
              : statuses.find((item) => item.id === filter)?.description}
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search
            aria-hidden
            className="absolute left-3 top-2.5 size-4 text-muted-foreground"
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
      {error && (
        <p
          role="alert"
          className="mb-4 rounded-lg bg-destructive-soft p-4 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="mb-4 text-sm text-success">
          {message}
        </p>
      )}
      <div
        className={cn(
          'grid items-start gap-5',
          selected && 'lg:grid-cols-[3fr_2fr]',
        )}
      >
        <div className="space-y-3">
          {busy && applications.length === 0 ? (
            <p role="status" className="p-6 text-sm text-muted-foreground">
              Loading applications…
            </p>
          ) : visible.length === 0 ? (
            <Card className="grid justify-items-center gap-3 border-dashed px-6 py-12 text-center">
              <ClipboardList className="size-8 text-muted-foreground" />
              <h3 className="font-semibold">
                {search ? 'No matching applications' : `No ${filter} jobs yet`}
              </h3>
              <p className="max-w-md text-sm text-muted-foreground">
                {search
                  ? 'Try another title or company.'
                  : filter === 'waiting'
                    ? 'Paste a job URL above to start your queue.'
                    : 'Move an application here when its status changes.'}
              </p>
            </Card>
          ) : (
            visible.map((application) => (
              <Card
                key={application.id}
                className={cn(
                  'p-5',
                  selectedId === application.id && 'border-brand',
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="mb-1 text-xs text-muted-foreground">
                      {application.company}
                    </p>
                    <h3 className="break-words text-base font-semibold">
                      {application.title}
                    </h3>
                    <p className="mt-2 break-all text-xs text-muted-foreground">
                      {application.url}
                    </p>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Updated{' '}
                      {new Date(application.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Select
                    aria-label={`Status for ${application.title}`}
                    className="w-36"
                    value={application.status}
                    disabled={busy}
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
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-3 -ml-3"
                  onClick={() => {
                    if (selectedId === application.id || !canDiscardNotes())
                      return;
                    setSelectedId(application.id);
                    setNotes(application.notes);
                  }}
                >
                  View details
                </Button>
              </Card>
            ))
          )}
        </div>
        {selected && (
          <Card className="p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 className="break-words text-lg font-semibold">
                {selected.title}
              </h2>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (canDiscardNotes()) setSelectedId(undefined);
                }}
              >
                Close
              </Button>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {selected.company}
            </p>
            <p className="mt-4 break-all text-xs text-muted-foreground">
              {selected.url}
            </p>
            <form
              className="mt-6 space-y-3"
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
                disabled={busy}
              />
              <Button type="submit" disabled={busy || notes === selected.notes}>
                Save notes
              </Button>
            </form>
          </Card>
        )}
      </div>
    </section>
  );
}
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
