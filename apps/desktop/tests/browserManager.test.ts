import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium, type BrowserContext } from 'playwright';

import {
  BrowserManager,
  validateBrowserUrl,
} from '../src/main/browserManager.ts';

test('browser URLs allow web navigation and reject unsafe input', () => {
  const url =
    'https://company.myworkdayjobs.com/en-US/jobs/job/123?source=Forkday';
  assert.equal(validateBrowserUrl(url), url);
  assert.equal(
    validateBrowserUrl('http://localhost:3000'),
    'http://localhost:3000/',
  );
  for (const invalid of [
    undefined,
    123,
    '',
    '/jobs',
    'javascript:alert(1)',
    'file:///tmp/job.html',
    'https://user:password@example.com',
    'x'.repeat(8193),
  ]) {
    assert.throws(() => validateBrowserUrl(invalid));
  }
});

test('one headed profile survives repeated opens, failures, and manual closure', async (t) => {
  const navigations: string[] = [];
  let onClose = (): void => {};
  let closes = 0;
  const page = {
    goto: async (url: string) => {
      if (url.endsWith('/fail')) throw new Error('Navigation failed');
      navigations.push(url);
    },
    bringToFront: async () => {},
  };
  const context = {
    pages: () => [page],
    on: (_event: string, callback: () => void) => {
      onClose = callback;
    },
    close: async () => {
      closes++;
      onClose();
    },
  } as unknown as BrowserContext;
  const launch = t.mock.method(
    chromium,
    'launchPersistentContext',
    async () => context,
  );
  const manager = new BrowserManager('/forkday/browser-profile');
  await Promise.all([
    manager.open('https://example.com/one'),
    manager.open('https://example.com/two'),
  ]);
  assert.equal(launch.mock.callCount(), 1);
  assert.deepEqual(launch.mock.calls[0].arguments, [
    '/forkday/browser-profile',
    {
      headless: false,
      chromiumSandbox: true,
      viewport: null,
    },
  ]);
  assert.deepEqual(navigations, [
    'https://example.com/one',
    'https://example.com/two',
  ]);
  await assert.rejects(
    manager.open('https://example.com/fail'),
    /Navigation failed/,
  );
  onClose();
  await manager.open('https://example.com/reopened');
  assert.equal(launch.mock.callCount(), 2);
  const opening = manager.open('https://example.com/final');
  await manager.close();
  await opening;
  assert.equal(closes, 1);
  assert.equal(navigations.at(-1), 'https://example.com/final');
  assert.throws(() => manager.open('https://example.com'), /closing/);
});

test('a failed launch can be retried', async (t) => {
  const launch = t.mock.method(
    chromium,
    'launchPersistentContext',
    async () => {
      throw new Error('Missing browser');
    },
  );
  const manager = new BrowserManager('/forkday/browser-profile');
  await assert.rejects(manager.open('https://example.com'), /Missing browser/);
  await assert.rejects(manager.open('https://example.com'), /Missing browser/);
  assert.equal(launch.mock.callCount(), 2);
  await manager.close();
});
