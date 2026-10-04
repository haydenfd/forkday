import {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  safeStorage,
  dialog,
  Notification,
} from 'electron';
import path from 'node:path';

import type {
  BridgeStatus,
  ModelResponse,
  NotificationTest,
} from '../shared/contracts';
import { CredentialStore } from './credentialStore';
import { BrowserManager } from './browserManager';
import { ApplyRunner } from './applyRunner';
import { BRIDGE_PORT, startBridge } from './extensionBridge';
import { validateBrowserUrl } from './browserUrl';
import {
  fillApplicationPage,
  locateStep,
  startApplication,
  waitForApplicationForm,
} from './workday/applicationForm';
import { InvocationHistory } from './history';
import { resolveLoginShellPath } from './path';
import { ProcessManager } from './processManager';
import { ProfileStore } from './profileStore';
import { ResumeStore } from './resumeStore';
import { ApplicationStore } from './applicationStore';
import { applicationNotification } from './applicationNotifications';
import type { Application } from '../shared/applications';
import { CodexProvider, ProviderError } from './providers/codexProvider';

// Playwright connects only over loopback, using Chromium's ephemeral port.
app.commandLine.appendSwitch('remote-debugging-address', '127.0.0.1');
app.commandLine.appendSwitch('remote-debugging-port', '0');

const processes = new ProcessManager();
const history = new InvocationHistory();
const notifications = new Set<Notification>();
let provider: CodexProvider;
let browser: BrowserManager;
let runner: ApplyRunner;
let credentials: CredentialStore;
let mainWindow: BrowserWindow | undefined;
const extensionPath = path.resolve(app.getAppPath(), '../extension');
let bridge: BridgeStatus = {
  listening: false,
  port: BRIDGE_PORT,
  extensionPath,
};
const icon = path.join(__dirname, '../../resources/icon.png');

const ownsInstance = app.requestSingleInstanceLock();
if (!ownsInstance) app.quit();

async function createWindow(): Promise<void> {
  const window = new BrowserWindow({
    width: 1280,
    height: 680,
    minWidth: 900,
    minHeight: 560,
    title: 'Forkday',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow = window;
  window.on('closed', () => {
    mainWindow = undefined;
  });
  browser = new BrowserManager(window, credentials);

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (url !== window.webContents.getURL()) event.preventDefault();
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    await window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    await window.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

function registerIpc(): void {
  const profiles = new ProfileStore(app.getPath('userData'));
  const resumes = new ResumeStore(app.getPath('userData'));
  const applications = new ApplicationStore(app.getPath('userData'));
  const notify = (before: Application[], after: Application[]): void => {
    const message = applicationNotification(before, after);
    if (message) showNotification(message.title, message.body, '#/');
  };
  runner = new ApplyRunner({
    open: async (url) => browser.open(url),
    close: () => browser.close(),
    locate: (start) =>
      browser.withPage(async (page) => {
        if (start) await startApplication(page);
        return locateStep(page);
      }),
    signIn: (email) => browser.fillAccountForm(email),
    waitForForm: () => browser.withPage(waitForApplicationForm),
    fill: (profile, resumePath) =>
      browser.withPage((page) =>
        fillApplicationPage(page, profile, resumePath),
      ),
    profile: () => profiles.load(),
    resumePath: async () => {
      const resume = await resumes.load();
      return resume ? resumes.filePath(resume) : undefined;
    },
    setStatus: async (id, status) => {
      await applications.update({ id, status }).catch(() => {});
    },
    notify: (title, body) => showNotification(title, body, '#/browser'),
    changed: (runs) => mainWindow?.webContents.send('runs:changed', runs),
  });
  const enqueue = async (id: unknown): Promise<void> => {
    const application = (await applications.list()).find(
      (item) => item.id === id,
    );
    if (!application) throw new Error('Application not found.');
    workdayUrl(application.url);
    runner.enqueue(application);
  };
  void startBridge({
    apply: async ({ url, title, company }) => {
      const href = workdayUrl(url);
      let application = (await applications.list()).find(
        (item) => item.url === href,
      );
      if (!application) {
        application = (
          await applications.add({ url: href, title, company })
        ).find((item) => item.url === href)!;
        showNotification(
          `Queued: ${application.title}`,
          `${application.company} · Forkday will start it when the browser is free.`,
          '#/browser',
        );
      }
      if (application.status === 'completed')
        return {
          state: 'completed',
          message: 'You already applied to this job.',
        };
      runner.enqueue(application);
      return describeRun(href);
    },
    status: async (url) => describeRun(new URL(url).href),
    focus: () => focusWindow('#/browser'),
  })
    .then(({ port }) => {
      bridge = { listening: true, port, extensionPath };
    })
    .catch((error: unknown) => {
      bridge = {
        listening: false,
        port: BRIDGE_PORT,
        extensionPath,
        error:
          (error as NodeJS.ErrnoException).code === 'EADDRINUSE'
            ? `Port ${BRIDGE_PORT} is in use by another app.`
            : 'The extension connection could not start.',
      };
    });
  const describeRun = async (
    url: string,
  ): Promise<{ state: string; message: string }> => {
    const run = runner.find(url);
    if (run)
      return {
        state: run.step,
        message:
          run.step === 'queued'
            ? `Queued in Forkday · #${runner.position(run)} in line`
            : run.step === 'review'
              ? 'Ready for your review in Forkday'
              : run.detail,
      };
    const application = (await applications.list()).find(
      (item) => item.url === url,
    );
    return application
      ? {
          state: application.status,
          message:
            application.status === 'completed'
              ? 'You already applied to this job.'
              : `In Forkday: ${application.status}`,
        }
      : { state: 'none', message: '' };
  };
  const jobHandlers = {
    'credentials:list': () => credentials.list(),
    'credentials:reveal': (value: unknown) => credentials.revealPassword(value),
    'profile:get': () => profiles.load(),
    'profile:save': (profile: unknown) => profiles.save(profile),
    'profile:save-section': (value: unknown) => profiles.saveSection(value),
    'resume:get': () => resumes.load(),
    'resume:upload': async () => {
      const selection = await dialog.showOpenDialog({
        title: 'Choose your resume',
        properties: ['openFile'],
        filters: [{ name: 'PDF resume', extensions: ['pdf'] }],
      });
      if (selection.canceled || !selection.filePaths[0]) return null;
      return resumes.import(selection.filePaths[0]);
    },
    'resume:open': async () => {
      const resume = await resumes.load();
      if (!resume) throw new Error('Upload a resume first.');
      const error = await shell.openPath(resumes.filePath(resume));
      if (error) throw new Error(error);
    },
    'applications:list': () => applications.list(),
    'applications:add': async (value: unknown) => {
      const before = await applications.list();
      const after = await applications.add(value);
      notify(before, after);
      return after;
    },
    'applications:update': async (value: unknown) => {
      const before = await applications.list();
      const after = await applications.update(value);
      notify(before, after);
      return after;
    },
    'applications:remove': async (id: unknown) => {
      if (runner.list().some((run) => run.id === id))
        await runner.finish(id, 'dequeue');
      return applications.remove(id);
    },
    'runs:list': () => runner.list(),
    'runs:start': async (id: unknown) => {
      await enqueue(id);
      return runner.list();
    },
    'runs:continue': (id: unknown) => runner.continue(id),
    'runs:finish': (value: unknown) => {
      const { id, outcome } = (value ?? {}) as Record<string, unknown>;
      if (
        outcome !== 'completed' &&
        outcome !== 'stopped' &&
        outcome !== 'dequeue'
      )
        throw new Error('Unknown outcome.');
      return runner.finish(id, outcome);
    },
    'bridge:status': () => bridge,
    'notification:test': () => testNotification(),
    'notification:settings': () =>
      shell.openExternal(
        process.platform === 'darwin'
          ? 'x-apple.systempreferences:com.apple.Notifications-Settings.extension'
          : 'ms-settings:notifications',
      ),
    'browser:fill-account': async () => {
      const { email } = await profiles.load();
      if (!email) throw new Error('Add your email in Profile.');
      return browser.fillAccountForm(email);
    },
    'browser:open': async (url: unknown) => {
      if (runner.list().some((run) => run.step !== 'queued'))
        throw new Error('Finish or stop the current application first.');
      browser.setVisible(true);
      await browser.open(url);
    },
    'browser:visible': (visible: unknown) =>
      browser.setVisible(visible === true),
  };
  for (const [channel, handler] of Object.entries(jobHandlers)) {
    ipcMain.handle(channel, (event, value: unknown) => {
      if (
        event.senderFrame !== event.sender.mainFrame ||
        !BrowserWindow.fromWebContents(event.sender)
      ) {
        throw new Error('Requests must come from the Forkday window.');
      }
      return handler(value);
    });
  }
  ipcMain.handle('provider:status', () => provider.healthcheck());
  ipcMain.handle('provider:authenticate', () =>
    provider.authenticate((url) => shell.openExternal(url)),
  );
  ipcMain.handle('history:list', () => history.recent());
  ipcMain.handle('provider:test', async (): Promise<ModelResponse> => {
    const startedAt = Date.now();
    try {
      const response = await provider.complete({
        prompt:
          'Return this exact JSON object and nothing else: {"status":"ok","message":"Forkday provider test successful"}',
      });
      history.add({
        timestamp: new Date().toISOString(),
        provider: 'codex',
        durationMs: Date.now() - startedAt,
        success: true,
      });
      return response;
    } catch (error) {
      history.add({
        timestamp: new Date().toISOString(),
        provider: 'codex',
        durationMs: Date.now() - startedAt,
        success: false,
        errorType: error instanceof ProviderError ? error.type : 'unknown',
      });
      throw error;
    }
  });
}

function workdayUrl(value: unknown): string {
  const href = validateBrowserUrl(value);
  const url = new URL(href);
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.myworkdayjobs.com'))
    throw new Error(
      'Forkday can apply to Workday jobs (myworkdayjobs.com) only.',
    );
  return url.href;
}

function focusWindow(route?: string): void {
  const window = mainWindow;
  if (!window) return;
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
  if (route) window.webContents.send('app:navigate', route);
}

function showNotification(
  title: string,
  body: string,
  route: string,
): Notification | undefined {
  if (!Notification.isSupported()) return;
  try {
    const notification = new Notification({ title, body, icon });
    notifications.add(notification);
    const release = (): void => {
      notifications.delete(notification);
    };
    notification.once('close', release);
    notification.once('failed', (_event, error: string) => {
      release();
      console.warn('System notification failed:', error);
      mainWindow?.webContents.send('notification:failed', title);
    });
    notification.once('click', () => {
      release();
      focusWindow(route);
    });
    notification.show();
    return notification;
  } catch (error) {
    console.warn('System notification failed:', error);
  }
}

function testNotification(): Promise<NotificationTest> {
  const notification = showNotification(
    'Notifications are on',
    'Forkday will tell you when an application needs you.',
    '#/settings/notifications',
  );
  if (!notification)
    return Promise.resolve({
      shown: false,
      error: 'This system does not support notifications.',
    });
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ shown: true }), 4000);
    notification.once('show', () => {
      clearTimeout(timer);
      resolve({ shown: true });
    });
    notification.once('failed', (_event, error: string) => {
      clearTimeout(timer);
      resolve({ shown: false, error });
    });
  });
}

if (ownsInstance)
  app.whenReady().then(async () => {
    // Windows groups notifications by this id; macOS uses the bundle.
    app.setAppUserModelId('com.forkday.desktop');
    const loginPath = await resolveLoginShellPath(processes);
    process.env.PATH = loginPath;
    provider = new CodexProvider(processes, loginPath);
    credentials = new CredentialStore(app.getPath('userData'), safeStorage);
    registerIpc();
    await createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) void createWindow();
    });
  });

app.on('second-instance', () => focusWindow());
app.on('before-quit', () => {
  processes.killAll();
  browser?.close();
});
app.on('window-all-closed', () => {
  app.quit();
});
