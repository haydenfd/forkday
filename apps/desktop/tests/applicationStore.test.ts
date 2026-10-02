import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { ApplicationStore } from '../src/main/applicationStore.ts';

test('applications persist concurrent additions, transitions, and notes without opening a browser', async (t) => {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), 'forkday-applications-'),
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const store = new ApplicationStore(path.join(root, 'data'));
  assert.deepEqual(await store.list(), []);
  await Promise.all([
    store.add({
      url: 'https://example.com/one',
      title: 'Engineer',
      company: 'Example',
    }),
    store.add({ url: 'https://example.com/two' }),
  ]);
  const jobs = await store.list();
  assert.equal(jobs.length, 2);
  assert.equal(
    jobs.every((job) => job.status === 'waiting'),
    true,
  );
  const first = jobs.find((job) => job.title === 'Engineer')!;
  await store.update({
    id: first.id,
    status: 'continuing',
    notes: 'Interview Tuesday',
  });
  await store.update({ id: first.id, status: undefined });
  assert.deepEqual(
    await new ApplicationStore(path.join(root, 'data')).list(),
    await store.list(),
  );
  assert.equal(
    (await store.list()).find((job) => job.id === first.id)?.notes,
    'Interview Tuesday',
  );
  assert.equal(
    (await store.list()).find((job) => job.id === first.id)?.status,
    'continuing',
  );
  await store.update({ id: first.id, status: 'rejected' });
  assert.equal(
    (await store.list()).find((job) => job.id === first.id)?.status,
    'rejected',
  );
  assert.throws(() => store.add({ url: 'javascript:alert(1)' }));
  assert.throws(() => store.add({ url: 'https://user:pass@example.com/' }));
  assert.throws(() => store.update({ id: first.id, status: 'made-up' }));
  await assert.rejects(
    store.add({ url: 'https://example.com/one' }),
    /already/,
  );
  await assert.rejects(
    store.update({ id: crypto.randomUUID(), notes: 'missing' }),
    /not found/,
  );
  if (process.platform !== 'win32')
    assert.equal(
      (await fs.stat(path.join(root, 'data', 'applications.json'))).mode &
        0o777,
      0o600,
    );
});

test('failed writes and corrupt application files preserve saved data', async (t) => {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), 'forkday-applications-'),
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const store = new ApplicationStore(root);
  await store.add({ url: 'https://example.com/' });
  const original = await store.list();
  const rename = t.mock.method(fs, 'rename', async () => {
    throw new Error('Disk error');
  });
  await assert.rejects(
    store.update({ id: original[0].id, status: 'rejected' }),
    /Disk error/,
  );
  assert.deepEqual(await store.list(), original);
  assert.deepEqual(await fs.readdir(root), ['applications.json']);
  rename.mock.restore();
  await store.update({ id: original[0].id, status: 'continuing' });
  await fs.writeFile(path.join(root, 'applications.json'), '{broken');
  await assert.rejects(store.list(), /invalid/);
  await assert.rejects(
    store.add({ url: 'https://example.com/other' }),
    /invalid/,
  );
  assert.equal(
    await fs.readFile(path.join(root, 'applications.json'), 'utf8'),
    '{broken',
  );
});
