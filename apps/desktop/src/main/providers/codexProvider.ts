import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type {
  AuthenticationLaunch,
  ModelRequest,
  ModelResponse,
  ProviderHealth,
} from '../../shared/contracts';
import { findExecutable } from '../path';
import type { ProcessManager, ProcessResult } from '../processManager';
import type { ModelProvider } from './modelProvider';

const USAGE_MESSAGE =
  'Usage information is not reliably exposed by the current CLI.';
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['ok'] },
    message: { type: 'string' },
  },
  required: ['status', 'message'],
  additionalProperties: false,
};

export class ProviderError extends Error {
  constructor(
    readonly type:
      | 'not_installed'
      | 'not_authenticated'
      | 'timeout'
      | 'process_error'
      | 'invalid_response',
    message: string,
  ) {
    super(message);
  }
}

export class CodexProvider implements ModelProvider {
  readonly id = 'codex' as const;

  constructor(
    private readonly processes: ProcessManager,
    private readonly searchPath: string,
  ) {}

  async healthcheck(): Promise<ProviderHealth> {
    const binary = await this.binary();
    if (!binary) {
      return {
        id: this.id,
        installed: false,
        authenticated: false,
        error: 'Codex CLI was not found on the login-shell PATH.',
        usageInformation: USAGE_MESSAGE,
      };
    }

    const [versionResult, authResult] = await Promise.all([
      this.processes.run(binary, ['--version'], { timeoutMs: 5_000 }),
      this.processes.run(binary, ['login', 'status'], { timeoutMs: 10_000 }),
    ]);
    const authOutput = `${authResult.stdout}\n${authResult.stderr}`;

    return {
      id: this.id,
      installed: true,
      authenticated: authResult.exitCode === 0,
      version: cleanVersion(versionResult.stdout || versionResult.stderr),
      authMethod: parseAuthMethod(authOutput),
      error:
        authResult.exitCode === 0
          ? undefined
          : usefulError(
              authResult,
              'Codex is installed but not authenticated.',
            ),
      usageInformation: USAGE_MESSAGE,
    };
  }

  async complete(request: ModelRequest): Promise<ModelResponse> {
    if (typeof request.prompt !== 'string' || request.prompt.length > 1_000) {
      throw new ProviderError('process_error', 'Invalid model request.');
    }

    const binary = await this.binary();
    if (!binary)
      throw new ProviderError('not_installed', 'Codex CLI is not installed.');

    const directory = await mkdtemp(path.join(os.tmpdir(), 'forkday-codex-'));
    const schemaPath = path.join(directory, 'response.schema.json');
    const outputPath = path.join(directory, 'response.json');

    try {
      await writeFile(schemaPath, JSON.stringify(RESPONSE_SCHEMA), 'utf8');
      const result = await this.processes.run(
        binary,
        [
          'exec',
          '--ephemeral',
          '--ignore-user-config',
          '--ignore-rules',
          '--skip-git-repo-check',
          '--sandbox',
          'read-only',
          '--output-schema',
          schemaPath,
          '--output-last-message',
          outputPath,
          request.prompt,
        ],
        { timeoutMs: 60_000 },
      );

      if (result.timedOut)
        throw new ProviderError('timeout', 'Codex timed out after 60 seconds.');
      if (result.exitCode !== 0) {
        const message = usefulError(result, 'Codex invocation failed.');
        const type = /not logged in|authentication|unauthorized/i.test(message)
          ? 'not_authenticated'
          : 'process_error';
        throw new ProviderError(type, message);
      }

      return parseModelResponse(await readFile(outputPath, 'utf8'));
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }

  async authenticate(
    openExternal: (url: string) => Promise<void>,
  ): Promise<AuthenticationLaunch> {
    const binary = await this.binary();
    if (!binary) return { started: false, message: 'Install Codex CLI first.' };

    return new Promise((resolve) => {
      let output = '';
      let settled = false;
      const finish = (result: AuthenticationLaunch): void => {
        if (settled) return;
        settled = true;
        resolve(result);
      };

      this.processes.start(binary, ['login', '--device-auth'], {
        timeoutMs: 10 * 60_000,
        onOutput: (chunk) => {
          output += stripAnsi(chunk);
          const url = output.match(/https:\/\/[^\s]+/)?.[0];
          if (!url) return;

          void openExternal(url.replace(/[),.;]+$/, ''));
          const code = output.match(/\b[A-Z0-9]{4}-[A-Z0-9]{4}\b/)?.[0];
          finish({
            started: true,
            message: code
              ? `Browser opened. Enter device code ${code}, then click Check again.`
              : 'Browser opened. Complete Codex login, then click Check again.',
          });
        },
        onExit: (result) => {
          if (result.exitCode === 0) {
            finish({
              started: true,
              message: 'Codex authentication completed.',
            });
          } else {
            finish({
              started: false,
              message: usefulError(result, 'Codex login could not be started.'),
            });
          }
        },
      });

      setTimeout(
        () =>
          finish({
            started: true,
            message: 'Codex login started. Follow the browser prompt.',
          }),
        5_000,
      );
    });
  }

  private binary(): Promise<string | undefined> {
    return findExecutable(
      'codex',
      this.searchPath,
      process.env.FORKDAY_CODEX_PATH,
    );
  }
}

export function parseAuthMethod(output: string): string | undefined {
  return stripAnsi(output)
    .match(/Logged in using ([^\r\n]+)/i)?.[1]
    ?.trim();
}

export function parseModelResponse(raw: string): ModelResponse {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new ProviderError('invalid_response', 'Codex returned invalid JSON.');
  }

  if (
    typeof value !== 'object' ||
    value === null ||
    (value as Record<string, unknown>).status !== 'ok' ||
    typeof (value as Record<string, unknown>).message !== 'string'
  ) {
    throw new ProviderError(
      'invalid_response',
      'Codex response did not match the expected schema.',
    );
  }

  return {
    status: 'ok',
    message: (value as Record<string, string>).message,
  };
}

function cleanVersion(output: string): string | undefined {
  const value = stripAnsi(output).trim();
  return value || undefined;
}

function usefulError(result: ProcessResult, fallback: string): string {
  if (result.spawnError) return `${fallback} ${result.spawnError.message}`;
  const detail = stripAnsi(result.stderr || result.stdout).trim();
  return detail ? `${fallback} ${detail}` : fallback;
}

function stripAnsi(value: string): string {
  return value.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '');
}
