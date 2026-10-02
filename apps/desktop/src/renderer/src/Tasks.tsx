import { useEffect, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import type { Application } from '../../shared/applications';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

export default function Tasks(): React.JSX.Element {
  const [applications, setApplications] = useState<Application[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string>();
  useEffect(() => {
    void window.forkday
      .listApplications()
      .then(setApplications)
      .catch((error: unknown) =>
        setError(error instanceof Error ? error.message : String(error)),
      )
      .finally(() => setBusy(false));
  }, []);
  const active = applications.filter((item) => item.status === 'continuing');
  const waiting = applications.filter((item) => item.status === 'waiting');
  const past = applications
    .filter((item) => !['waiting', 'continuing'].includes(item.status))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return (
    <section className="mx-auto w-full max-w-6xl">
      <header className="mb-7 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
        <Badge
          variant={
            active.length ? 'active' : waiting.length ? 'warning' : 'secondary'
          }
        >
          {busy
            ? 'Loading'
            : active.length
              ? `${active.length} active`
              : waiting.length
                ? `${waiting.length} waiting`
                : 'Idle'}
        </Badge>
      </header>
      {error && (
        <p role="alert" className="mb-5 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Current tasks</h2>
        <a href="#/queue" className="text-sm text-brand">
          Open queue →
        </a>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {[...active, ...waiting].slice(0, 6).map((item) => (
          <Card key={item.id} className="p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="truncate text-sm text-muted-foreground">
                {item.company}
              </p>
              <Badge
                variant={item.status === 'continuing' ? 'active' : 'warning'}
              >
                {item.status === 'continuing' ? 'Continuing' : 'Waiting'}
              </Badge>
            </div>
            <h3 className="break-words font-semibold">{item.title}</h3>
            {item.notes && (
              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                {item.notes}
              </p>
            )}
            <a
              href={`#/queue/${item.id}`}
              className="mt-4 inline-flex items-center gap-1 text-sm text-brand"
            >
              View task
              <ArrowUpRight className="size-4" />
            </a>
          </Card>
        ))}
        {!busy && !active.length && !waiting.length && (
          <Card className="border-dashed p-8 text-sm text-muted-foreground sm:col-span-2">
            No current tasks.{' '}
            <a href="#/queue" className="text-brand">
              Add a job
            </a>
          </Card>
        )}
      </div>
      <div className="mb-4 mt-8 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Past processed</h2>
        <a href="#/queue/history" className="text-sm text-brand">
          See all →
        </a>
      </div>
      <Card className="overflow-hidden">
        {past.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-secondary text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Task</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Notes</th>
                  <th className="px-5 py-3 font-medium">Updated</th>
                  <th className="px-5 py-3">
                    <span className="sr-only">Details</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {past.slice(0, 5).map((item) => (
                  <tr key={item.id}>
                    <td className="px-5 py-4">
                      <p className="font-medium">{item.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.company}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <Badge
                        variant={
                          item.status === 'completed'
                            ? 'success'
                            : item.status === 'stopped'
                              ? 'warning'
                              : 'destructive'
                        }
                      >
                        {item.status[0].toUpperCase() + item.status.slice(1)}
                      </Badge>
                    </td>
                    <td className="max-w-72 px-5 py-4">
                      <p className="line-clamp-2 text-muted-foreground">
                        {item.notes || '—'}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-muted-foreground">
                      {new Date(item.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4">
                      <a
                        aria-label={`View ${item.title}`}
                        href={`#/queue/${item.id}`}
                        className="text-brand"
                      >
                        View
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="p-8 text-sm text-muted-foreground">
            No processed tasks yet.
          </p>
        )}
      </Card>
    </section>
  );
}
