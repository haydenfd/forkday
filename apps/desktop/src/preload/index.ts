import { contextBridge, ipcRenderer } from 'electron';

import type { ForkdayApi } from '../shared/contracts';

function subscribe<T>(channel: string, listener: (value: T) => void) {
  const handler = (_event: Electron.IpcRendererEvent, value: T): void =>
    listener(value);
  ipcRenderer.on(channel, handler);
  return () => {
    ipcRenderer.removeListener(channel, handler);
  };
}

const api: ForkdayApi = {
  listCredentials: () => ipcRenderer.invoke('credentials:list'),
  revealCredentialPassword: (origin, email) =>
    ipcRenderer.invoke('credentials:reveal', { origin, email }),
  getProfile: () => ipcRenderer.invoke('profile:get'),
  saveProfile: (profile) => ipcRenderer.invoke('profile:save', profile),
  saveProfileSection: (section, profile) =>
    ipcRenderer.invoke('profile:save-section', { section, profile }),
  getResume: () => ipcRenderer.invoke('resume:get'),
  uploadResume: () => ipcRenderer.invoke('resume:upload'),
  openResume: () => ipcRenderer.invoke('resume:open'),
  listApplications: () => ipcRenderer.invoke('applications:list'),
  addApplication: (application) =>
    ipcRenderer.invoke('applications:add', application),
  updateApplication: (update) =>
    ipcRenderer.invoke('applications:update', update),
  fillAccountForm: () => ipcRenderer.invoke('browser:fill-account'),
  openBrowser: (url) => ipcRenderer.invoke('browser:open', url),
  setBrowserVisible: (visible) =>
    ipcRenderer.invoke('browser:visible', visible),
  removeApplication: (id) => ipcRenderer.invoke('applications:remove', id),
  listRuns: () => ipcRenderer.invoke('runs:list'),
  startRun: (id) => ipcRenderer.invoke('runs:start', id),
  continueRun: (id) => ipcRenderer.invoke('runs:continue', id),
  finishRun: (id, outcome) =>
    ipcRenderer.invoke('runs:finish', { id, outcome }),
  onRunsChanged: (listener) => subscribe('runs:changed', listener),
  onNavigate: (listener) => subscribe('app:navigate', listener),
  onNotificationFailed: (listener) =>
    subscribe('notification:failed', listener),
  getBridgeStatus: () => ipcRenderer.invoke('bridge:status'),
  testNotification: () => ipcRenderer.invoke('notification:test'),
  openNotificationSettings: () => ipcRenderer.invoke('notification:settings'),
  getProviderStatus: () => ipcRenderer.invoke('provider:status'),
  testProvider: () => ipcRenderer.invoke('provider:test'),
  authenticate: () => ipcRenderer.invoke('provider:authenticate'),
  getRecentInvocations: () => ipcRenderer.invoke('history:list'),
};

contextBridge.exposeInMainWorld('forkday', api);
