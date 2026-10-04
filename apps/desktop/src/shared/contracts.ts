import type { Profile, ProfileSection } from './profile';
import type { Resume } from './resume';
import type {
  Application,
  NewApplication,
  ApplicationUpdate,
} from './applications';

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

/** Working steps first; `review` and `attention` wait for the user. */
export type RunStep =
  'queued' | 'opening' | 'signing_in' | 'filling' | 'review' | 'attention';

/** An application Forkday is applying to in the embedded browser. */
export interface Run {
  id: string;
  url: string;
  title: string;
  company: string;
  step: RunStep;
  detail: string;
  filled: string[];
  missing: string[];
  updatedAt: string;
}

export interface BridgeStatus {
  listening: boolean;
  port: number;
  error?: string;
  /** Folder to load as an unpacked/temporary extension. */
  extensionPath: string;
}

export interface NotificationTest {
  shown: boolean;
  error?: string;
}

export type AccountPageKind =
  'sign_in_options' | 'create_account' | 'sign_in' | 'unknown';

export interface AccountFormResult {
  page: AccountPageKind;
  filled: string[];
  submission?: 'submitted' | 'failed';
}

export interface SavedCredential {
  company: string;
  origin: string;
  email: string;
}

export interface ForkdayApi {
  listCredentials(): Promise<SavedCredential[]>;
  revealCredentialPassword(origin: string, email: string): Promise<string>;
  getProfile(): Promise<Profile>;
  saveProfile(profile: Profile): Promise<void>;
  saveProfileSection(
    section: ProfileSection,
    profile: Profile,
  ): Promise<Profile>;
  getResume(): Promise<Resume | null>;
  uploadResume(): Promise<Resume | null>;
  openResume(): Promise<void>;
  listApplications(): Promise<Application[]>;
  addApplication(application: NewApplication): Promise<Application[]>;
  updateApplication(update: ApplicationUpdate): Promise<Application[]>;
  fillAccountForm(): Promise<AccountFormResult>;
  openBrowser(url: string): Promise<void>;
  setBrowserVisible(visible: boolean): Promise<void>;
  removeApplication(id: string): Promise<Application[]>;
  listRuns(): Promise<Run[]>;
  startRun(id: string): Promise<Run[]>;
  continueRun(id: string): Promise<Run[]>;
  finishRun(
    id: string,
    outcome: 'completed' | 'stopped' | 'dequeue',
  ): Promise<Run[]>;
  /** Subscribe to run changes; returns an unsubscribe function. */
  onRunsChanged(listener: (runs: Run[]) => void): () => void;
  /** Main asks the renderer to show a page, e.g. from a notification click. */
  onNavigate(listener: (route: string) => void): () => void;
  onNotificationFailed(listener: (message: string) => void): () => void;
  getBridgeStatus(): Promise<BridgeStatus>;
  testNotification(): Promise<NotificationTest>;
  openNotificationSettings(): Promise<void>;
  getProviderStatus(): Promise<ProviderHealth>;
  testProvider(): Promise<ModelResponse>;
  authenticate(): Promise<AuthenticationLaunch>;
  getRecentInvocations(): Promise<InvocationRecord[]>;
}
