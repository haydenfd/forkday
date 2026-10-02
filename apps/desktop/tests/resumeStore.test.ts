import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { ResumeStore } from '../src/main/resumeStore.ts';
import { MAX_RESUME_BYTES } from '../src/shared/resume.ts';

const pdf = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF',
);

test('resume copies the selected PDF, survives loss of the original, and replaces atomically', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'forkday-resume-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const store = new ResumeStore(path.join(root, 'data'));
  assert.equal(await store.load(), null);
  const source = path.join(root, 'candidate.pdf');
  await fs.writeFile(source, pdf);
  const first = await store.import(source);
  await fs.unlink(source);
  assert.deepEqual(
    await new ResumeStore(path.join(root, 'data')).load(),
    first,
  );
  assert.deepEqual(await fs.readFile(store.filePath(first)), pdf);
  if (process.platform !== 'win32')
    assert.equal((await fs.stat(store.filePath(first))).mode & 0o777, 0o600);
  await fs.writeFile(source, pdf);
  const mocked = t.mock.method(fs, 'rename', async () => {
    throw new Error('Disk error');
  });
  await assert.rejects(store.import(source), /Disk error/);
  assert.deepEqual(await store.load(), first);
  assert.equal((await fs.readdir(path.join(root, 'data', 'resume'))).length, 2);
  mocked.mock.restore();
  const second = await store.import(source);
  assert.notEqual(second.id, first.id);
  assert.deepEqual(await store.load(), second);
  assert.equal((await fs.readdir(path.join(root, 'data', 'resume'))).length, 2);
  await assert.rejects(fs.stat(store.filePath(first)), { code: 'ENOENT' });
});

test('invalid and oversized uploads or corrupt storage never overwrite the last resume', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'forkday-resume-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const store = new ResumeStore(root);
  const source = path.join(root, 'candidate.pdf');
  await fs.writeFile(source, pdf);
  const original = await store.import(source);
  await fs.writeFile(source, 'not a PDF');
  await assert.rejects(store.import(source), /valid PDF/);
  const large = await fs.open(source, 'w');
  await large.truncate(MAX_RESUME_BYTES + 1);
  await large.close();
  await assert.rejects(store.import(source), /10 MB/);
  assert.deepEqual(await store.load(), original);
  await fs.writeFile(source, pdf);
  await fs.writeFile(path.join(root, 'resume', 'resume.json'), '{broken');
  await assert.rejects(store.import(source), /missing or invalid/);
  assert.equal(
    await fs.readFile(path.join(root, 'resume', 'resume.json'), 'utf8'),
    '{broken',
  );
  assert.deepEqual(await fs.readFile(store.filePath(original)), pdf);
});
