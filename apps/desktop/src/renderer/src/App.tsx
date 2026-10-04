import { useEffect, useRef, useState } from 'react';
import { KeyRound, Settings as SettingsIcon, UserRound } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/ui/logo';
import { Toaster } from '@/components/ui/toaster';
import { isWorking, runSteps, useRuns } from '@/lib/runs';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import Settings from './Settings';
import JobsDashboard from './JobsDashboard';
import Status from './Status';
import Tasks from './Tasks';
import SavedCredentials from './SavedCredentials';
import Workspace from './Workspace';

// ponytail: hash routes, swap for TanStack Router once there are more pages
const SETTINGS_ROUTE = '#/settings';
const PROFILE_ROUTE = '#/profile';
const CREDENTIALS_ROUTE = '#/credentials';
// Traffic lights live inside the top bar on macOS (titleBarStyle hiddenInset).
const MAC = navigator.userAgent.includes('Mac OS');

export default function App(): React.JSX.Element {
  const [route, setRoute] = useState(location.hash);
  const pageMain = useRef<HTMLElement>(null);
  const runs = useRuns();
  const onSettings =
    route === SETTINGS_ROUTE || route.startsWith(`${SETTINGS_ROUTE}/`);
  const onProfile = route === PROFILE_ROUTE;
  const onCredentials = route === CREDENTIALS_ROUTE;
  const onQueue = route === '#/queue' || route.startsWith('#/queue/');
  const onStatus = route === '#/status';
  const onBrowser = route === '#/browser';
  const onTasks =
    !onSettings &&
    !onProfile &&
    !onCredentials &&
    !onQueue &&
    !onStatus &&
    !onBrowser;
  // Settings tabs share one page so switching tabs does not replay the page transition.
  const page = onSettings ? SETTINGS_ROUTE : onQueue ? '#/queue' : route;
  const activeRun = runs.find((run) => run.step !== 'queued');

  useEffect(() => {
    let previousHash = location.hash;
    const onHashChange = (): void => {
      // Check drafts before changing the page, including Back/Forward navigation.
      if (
        !window.dispatchEvent(
          new Event('forkday:before-navigate', { cancelable: true }),
        )
      ) {
        history.replaceState(null, '', previousHash || '#/');
        return;
      }
      previousHash = location.hash;
      setRoute(location.hash);
    };
    window.addEventListener('hashchange', onHashChange);
    const stopNavigate = window.forkday.onNavigate((next) => {
      location.hash = next;
    });
    let warned = false;
    const stopFailed = window.forkday.onNotificationFailed(() => {
      if (warned) return;
      warned = true;
      toast(
        'System notifications are blocked. Turn them on in Settings → Notifications.',
        'info',
      );
    });
    return () => {
      window.removeEventListener('hashchange', onHashChange);
      stopNavigate();
      stopFailed();
    };
  }, []);

  useEffect(() => {
    pageMain.current?.scrollTo({ top: 0 });
  }, [route]);

  // The browser is a native view layered over the right half; only the
  // Browser page shows it.
  useEffect(() => {
    void window.forkday.setBrowserVisible(onBrowser);
  }, [onBrowser]);

  return (
    <div className="flex h-screen flex-col">
      <header
        className={cn(
          'app-drag flex h-14 shrink-0 items-center gap-5 border-b bg-card pr-3',
          MAC ? 'pl-[104px]' : 'pl-4',
        )}
      >
        <a
          href="#/"
          className="flex items-center gap-2.5 rounded-lg text-[0.9375rem] font-semibold tracking-tight"
        >
          <Logo />
          Forkday
        </a>
        <nav aria-label="Main" className="flex gap-0.5">
          {[
            { href: '#/', label: 'Tasks', active: onTasks },
            { href: '#/browser', label: 'Browser', active: onBrowser },
            { href: '#/queue', label: 'Job queue', active: onQueue },
            { href: '#/status', label: 'Status', active: onStatus },
          ].map(({ href, label, active }) => (
            <a
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
                active && 'bg-secondary text-foreground hover:bg-secondary',
              )}
            >
              {label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          {activeRun && !onBrowser && (
            <a
              href="#/browser"
              className="mr-2 flex max-w-64 items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-secondary"
              title={activeRun.detail}
            >
              <Badge
                variant={runSteps[activeRun.step].variant}
                dot={isWorking(activeRun) ? 'pulse' : true}
              >
                {runSteps[activeRun.step].label}
              </Badge>
              <span className="truncate text-muted-foreground">
                {activeRun.company}
              </span>
            </a>
          )}
          {[
            {
              href: CREDENTIALS_ROUTE,
              label: 'Saved Credentials',
              icon: KeyRound,
              active: onCredentials,
            },
            {
              href: PROFILE_ROUTE,
              label: 'Profile',
              icon: UserRound,
              active: onProfile,
            },
            {
              href: SETTINGS_ROUTE,
              label: 'Settings',
              icon: SettingsIcon,
              active: onSettings,
            },
          ].map(({ href, label, icon: Icon, active }) => (
            <Button
              key={href}
              asChild
              variant="ghost"
              size="icon"
              className={cn(
                'text-muted-foreground hover:text-foreground',
                active && 'bg-secondary text-foreground',
              )}
            >
              <a
                href={href}
                aria-label={label}
                title={label}
                aria-current={active ? 'page' : undefined}
              >
                <Icon />
              </a>
            </Button>
          ))}
        </div>
      </header>

      {onBrowser ? (
        <Workspace runs={runs} />
      ) : (
        <main
          ref={pageMain}
          className="@container min-h-0 flex-1 overflow-y-auto px-8 py-8"
        >
          <div key={page} className="page-enter">
            {onCredentials ? (
              <SavedCredentials />
            ) : onQueue ? (
              <JobsDashboard route={route} runs={runs} />
            ) : onStatus ? (
              <Status />
            ) : onTasks ? (
              <Tasks runs={runs} />
            ) : (
              <Settings route={route} legacyProfile={onProfile} />
            )}
          </div>
        </main>
      )}
      <Toaster besideBrowser={onBrowser} />
    </div>
  );
}
