import { app, WebContentsView, type BrowserWindow } from 'electron';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, type Browser } from 'playwright';

import type { AccountFormResult } from '../shared/contracts';
import {
  CredentialStorageError,
  type CredentialStore,
} from './credentialStore';
import {
  detectAccountPage,
  fillAccountForm,
  submitAccountForm,
} from './workday/accountForm';
import { generatePassword } from './workday/generatePassword';
import { validateBrowserUrl } from './browserUrl';

// Height of the renderer's top bar (`h-14` in App.tsx); the page sits below it.
const TOP_BAR_HEIGHT = 56;

export class BrowserManager {
  private view?: WebContentsView;
  private visible = false;
  private automation?: Browser;
  private filling = false;

  constructor(
    private readonly window: BrowserWindow,
    private readonly credentials: CredentialStore,
  ) {
    window.on('resize', () => this.resize());
    window.on('closed', () => this.close());
  }

  async open(value: unknown): Promise<void> {
    const url = validateBrowserUrl(value);
    if (!this.view) {
      this.view = new WebContentsView({
        webPreferences: {
          partition: 'persist:forkday-jobs',
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
        },
      });
      const contents = this.view.webContents;
      contents.session.setPermissionRequestHandler(
        (_contents, _permission, callback) => callback(false),
      );
      contents.session.setPermissionCheckHandler(() => false);
      const guardNavigation = (
        event: Electron.Event,
        destination: string,
      ): void => {
        try {
          validateBrowserUrl(destination);
        } catch {
          event.preventDefault();
        }
      };
      contents.on('will-navigate', guardNavigation);
      contents.on('will-redirect', guardNavigation);
      contents.setWindowOpenHandler(({ url }) => {
        void this.open(url).catch(console.error);
        return { action: 'deny' };
      });
      this.window.contentView.addChildView(this.view);
    }
    this.view.setVisible(this.visible);
    this.resize();
    await this.view.webContents.loadURL(url);
  }

  async fillAccountForm(value: unknown): Promise<AccountFormResult> {
    if (
      typeof value !== 'string' ||
      value.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    )
      throw new Error('Enter a valid email address.');
    if (this.filling)
      throw new Error('Account filling is already in progress.');
    const contents = this.view?.webContents;
    if (!contents || contents.isDestroyed())
      return { page: 'unknown', filled: [] };
    const url = new URL(contents.getURL());
    if (
      url.protocol !== 'https:' ||
      !url.hostname.endsWith('.myworkdayjobs.com')
    )
      return { page: 'unknown', filled: [] };
    this.filling = true;
    try {
      if (!this.automation?.isConnected()) {
        const [port, endpoint] = (
          await readFile(
            path.join(app.getPath('userData'), 'DevToolsActivePort'),
            'utf8',
          )
        )
          .trim()
          .split('\n');
        if (!/^\d+$/.test(port) || !endpoint.startsWith('/devtools/browser/'))
          throw new Error('Browser connection unavailable.');
        this.automation = await chromium.connectOverCDP(
          `ws://127.0.0.1:${port}${endpoint}`,
          { timeout: 5000 },
        );
      }
      // Match the actual WebContents target, rather than a URL shared by tabs.
      contents.debugger.attach('1.3');
      let targetId: string;
      try {
        const { targetInfo } = await contents.debugger.sendCommand(
          'Target.getTargetInfo',
        );
        targetId = targetInfo.targetId;
      } finally {
        contents.debugger.detach();
      }
      for (const page of this.automation
        .contexts()
        .flatMap((context) => context.pages())) {
        const session = await page.context().newCDPSession(page);
        let matches: boolean;
        try {
          const { targetInfo } = await session.send('Target.getTargetInfo');
          matches = targetInfo.targetId === targetId;
        } finally {
          await session.detach();
        }
        if (matches) {
          const origin = new URL(page.url()).origin;
          if (origin !== url.origin) return { page: 'unknown', filled: [] };
          const kind = await detectAccountPage(page);
          if (
            kind === 'unknown' &&
            !(await page
              .locator('[data-automation-id="applyManually"]')
              .isVisible())
          )
            return { page: 'unknown', filled: [] };
          const existing = await this.credentials.find(origin, value);
          const password = existing?.password ?? generatePassword();
          if (!existing) {
            const heading = page.getByRole('heading', { level: 1 });
            const title =
              (await heading.count()) === 1
                ? await heading.textContent({ timeout: 3000 })
                : '';
            const company =
              title
                ?.trim()
                .match(/^Careers at (.+)$/i)?.[1]
                ?.slice(0, 200) || url.hostname.split('.')[0];
            // Persist before filling or submission so account creation cannot lose the password.
            await this.credentials.save({
              company,
              origin,
              email: value,
              password,
            });
          }
          if (new URL(page.url()).origin !== origin)
            return { page: 'unknown', filled: [] };
          const result = await fillAccountForm(
            page,
            existing?.email ?? value,
            password,
            !existing,
            Boolean(existing),
          );
          if (new URL(page.url()).origin !== origin)
            return { page: 'unknown', filled: result.filled };
          if (result.page === 'create_account' || result.page === 'sign_in')
            return await submitAccountForm(page, result);
          return result;
        }
      }
      return { page: 'unknown', filled: [] };
    } catch (error) {
      if (error instanceof CredentialStorageError) throw error;
      // Playwright errors can contain input values; never forward them through IPC.
      throw new Error(
        'Could not fill the account form. Check the browser page and retry.',
      );
    } finally {
      this.filling = false;
    }
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.view?.setVisible(visible);
  }

  close(): void {
    const view = this.view;
    this.view = undefined;
    const automation = this.automation;
    this.automation = undefined;
    // Closing a CDP-connected Browser disconnects Playwright, not Electron.
    void automation?.close().catch(() => {});
    if (!view) return;
    if (!this.window.isDestroyed())
      this.window.contentView.removeChildView(view);
    if (!view.webContents.isDestroyed()) view.webContents.close();
  }

  private resize(): void {
    if (!this.view || this.window.isDestroyed()) return;
    const [width, height] = this.window.getContentSize();
    const sidebar = Math.floor(width / 2);
    this.view.setBounds({
      x: sidebar,
      y: TOP_BAR_HEIGHT,
      width: width - sidebar,
      height: height - TOP_BAR_HEIGHT,
    });
  }
}
