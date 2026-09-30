import { useEffect, useState } from 'react';
import type { AccountFormResult } from '../../shared/contracts';
import {
  Globe,
  Settings as SettingsIcon,
  UserRound,
  FileText,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import Settings from './Settings';
import Profile from './Profile';
import SavedCredentials from './SavedCredentials';

// ponytail: hash routes, swap for TanStack Router once there are more pages
const SETTINGS_ROUTE = '#/settings';
const PROFILE_ROUTE = '#/profile';
const CREDENTIALS_ROUTE = '#/credentials';

export default function App(): React.JSX.Element {
  const [route, setRoute] = useState(location.hash);
  const [draft, setDraft] = useState('');
  const [pageUrl, setPageUrl] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [filling, setFilling] = useState(false);
  const [fillResult, setFillResult] = useState<AccountFormResult>();
  const onSettings = route === SETTINGS_ROUTE;
  const onProfile = route === PROFILE_ROUTE;
  const onCredentials = route === CREDENTIALS_ROUTE;
  const fullWidth = onSettings || onProfile || onCredentials;

  useEffect(() => {
    const onHashChange = (): void => setRoute(location.hash);
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // The browser is a native view layered over the right half; hide it on
  // pages that use the full width.
  useEffect(() => {
    if (pageUrl) void window.forkday.setBrowserVisible(!fullWidth);
  }, [fullWidth, pageUrl]);

  const openPage = async (): Promise<void> => {
    setLoading(true);
    setFillResult(undefined);
    setError(undefined);
    try {
      await window.forkday.openBrowser(draft);
      setPageUrl(draft);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const fillAccount = async (): Promise<void> => {
    setFilling(true);
    setError(undefined);
    setFillResult(undefined);
    try {
      setFillResult(await window.forkday.fillAccountForm());
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setFilling(false);
    }
  };

  return (
    <div className="flex h-screen flex-col">
      <nav className="flex h-14 shrink-0 items-center justify-between border-b bg-card px-6">
        <a href="#/" className="text-lg font-semibold tracking-tight">
          forkday
        </a>
        <div className="flex gap-2">
          <Button
            asChild
            variant="ghost"
            size="icon"
            className={cn(
              'text-muted-foreground',
              onCredentials && 'bg-brand-soft text-brand-strong',
            )}
          >
            <a
              href={CREDENTIALS_ROUTE}
              aria-label="Saved Credentials"
              title="Saved Credentials"
              aria-current={onCredentials ? 'page' : undefined}
            >
              <FileText />
            </a>
          </Button>
          <Button
            asChild
            variant="ghost"
            size="icon"
            className={cn(
              'text-muted-foreground',
              onProfile && 'bg-brand-soft text-brand-strong',
            )}
          >
            <a
              href={PROFILE_ROUTE}
              aria-label="Profile"
              aria-current={onProfile ? 'page' : undefined}
            >
              <UserRound />
            </a>
          </Button>
          <Button
            asChild
            variant="ghost"
            size="icon"
            className={cn(
              'text-muted-foreground',
              onSettings && 'bg-brand-soft text-brand-strong',
            )}
          >
            <a
              href={SETTINGS_ROUTE}
              aria-label="Settings"
              aria-current={onSettings ? 'page' : undefined}
            >
              <SettingsIcon />
            </a>
          </Button>
        </div>
      </nav>

      {fullWidth ? (
        <main className="@container overflow-y-auto px-8 py-8">
          {onCredentials ? (
            <SavedCredentials />
          ) : onProfile ? (
            <Profile />
          ) : (
            <Settings />
          )}
        </main>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-2">
          <main className="overflow-y-auto px-8 py-8">
            <h1 className="text-2xl font-semibold tracking-tight">
              Open a job
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Paste a job URL to load it in the browser on the right.
            </p>

            <form
              className="mt-6 flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void openPage();
              }}
            >
              <label className="sr-only" htmlFor="job-url">
                Job URL
              </label>
              <Input
                id="job-url"
                type="url"
                required
                maxLength={8192}
                placeholder="https://company.myworkdayjobs.com/…"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
              <Button
                type="submit"
                disabled={loading || filling || !draft.trim()}
              >
                {loading ? 'Opening…' : 'Open'}
              </Button>
            </form>

            <form
              className="mt-8 space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void fillAccount();
              }}
            >
              <p className="text-sm text-muted-foreground">
                Click Apply in the browser first. Saved credentials sign you in;
                otherwise Forkday creates an account using your Profile email.
              </p>
              <Button type="submit" disabled={!pageUrl || loading || filling}>
                {filling ? 'Signing in…' : 'Create Account / Sign In'}
              </Button>
            </form>
            {fillResult && (
              <p role="status" className="mt-4 text-sm">
                Page: {fillResult.page}. Filled:{' '}
                {fillResult.filled.join(', ') || 'none'}.
                {fillResult.submission === 'submitted' &&
                  ' Account form submitted. Continue in the browser.'}
                {fillResult.submission === 'failed' &&
                  ' Sign-in was not completed. Review the browser for errors or verification.'}
              </p>
            )}

            {error && (
              <p
                className="mt-4 rounded-lg bg-destructive-soft px-4 py-3 text-sm text-destructive"
                role="alert"
              >
                {error}
              </p>
            )}
          </main>

          {/* Placeholder under the native browser view; visible until a page loads. */}
          <aside className="grid place-items-center border-l bg-card">
            <div className="flex flex-col items-center gap-3 text-center text-muted-foreground">
              <Globe className="size-8 stroke-[1.5]" />
              <p className="text-sm">
                {loading ? 'Loading page…' : 'No page open'}
              </p>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('Add your email in Profile.')
    ? 'Add your email in Profile.'
    : message;
}
