import assert from 'node:assert/strict';
import test from 'node:test';

import { findExecutable } from '../src/main/path.ts';
import { ProcessManager } from '../src/main/processManager.ts';

test('missing Codex detection returns undefined', async () => {
  const result = await findExecutable('codex', '/definitely/missing');
  assert.equal(result, undefined);
});

test('a child-process spawn error is returned instead of crashing', async () => {
  const processes = new ProcessManager();
  const result = await processes.run('/definitely/missing/forkday-codex', [], {
    timeoutMs: 1_000,
  });

  assert.ok(result.spawnError);
  assert.equal(result.exitCode, -2);
});
