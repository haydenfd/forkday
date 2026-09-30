import assert from 'node:assert/strict';
import test from 'node:test';

import { validateBrowserUrl } from '../src/main/browserUrl.ts';

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
