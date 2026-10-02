import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { ProfileStore } from '../src/main/profileStore.ts';

const profile = {
  email: 'candidate@example.com',
  firstName: 'Ada',
  lastName: 'Lovelace',
  phoneDeviceType: 'Mobile' as const,
  phoneCountryCode: 'United States of America (+1)',
  phone: '2025550123',
  addressLine1: '1 Main St',
  city: 'Example City',
  state: 'DC',
  postalCode: '20001',
  country: 'United States of America',
};

test('profile store loads missing files and creates directories on save', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'forkday-profile-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const store = new ProfileStore(path.join(root, 'nested', 'userData'));
  assert.deepEqual(await store.load(), {});
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
  await assert.rejects(store.save({ ...profile, email: 'invalid' }));
  await assert.rejects(store.save({ email: 'candidate@example.com' }));
  assert.deepEqual(await store.load(), profile);
});

test('profile store replaces atomically and preserves the original on rename failure', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'forkday-profile-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const store = new ProfileStore(root);
  await store.save({ ...profile, firstName: 'Original' });
  const file = path.join(root, 'profile.json');
  const rename = fs.rename;
  let observed = false;
  const mocked = t.mock.method(
    fs,
    'rename',
    async (source: string, destination: string) => {
      assert.equal(destination, file);
      assert.equal(path.dirname(String(source)), root);
      assert.deepEqual(await store.load(), {
        ...profile,
        firstName: 'Original',
      });
      assert.deepEqual(JSON.parse(await fs.readFile(source, 'utf8')), {
        ...profile,
        firstName: 'Updated',
      });
      observed = true;
      await rename(source, destination);
    },
  );
  await store.save({ ...profile, firstName: 'Updated' });
  assert.equal(observed, true);
  assert.deepEqual(await store.load(), { ...profile, firstName: 'Updated' });
  assert.deepEqual(await fs.readdir(root), ['profile.json']);
  mocked.mock.mockImplementation(async () => {
    throw new Error('Rename failed');
  });
  await assert.rejects(
    store.save({ ...profile, firstName: 'Lost' }),
    /Rename failed/,
  );
  assert.deepEqual(await store.load(), { ...profile, firstName: 'Updated' });
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
    await assert.rejects(store.save(profile), /Profile file is invalid/);
    assert.equal(await fs.readFile(file, 'utf8'), contents);
  }
});

test('older partial profiles stay readable for completion in the form', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'forkday-profile-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(
    path.join(root, 'profile.json'),
    JSON.stringify({ firstName: 'Ada' }),
  );
  assert.deepEqual(await new ProfileStore(root).load(), { firstName: 'Ada' });
});

test('section saves work independently and preserve other sections during concurrent writes', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'forkday-profile-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const store = new ProfileStore(root);
  await Promise.all([
    store.saveSection({
      section: 'resume',
      profile: { resumeText: 'Example resume' },
    }),
    store.saveSection({
      section: 'answers',
      profile: { authorizedToWork: 'Yes', sponsorshipNow: 'No' },
    }),
  ]);
  assert.deepEqual(await store.load(), {
    resumeText: 'Example resume',
    authorizedToWork: 'Yes',
    sponsorshipNow: 'No',
    workAuthorizationCountry: 'United States of America',
  });
  await store.saveSection({ section: 'profile', profile });
  assert.equal((await store.load()).resumeText, 'Example resume');
  await store.saveSection({
    section: 'resume',
    profile: { resumeText: undefined },
  });
  assert.equal((await store.load()).resumeText, undefined);
  assert.equal((await store.load()).authorizedToWork, 'Yes');
  assert.throws(() =>
    store.saveSection({
      section: 'resume',
      profile: { email: 'changed@example.com' },
    }),
  );
  assert.throws(() =>
    store.saveSection({
      section: 'profile',
      profile: { firstName: 'Incomplete' },
    }),
  );
});
