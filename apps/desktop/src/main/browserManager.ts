import { chromium, type BrowserContext } from 'playwright';

export function validateBrowserUrl(value: unknown): string {
  if (typeof value !== 'string' || value.length > 8_192) {
    throw new Error('Enter a valid HTTP or HTTPS job URL.');
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Enter a valid HTTP or HTTPS job URL.');
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password
  ) {
    throw new Error('Use an HTTP or HTTPS URL without embedded credentials.');
  }
  return url.href;
}

export class BrowserManager {
  private context?: BrowserContext;
  private pending: Promise<void> = Promise.resolve();
  private closing = false;
  private readonly profilePath: string;

  constructor(profilePath: string) {
    this.profilePath = profilePath;
  }

  open(value: unknown): Promise<void> {
    const url = validateBrowserUrl(value);
    if (this.closing) throw new Error('Forkday is closing.');

    const operation = this.pending.then(async () => {
      if (!this.context) {
        const context = await chromium.launchPersistentContext(
          this.profilePath,
          {
            headless: false,
            chromiumSandbox: true,
            viewport: null,
          },
        );
        this.context = context;
        context.on('close', () => {
          if (this.context === context) this.context = undefined;
        });
      }
      const page = this.context.pages()[0] ?? (await this.context.newPage());
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await page.bringToFront();
    });
    this.pending = operation.catch(() => {});
    return operation;
  }

  async close(): Promise<void> {
    this.closing = true;
    await this.pending;
    await this.context?.close();
    this.context = undefined;
  }
}
