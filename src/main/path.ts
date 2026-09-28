import { constants } from 'node:fs';
import { access } from 'node:fs/promises';
import path from 'node:path';

import type { ProcessManager } from './processManager';

export async function resolveLoginShellPath(
  processes: ProcessManager,
): Promise<string> {
  if (process.platform === 'win32') return process.env.PATH ?? '';

  const shell = process.env.SHELL || '/bin/zsh';
  const result = await processes.run(shell, ['-ilc', 'printf %s "$PATH"'], {
    timeoutMs: 5_000,
    env: process.env,
  });

  return result.exitCode === 0 && result.stdout.trim()
    ? result.stdout.trim()
    : (process.env.PATH ?? '');
}

export async function findExecutable(
  name: string,
  searchPath: string,
  override?: string,
): Promise<string | undefined> {
  const candidates = override
    ? [override]
    : searchPath
        .split(path.delimiter)
        .map((directory) => path.join(directory, name));

  for (const candidate of candidates) {
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {
      // Keep looking.
    }
  }

  return undefined;
}
