import { contextBridge, ipcRenderer } from 'electron';

import type { ForkdayApi } from '../shared/contracts';

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
