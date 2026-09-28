import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';

export interface ProcessResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  spawnError?: Error;
}

interface RunOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs: number;
}

interface StartOptions extends RunOptions {
  onOutput?: (chunk: string) => void;
  onExit?: (result: ProcessResult) => void;
}

export class ProcessManager {
  private readonly children = new Set<ChildProcessWithoutNullStreams>();

  run(
    executable: string,
    args: string[],
    options: RunOptions,
  ): Promise<ProcessResult> {
    return new Promise((resolve) => {
      this.start(executable, args, {
        ...options,
        onExit: resolve,
      });
    });
  }

  start(
    executable: string,
    args: string[],
    options: StartOptions,
  ): ChildProcessWithoutNullStreams {
    const child = spawn(executable, args, {
      cwd: options.cwd,
      env: options.env,
      shell: false,
      detached: process.platform !== 'win32',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    child.stdin.end();

    this.children.add(child);
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let spawnError: Error | undefined;
    let finished = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      this.kill(child);
    }, options.timeoutMs);

    child.stdout.on('data', (data: Buffer) => {
      const chunk = data.toString();
      stdout += chunk;
      options.onOutput?.(chunk);
    });
    child.stderr.on('data', (data: Buffer) => {
      const chunk = data.toString();
      stderr += chunk;
      options.onOutput?.(chunk);
    });
    child.on('error', (error) => {
      spawnError = error;
    });
    child.on('close', (exitCode) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      this.children.delete(child);
      options.onExit?.({ exitCode, stdout, stderr, timedOut, spawnError });
    });

    return child;
  }

  killAll(): void {
    for (const child of this.children) this.kill(child);
  }

  private kill(child: ChildProcessWithoutNullStreams): void {
    if (child.killed) return;

    try {
      if (process.platform !== 'win32' && child.pid) {
        process.kill(-child.pid, 'SIGTERM');
      } else {
        child.kill('SIGTERM');
      }
    } catch {
      child.kill('SIGTERM');
    }
  }
}
