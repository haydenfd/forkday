import type { Application } from '../shared/applications.ts';

export function applicationNotification(
  before: Application[],
  after: Application[],
): { title: string; body: string } | undefined {
  const changed = after.find(
    (item) =>
      !before.some(
        (previous) =>
          previous.id === item.id && previous.status === item.status,
      ),
  );
  if (!changed) return;
  const wasBusy = before.some((item) =>
    ['waiting', 'continuing'].includes(item.status),
  );
  const isBusy = after.some((item) =>
    ['waiting', 'continuing'].includes(item.status),
  );
  if (wasBusy && !isBusy && changed.status !== 'stopped')
    return {
      title: 'Forkday is idle',
      body: `${changed.title}: ${changed.status}. No tasks remain active or waiting.`,
    };
  const labels = {
    waiting: 'Task waiting',
    continuing: 'Task continuing',
    completed: 'Task completed',
    rejected: 'Task rejected',
    stopped: 'Task stopped',
  };
  return {
    title: labels[changed.status],
    body: `${changed.title}${changed.status === 'stopped' && !isBusy ? '. Forkday is idle.' : ''}`,
  };
}
