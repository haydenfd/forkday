import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'node:path';

import type { ModelResponse } from '../shared/contracts';
import { BrowserManager } from './browserManager';
import { JobQueue } from './jobQueue';
import { InvocationHistory } from './history';
import { resolveLoginShellPath } from './path';
import { ProcessManager } from './processManager';
import { CodexProvider, ProviderError } from './providers/codexProvider';

// Playwright connects only over loopback, using Chromium's ephemeral port.
app.commandLine.appendSwitch('remote-debugging-address', '127.0.0.1');
app.commandLine.appendSwitch('remote-debugging-port', '0');

const processes = new ProcessManager();
const history = new InvocationHistory();
let provider: CodexProvider;
let browser: BrowserManager;
let jobs: JobQueue;

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

  browser = new BrowserManager(window);
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
  const jobHandlers = {
    'browser:fill-account': (email: unknown) => browser.fillAccountForm(email),
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
        throw new Error('Job requests must come from the Forkday window.');
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
