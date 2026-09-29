import { contextBridge, ipcRenderer } from 'electron';

import type { ForkdayApi } from '../shared/contracts';

const api: ForkdayApi = {
  openBrowser: (url) => ipcRenderer.invoke('browser:open', url),
  getProviderStatus: () => ipcRenderer.invoke('provider:status'),
  testProvider: () => ipcRenderer.invoke('provider:test'),
  authenticate: () => ipcRenderer.invoke('provider:authenticate'),
  getRecentInvocations: () => ipcRenderer.invoke('history:list'),
};

contextBridge.exposeInMainWorld('forkday', api);
