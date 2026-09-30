import assert from 'node:assert/strict';
import test from 'node:test';
import { JobQueue } from '../src/main/jobQueue.ts';

const settle = (): Promise<void> =>
  new Promise((resolve) => setImmediate(resolve));

test('one application runs at a time; home and queued workspaces preserve it', async () => {
  const navigations: string[] = [];
  let visible = false;
  let closes = 0;
  const queue = new JobQueue({
    open: async (value) => {
      navigations.push(String(value));
    },
    close: () => {
      closes++;
    },
    setVisible: (value) => {
      visible = value;
    },
  });
  assert.throws(() => queue.add('file:///tmp/job'));
  queue.add('https://example.com/first');
  queue.add('https://example.com/second');
  await settle();
  const [first, second] = queue.list();
  assert.deepEqual(
    queue.list().map((job) => job.status),
    ['running', 'queued'],
  );
  assert.deepEqual(navigations, ['https://example.com/first']);
  queue.show(first.id);
  assert.equal(visible, true);
  queue.home();
  assert.equal(visible, false);
  queue.show(second.id);
  assert.equal(visible, false);
  assert.equal(closes, 0);
  assert.throws(() => queue.complete(second.id), /Only the active/);
  assert.throws(() => queue.show('missing'), /not found/);
  queue.complete(first.id);
  await settle();
  assert.deepEqual(
    queue.list().map((job) => job.status),
    ['completed', 'running'],
  );
  assert.deepEqual(navigations, [
    'https://example.com/first',
    'https://example.com/second',
  ]);
  assert.equal(closes, 1);
  // Snapshots cannot mutate the queue.
  queue.list()[1].status = 'completed';
  assert.equal(queue.list()[1].status, 'running');
  queue.complete(second.id);
  assert.equal(
    queue.list().filter((job) => job.status === 'running').length,
    0,
  );
});

test('failed navigation releases the active slot and starts the next job', async () => {
  const queue = new JobQueue({
    open: async (value) => {
      if (String(value).endsWith('/fail')) throw new Error('Page unavailable');
    },
    close: () => {},
    setVisible: () => {},
  });
  queue.add('https://example.com/fail');
  queue.add('https://example.com/next');
  await settle();
  assert.deepEqual(
    queue.list().map((job) => job.status),
    ['failed', 'running'],
  );
  assert.equal(queue.list()[0].error, 'Page unavailable');
});

test('quitting during navigation does not launch queued applications', async () => {
  const opened: string[] = [];
  let fail!: (reason: Error) => void;
  const queue = new JobQueue({
    open: (value) => {
      opened.push(String(value));
      return new Promise<void>((_resolve, reject) => {
        fail = reject;
      });
    },
    close: () => {},
    setVisible: () => {},
  });
  queue.add('https://example.com/first');
  queue.add('https://example.com/second');
  queue.stop();
  fail(new Error('Window closed'));
  await settle();
  assert.deepEqual(opened, ['https://example.com/first']);
  assert.equal(queue.list()[1].status, 'queued');
});
