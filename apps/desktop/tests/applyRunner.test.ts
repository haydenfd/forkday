import assert from 'node:assert/strict';
import test from 'node:test';
import { ApplyRunner, type RunnerDeps } from '../src/main/applyRunner.ts';
import type { Application } from '../src/shared/applications.ts';
import type { Run } from '../src/shared/contracts.ts';

const settle = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 10));
const job = (n: number): Application => ({
  id: crypto.randomUUID(),
  url: `https://acme.wd1.myworkdayjobs.com/job/${n}`,
  title: `Job ${n}`,
  company: 'Acme',
  status: 'waiting',
  notes: '',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

function harness(overrides: Partial<RunnerDeps> = {}) {
  const log: string[] = [];
  const statuses: string[] = [];
  const notes: string[] = [];
  let runs: Run[] = [];
  const runner = new ApplyRunner({
    open: async (url) => void log.push(`open ${url.split('/').pop()}`),
    close: () => void log.push('close'),
    locate: async () => 'account',
    signIn: async () => ({
      page: 'sign_in',
      filled: [],
      submission: 'submitted',
    }),
    waitForForm: async () => true,
    fill: async () => ({
      filled: ['First Name', 'City'],
      missing: ['How Did You Hear About Us?'],
      resumeUploaded: false,
    }),
    profile: async () => ({ email: 'person@example.com' }),
    resumePath: async () => undefined,
    setStatus: async (_id, status) => void statuses.push(status),
    notify: (title) => void notes.push(title),
    changed: (next) => (runs = next),
    ...overrides,
  });
  return { runner, log, statuses, notes, runs: () => runs };
}

test('runs one job at a time, stops for review, and starts the next when finished', async () => {
  const h = harness();
  const [a, b] = [job(1), job(2)];
  h.runner.enqueue(a);
  h.runner.enqueue(b);
  h.runner.enqueue(a); // duplicates are ignored
  await settle();
  assert.deepEqual(
    h.runs().map((run) => run.step),
    ['review', 'queued'],
  );
  assert.deepEqual(h.runs()[0].missing, ['How Did You Hear About Us?']);
  assert.match(h.runs()[0].detail, /Filled 2 fields; 1 needs you/);
  assert.deepEqual(h.notes, ['Ready for review: Job 1']);
  assert.equal(h.runner.position(h.runner.find(b.url)!), 1);

  await h.runner.finish(a.id, 'completed');
  await settle();
  assert.deepEqual(h.statuses, ['continuing', 'completed', 'continuing']);
  assert.deepEqual(h.log, ['open 1', 'close', 'open 2']);
  assert.deepEqual(
    h.runs().map((run) => run.id),
    [b.id],
  );
  assert.throws(() => h.runner.continue(a.id), /Only the application/);
});

test('sign-in trouble asks for the user and Continue resumes from the page', async () => {
  let formShown = false;
  const h = harness({ waitForForm: async () => formShown });
  const a = job(1);
  h.runner.enqueue(a);
  await settle();
  assert.equal(h.runs()[0].step, 'attention');
  assert.match(h.runs()[0].detail, /verify your email/);
  assert.deepEqual(h.notes, ['Needs you: Job 1']);
  formShown = true;
  h.runner.continue(a.id);
  await settle();
  assert.equal(h.runs()[0].step, 'review');
  assert.deepEqual(h.log, ['open 1']); // Continue does not reload the page
});

test('missing email and page errors become attention, never a crash', async () => {
  const h = harness({ profile: async () => ({}) });
  h.runner.enqueue(job(1));
  await settle();
  assert.match(h.runs()[0].detail, /Add your email/);

  const broken = harness({
    open: async () => {
      throw new Error('x'.repeat(500)); // long Playwright-style logs are hidden
    },
  });
  broken.runner.enqueue(job(2));
  await settle();
  assert.match(broken.runs()[0].detail, /^Something went wrong/);
});
