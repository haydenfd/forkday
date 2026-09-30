import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { ProfileStore } from '../src/main/profileStore.ts';

test('profile store loads missing files and creates directories on save', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'forkday-profile-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const store = new ProfileStore(path.join(root, 'nested', 'userData'));
  assert.deepEqual(await store.load(), {});
  const profile = {
    email: 'candidate@example.com',
    phoneDeviceType: 'Mobile' as const,
    phoneCountryCode: 'United States of America (+1)',
    phone: '2025550123',
    phoneExtension: '42',
  };
  await store.save(profile);
  if (process.platform !== 'win32') {
    assert.equal(
      (await fs.stat(path.join(root, 'nested', 'userData', 'profile.json')))
        .mode & 0o777,
      0o600,
    );
  }
  assert.deepEqual(
    await new ProfileStore(path.join(root, 'nested', 'userData')).load(),
    profile,
  );
  await assert.rejects(store.save({ email: 'invalid' }));
  assert.deepEqual(await store.load(), profile);
});

test('profile store replaces atomically and preserves the original on rename failure', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'forkday-profile-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const store = new ProfileStore(root);
  await store.save({ firstName: 'Original' });
  const file = path.join(root, 'profile.json');
  const rename = fs.rename;
  let observed = false;
  const mocked = t.mock.method(
    fs,
    'rename',
    async (source: string, destination: string) => {
      assert.equal(destination, file);
      assert.equal(path.dirname(String(source)), root);
      assert.deepEqual(await store.load(), { firstName: 'Original' });
      assert.deepEqual(JSON.parse(await fs.readFile(source, 'utf8')), {
        firstName: 'Updated',
      });
      observed = true;
      await rename(source, destination);
    },
  );
  await store.save({ firstName: 'Updated' });
  assert.equal(observed, true);
  assert.deepEqual(await store.load(), { firstName: 'Updated' });
  assert.deepEqual(await fs.readdir(root), ['profile.json']);
  mocked.mock.mockImplementation(async () => {
    throw new Error('Rename failed');
  });
  await assert.rejects(store.save({ firstName: 'Lost' }), /Rename failed/);
  assert.deepEqual(await store.load(), { firstName: 'Updated' });
  assert.deepEqual(await fs.readdir(root), ['profile.json']);
});

test('invalid JSON and invalid profiles are reported and never overwritten', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'forkday-profile-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'profile.json');
  const store = new ProfileStore(root);
  for (const contents of ['{broken', '{"email":"invalid"}', 'null']) {
    await fs.writeFile(file, contents);
    await assert.rejects(store.load(), /Profile file is invalid/);
    await assert.rejects(store.save({}), /Profile file is invalid/);
    assert.equal(await fs.readFile(file, 'utf8'), contents);
  }
});
