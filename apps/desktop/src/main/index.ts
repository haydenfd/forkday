import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'node:path';

import type { ModelResponse } from '../shared/contracts';
import { BrowserManager } from './browserManager';
import { InvocationHistory } from './history';
import { resolveLoginShellPath } from './path';
import { ProcessManager } from './processManager';
import { CodexProvider, ProviderError } from './providers/codexProvider';

const processes = new ProcessManager();
const history = new InvocationHistory();
let provider: CodexProvider;
let browser: BrowserManager;
let quitting = false;
let browserClosed = false;

const ownsInstance = app.requestSingleInstanceLock();
if (!ownsInstance) app.quit();

async function createWindow(): Promise<void> {
  const window = new BrowserWindow({
    width: 820,
    height: 680,
    minWidth: 680,
    minHeight: 560,
    title: 'Forkday',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());

  if (process.env.ELECTRON_RENDERER_URL) {
    await window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    await window.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

function registerIpc(): void {
  ipcMain.handle('browser:open', (event, url: unknown) => {
    if (event.senderFrame !== event.sender.mainFrame) {
      throw new Error('Browser requests must come from the Forkday window.');
    }
    return browser.open(url);
  });
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
    browser = new BrowserManager(
      path.join(app.getPath('userData'), 'browser-profile'),
    );
    registerIpc();
    await createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) void createWindow();
    });
  });

app.on('before-quit', (event) => {
  processes.killAll();
  if (!browser || browserClosed) return;
  event.preventDefault();
  if (quitting) return;
  quitting = true;
  void browser
    .close()
    .catch(console.error)
    .finally(() => {
      browserClosed = true;
      app.quit();
    });
});
app.on('window-all-closed', () => {
  app.quit();
});
