export type ProviderId = 'codex';

export interface ProviderHealth {
  id: ProviderId;
  installed: boolean;
  authenticated: boolean;
  version?: string;
  authMethod?: string;
  error?: string;
  usageInformation: string;
}

export interface ModelRequest {
  prompt: string;
}

export interface ModelResponse {
  status: 'ok';
  message: string;
}

export interface InvocationRecord {
  timestamp: string;
  provider: ProviderId;
  durationMs: number;
  success: boolean;
  errorType?: string;
}

export interface AuthenticationLaunch {
  started: boolean;
  message: string;
}

export interface Job {
  id: string;
  title: string;
  url: string;
  status: 'queued' | 'opening' | 'running' | 'completed' | 'failed';
  error?: string;
}

export type AccountPageKind =
  'sign_in_options' | 'create_account' | 'sign_in' | 'unknown';

export interface AccountFormResult {
  page: AccountPageKind;
  filled: string[];
}

export interface ForkdayApi {
  fillAccountForm(email: string): Promise<AccountFormResult>;
  openBrowser(url: string): Promise<void>;
  setBrowserVisible(visible: boolean): Promise<void>;
  listJobs(): Promise<Job[]>;
  addJob(url: string): Promise<Job[]>;
  showJob(id: string): Promise<void>;
  showDashboard(): Promise<void>;
  completeJob(id: string): Promise<Job[]>;
  getProviderStatus(): Promise<ProviderHealth>;
  testProvider(): Promise<ModelResponse>;
  authenticate(): Promise<AuthenticationLaunch>;
  getRecentInvocations(): Promise<InvocationRecord[]>;
}
