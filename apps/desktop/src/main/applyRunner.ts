import type { Application, ApplicationStatus } from '../shared/applications.ts';
import type { AccountFormResult, Run, RunStep } from '../shared/contracts.ts';
import type { Profile } from '../shared/profile.ts';
import type { FillResult } from './workday/applicationForm.ts';

export interface RunnerDeps {
  open(url: string): Promise<void>;
  close(): void;
  /** Click Apply when `start`, then report which Workday step is showing. */
  locate(start: boolean): Promise<'form' | 'account' | 'unknown'>;
  signIn(email: string): Promise<AccountFormResult>;
  waitForForm(): Promise<boolean>;
  fill(profile: Profile, resumePath?: string): Promise<FillResult>;
  profile(): Promise<Profile>;
  resumePath(): Promise<string | undefined>;
  setStatus(id: string, status: ApplicationStatus): Promise<void>;
  notify(title: string, body: string): void;
  changed(runs: Run[]): void;
}

/**
 * Applies to queued jobs one at a time in the embedded browser. Each run stops
 * for the user's review (Forkday never submits); finishing it starts the next.
 */
export class ApplyRunner {
  private runs: Run[] = [];
  private busy = false;
  private readonly deps: RunnerDeps;

  constructor(deps: RunnerDeps) {
    this.deps = deps;
  }

  list(): Run[] {
    return structuredClone(this.runs);
  }

  find(url: string): Run | undefined {
    return this.runs.find((run) => run.url === url);
  }

  position(run: Run): number {
    return this.runs.filter((item) => item.step === 'queued').indexOf(run) + 1;
  }

  enqueue(application: Application): Run[] {
    if (!this.runs.some((run) => run.id === application.id)) {
      this.runs.push({
        id: application.id,
        url: application.url,
        title: application.title,
        company: application.company,
        step: 'queued',
        detail: 'Waiting for the browser.',
        filled: [],
        missing: [],
        updatedAt: new Date().toISOString(),
      });
      this.emit();
    }
    void this.pump();
    return this.list();
  }

  /** Pick up from whatever page the browser shows now, e.g. after verifying email. */
  continue(id: unknown): Run[] {
    const run = this.runs.find((item) => item.id === id);
    if (!run || run !== this.active())
      throw new Error('Only the application in the browser can continue.');
    if (this.busy) throw new Error('Forkday is already working on this page.');
    void this.process(run, false);
    return this.list();
  }

  /** Remove a run; `completed`/`stopped` also update its saved status. */
  async finish(
    id: unknown,
    outcome: 'completed' | 'stopped' | 'dequeue',
  ): Promise<Run[]> {
    const run = this.runs.find((item) => item.id === id);
    if (!run) throw new Error('Application is not in the run queue.');
    if (run === this.active() && this.busy)
      throw new Error('Wait for Forkday to finish this step.');
    const wasActive = run === this.active();
    this.runs = this.runs.filter((item) => item !== run);
    if (wasActive) this.deps.close();
    if (outcome !== 'dequeue') await this.deps.setStatus(run.id, outcome);
    this.emit();
    void this.pump();
    return this.list();
  }

  private active(): Run | undefined {
    return this.runs.find((run) => run.step !== 'queued');
  }

  private async pump(): Promise<void> {
    if (this.busy || this.active()) return;
    const next = this.runs.find((run) => run.step === 'queued');
    if (next) await this.process(next, true);
  }

  private async process(run: Run, fresh: boolean): Promise<void> {
    this.busy = true;
    try {
      const profile = await this.deps.profile();
      if (!profile.email)
        return this.attention(
          run,
          'Add your email in Settings → Profile, then press Continue.',
        );
      if (fresh) {
        await this.deps.setStatus(run.id, 'continuing');
        this.set(run, 'opening', 'Opening the job page.');
        await this.deps.open(run.url);
      }
      this.set(run, 'signing_in', 'Looking for the application form.');
      let where = await this.deps.locate(fresh);
      if (where === 'account') {
        this.set(run, 'signing_in', 'Signing in to Workday.');
        const result = await this.deps.signIn(profile.email);
        // Already signed in? Apply Manually goes straight to the form.
        where = (await this.deps.waitForForm()) ? 'form' : 'unknown';
        if (where !== 'form')
          return this.attention(
            run,
            result.submission === 'submitted'
              ? 'Workday needs you in the browser, usually to verify your email. Finish there, then press Continue.'
              : 'Sign-in did not go through. Check the browser, then press Continue.',
          );
      }
      if (where !== 'form')
        return this.attention(
          run,
          'Could not find the application form. Get to it in the browser, then press Continue.',
        );
      this.set(run, 'filling', 'Filling this page from your profile.');
      const result = await this.deps.fill(
        profile,
        await this.deps.resumePath(),
      );
      run.filled = [...new Set([...run.filled, ...result.filled])];
      run.missing = result.missing;
      const filled = result.filled.length + Number(result.resumeUploaded);
      this.set(
        run,
        'review',
        `${filled ? `Filled ${filled} field${filled === 1 ? '' : 's'}` : 'Nothing new to fill'}${result.missing.length ? `; ${result.missing.length} need${result.missing.length === 1 ? 's' : ''} you` : ''}. Review in the browser, go to the next page, then press Fill page again.`,
      );
      this.deps.notify(
        `Ready for review: ${run.title}`,
        result.missing.length
          ? `${result.missing.length} field${result.missing.length === 1 ? '' : 's'} need your answer.`
          : 'Check the page in Forkday, then continue.',
      );
    } catch (error) {
      this.attention(
        run,
        error instanceof Error && error.message.length < 200
          ? `${error.message} Check the browser, then press Continue.`
          : 'Something went wrong on the page. Check the browser, then press Continue.',
      );
    } finally {
      this.busy = false;
      this.emit();
    }
  }

  private attention(run: Run, detail: string): void {
    this.set(run, 'attention', detail);
    this.deps.notify(`Needs you: ${run.title}`, detail);
  }

  private set(run: Run, step: RunStep, detail: string): void {
    run.step = step;
    if (detail) run.detail = detail;
    run.updatedAt = new Date().toISOString();
    this.emit();
  }

  private emit(): void {
    this.deps.changed(this.list());
  }
}
