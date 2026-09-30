import { randomUUID } from 'node:crypto';
import type { Job } from '../shared/contracts';
import type { BrowserManager } from './browserManager';
import { validateBrowserUrl } from './browserUrl.ts';

export class JobQueue {
  private jobs: Job[] = [];
  private activeId?: string;
  private stopped = false;

  private readonly browser: Pick<
    BrowserManager,
    'open' | 'close' | 'setVisible'
  >;

  constructor(browser: Pick<BrowserManager, 'open' | 'close' | 'setVisible'>) {
    this.browser = browser;
  }

  list(): Job[] {
    return this.jobs.map((job) => ({ ...job }));
  }

  add(value: unknown): Job[] {
    const url = validateBrowserUrl(value);
    this.jobs.push({
      id: randomUUID(),
      url,
      title: new URL(url).hostname,
      status: 'queued',
    });
    this.startNext();
    return this.list();
  }

  show(id: unknown): void {
    const job = this.find(id);
    this.browser.setVisible(job.id === this.activeId);
  }

  home(): void {
    this.browser.setVisible(false);
  }

  complete(id: unknown): Job[] {
    const job = this.find(id);
    if (job.id !== this.activeId || job.status !== 'running') {
      throw new Error('Only the active application can be completed.');
    }
    job.status = 'completed';
    this.activeId = undefined;
    this.browser.close();
    this.startNext();
    return this.list();
  }

  stop(): void {
    this.stopped = true;
    this.browser.close();
  }

  private find(id: unknown): Job {
    const job = this.jobs.find((job) => job.id === id);
    if (!job) throw new Error('Application not found.');
    return job;
  }

  private startNext(): void {
    if (this.activeId || this.stopped) return;
    const job = this.jobs.find((job) => job.status === 'queued');
    if (!job) return;
    this.activeId = job.id;
    job.status = 'opening';
    this.browser.setVisible(false);
    void this.browser
      .open(job.url)
      .then(() => {
        job.status = 'running';
      })
      .catch((error: unknown) => {
        if (this.stopped) return;
        job.status = 'failed';
        job.error = error instanceof Error ? error.message : String(error);
        this.activeId = undefined;
        this.browser.close();
        this.startNext();
      });
  }
}
