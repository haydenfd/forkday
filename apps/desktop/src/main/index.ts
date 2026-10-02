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

import type { ModelResponse } from '../shared/contracts';
import { CredentialStore } from './credentialStore';
import { BrowserManager } from './browserManager';
import { JobQueue } from './jobQueue';
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
let jobs: JobQueue;
let credentials: CredentialStore;

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

  browser = new BrowserManager(window, credentials);
  jobs = new JobQueue(browser);

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
    if (!message || !Notification.isSupported()) return;
    try {
      const notification = new Notification(message);
      notifications.add(notification);
      const release = (): void => {
        notifications.delete(notification);
      };
      notification.once('close', release);
      notification.once('failed', (_event, error: string) => {
        release();
        console.warn('System notification failed:', error);
      });
      notification.once('click', () => {
        release();
        const window = BrowserWindow.getAllWindows()[0];
        if (!window) return;
        if (window.isMinimized()) window.restore();
        window.show();
        window.focus();
        void window.webContents.executeJavaScript("location.hash = '#/'");
      });
      notification.show();
    } catch (error) {
      console.warn('System notification failed:', error);
    }
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
    'browser:fill-account': async () => {
      const { email } = await profiles.load();
      if (!email) throw new Error('Add your email in Profile.');
      return browser.fillAccountForm(email);
    },
    'browser:open': async (url: unknown) => {
      browser.setVisible(true);
      await browser.open(url);
    },
    'browser:visible': (visible: unknown) =>
      browser.setVisible(visible === true),
    'jobs:list': () => jobs.list(),
    'jobs:add': (url: unknown) => jobs.add(url),
    'jobs:show': (id: unknown) => jobs.show(id),
    'jobs:home': () => jobs.home(),
    'jobs:complete': (id: unknown) => jobs.complete(id),
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

if (ownsInstance)
  app.whenReady().then(async () => {
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

app.on('before-quit', () => {
  processes.killAll();
  jobs?.stop();
});
app.on('window-all-closed', () => {
  app.quit();
});
