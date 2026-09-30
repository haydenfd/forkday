import { contextBridge, ipcRenderer } from 'electron';

import type { ForkdayApi } from '../shared/contracts';

const api: ForkdayApi = {
  openBrowser: (url) => ipcRenderer.invoke('browser:open', url),
  listJobs: () => ipcRenderer.invoke('jobs:list'),
  addJob: (url) => ipcRenderer.invoke('jobs:add', url),
  showJob: (id) => ipcRenderer.invoke('jobs:show', id),
  showDashboard: () => ipcRenderer.invoke('jobs:home'),
  completeJob: (id) => ipcRenderer.invoke('jobs:complete', id),
  getProviderStatus: () => ipcRenderer.invoke('provider:status'),
  testProvider: () => ipcRenderer.invoke('provider:test'),
  authenticate: () => ipcRenderer.invoke('provider:authenticate'),
  getRecentInvocations: () => ipcRenderer.invoke('history:list'),
};

contextBridge.exposeInMainWorld('forkday', api);
