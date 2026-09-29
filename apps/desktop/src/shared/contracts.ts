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

export interface ForkdayApi {
  openBrowser(url: string): Promise<void>;
  getProviderStatus(): Promise<ProviderHealth>;
  testProvider(): Promise<ModelResponse>;
  authenticate(): Promise<AuthenticationLaunch>;
  getRecentInvocations(): Promise<InvocationRecord[]>;
}
