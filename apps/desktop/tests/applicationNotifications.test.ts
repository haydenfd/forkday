import assert from 'node:assert/strict';
import test from 'node:test';
import { applicationNotification } from '../src/main/applicationNotifications.ts';
import type { Application } from '../src/shared/applications.ts';

test('notify waiting, stopped, and idle transitions, but never unchanged statuses or notes', () => {
  const waiting: Application = {
    id: crypto.randomUUID(),
    title: 'Engineer',
    company: 'Example',
    url: 'https://example.com/job',
    status: 'waiting',
    notes: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  assert.equal(applicationNotification([], [waiting])?.title, 'Task waiting');
  const continuing = { ...waiting, status: 'continuing' as const };
  assert.equal(
    applicationNotification([waiting], [continuing])?.title,
    'Task continuing',
  );
  const stopped = { ...waiting, status: 'stopped' as const };
  assert.equal(
    applicationNotification([continuing], [stopped])?.title,
    'Task stopped',
  );
  assert.match(applicationNotification([continuing], [stopped])!.body, /idle/);
  assert.equal(
    applicationNotification(
      [continuing],
      [{ ...continuing, status: 'completed' }],
    )?.title,
    'Forkday is idle',
  );
  assert.equal(
    applicationNotification(
      [continuing],
      [{ ...continuing, notes: 'Updated notes' }],
    ),
    undefined,
  );
  assert.equal(applicationNotification([waiting], [waiting]), undefined);
});
