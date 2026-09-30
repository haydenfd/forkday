import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import test from 'node:test';
import { CredentialStore } from '../src/main/credentialStore.ts';

// Real authenticated encryption exercises persistence; the Electron integration
// check separately exercises the OS-backed safeStorage implementation.
const key = randomBytes(32);
const encryption = {
  isEncryptionAvailable: () => true,
  getSelectedStorageBackend: () => 'gnome_libsecret' as const,
  encryptString: (plain: string): Buffer => {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
  },
  decryptString: (encrypted: Buffer): string => {
    const cipher = createDecipheriv(
      'aes-256-gcm',
      key,
      encrypted.subarray(0, 12),
    );
    cipher.setAuthTag(encrypted.subarray(12, 28));
    return Buffer.concat([
      cipher.update(encrypted.subarray(28)),
      cipher.final(),
    ]).toString();
  },
};
const record = {
  company: 'Example',
  origin: 'https://example.wd5.myworkdayjobs.com',
  email: 'candidate@example.com',
  password: 'Test-password1!',
};

test('credentials are encrypted, survive reload, stay tenant-scoped, and never leak passwords through list', async (t) => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), 'forkday-credentials-'),
  );
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const store = new CredentialStore(directory, encryption);
  assert.deepEqual(await store.list(), []);
  await store.save(record);
  const bytes = await fs.readFile(path.join(directory, 'credentials.enc'));
  for (const value of [record.password, record.email, record.company])
    assert.equal(bytes.includes(value), false);
  assert.equal(
    (await fs.stat(path.join(directory, 'credentials.enc'))).mode & 0o777,
    0o600,
  );
  const reloaded = new CredentialStore(directory, encryption);
  assert.deepEqual(
    await reloaded.find(record.origin, record.email.toUpperCase()),
    record,
  );
  assert.equal(
    await reloaded.find('https://other.wd5.myworkdayjobs.com', record.email),
    undefined,
  );
  assert.equal(
    await reloaded.find(record.origin, 'another@example.com'),
    undefined,
  );
  assert.deepEqual(await reloaded.list(), [
    { company: record.company, origin: record.origin, email: record.email },
  ]);
  assert.equal(
    await reloaded.revealPassword({
      origin: record.origin,
      email: record.email,
    }),
    record.password,
  );
  await assert.rejects(
    reloaded.revealPassword({
      origin: record.origin,
      email: 'missing@example.com',
    }),
    /Saved credential not found/,
  );
  await assert.rejects(
    reloaded.revealPassword({
      origin: 'https://example.com',
      email: record.email,
    }),
    /Invalid credential selection/,
  );
  await assert.rejects(
    reloaded.revealPassword(null),
    /Invalid credential selection/,
  );
  await reloaded.save({ ...record, password: 'Do-not-overwrite1!' });
  assert.equal(
    (await reloaded.find(record.origin, record.email))?.password,
    record.password,
  );
  await Promise.all([
    reloaded.save({
      ...record,
      origin: 'https://second.wd5.myworkdayjobs.com',
    }),
    reloaded.save({ ...record, origin: 'https://third.wd5.myworkdayjobs.com' }),
  ]);
  assert.equal((await reloaded.list()).length, 3);
});

test('unavailable keychain, corruption, invalid records, and failed writes never fall back to plaintext or erase credentials', async (t) => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), 'forkday-credentials-'),
  );
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const unavailable = new CredentialStore(directory, {
    ...encryption,
    isEncryptionAvailable: () => false,
  });
  await assert.rejects(
    unavailable.save(record),
    /Secure credential storage is unavailable/,
  );
  assert.deepEqual(await fs.readdir(directory), []);
  const store = new CredentialStore(directory, encryption);
  await assert.rejects(
    store.save({ ...record, email: 'invalid' }),
    /Invalid credential record/,
  );
  await store.save(record);
  const file = path.join(directory, 'credentials.enc');
  const original = await fs.readFile(file);
  const mocked = t.mock.method(fs, 'rename', async () => {
    throw new Error('Disk failed');
  });
  await assert.rejects(
    store.save({ ...record, email: 'new@example.com' }),
    /Could not save credentials/,
  );
  assert.deepEqual(await fs.readFile(file), original);
  assert.deepEqual(await fs.readdir(directory), ['credentials.enc']);
  mocked.mock.restore();
  await fs.writeFile(file, 'corrupted');
  await assert.rejects(store.list(), /Could not unlock saved credentials/);
  await assert.rejects(
    store.save(record),
    /Could not unlock saved credentials/,
  );
  assert.equal(await fs.readFile(file, 'utf8'), 'corrupted');
});
