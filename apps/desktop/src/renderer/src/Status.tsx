import { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, RefreshCw } from 'lucide-react';
import type { ProviderHealth } from '../../shared/contracts';
import type { Profile } from '../../shared/profile';
import { CompleteProfileSchema, US_COUNTRY } from '../../shared/profile';
import type { Resume } from '../../shared/resume';
import type { Application } from '../../shared/applications';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type Snapshot = {
  profile?: Profile;
  resume?: Resume | null;
  health?: ProviderHealth;
  applications?: Application[];
};
export default function Status(): React.JSX.Element {
  const [snapshot, setSnapshot] = useState<Snapshot>({});
  const [busy, setBusy] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const refresh = useCallback(async (): Promise<void> => {
    setBusy(true);
    setErrors([]);
    const results = await Promise.allSettled([
      window.forkday.getProfile(),
      window.forkday.getResume(),
      window.forkday.getProviderStatus(),
      window.forkday.listApplications(),
    ]);
    const [profile, resume, health, applications] = results;
    setSnapshot({
      profile: profile.status === 'fulfilled' ? profile.value : undefined,
      resume: resume.status === 'fulfilled' ? resume.value : undefined,
      health: health.status === 'fulfilled' ? health.value : undefined,
      applications:
        applications.status === 'fulfilled' ? applications.value : undefined,
    });
    setErrors(
      results.flatMap((result) =>
        result.status === 'rejected' ? [errorMessage(result.reason)] : [],
      ),
    );
    setBusy(false);
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const { profile, resume, health, applications } = snapshot;
  const answersReady = Boolean(
    profile?.workAuthorizationCountry === US_COUNTRY &&
    profile.authorizedToWork &&
    profile.sponsorshipNow &&
    profile.sponsorshipFuture,
  );
  const cards = [
    {
      label: 'Profile',
      ready: profile
        ? CompleteProfileSchema.safeParse(profile).success
        : undefined,
      detail: profile?.firstName
        ? `${profile.firstName} ${profile.lastName ?? ''} · ${profile.email ?? 'Email needed'}`
        : 'Add your contact information and address.',
      href: '#/settings/profile',
    },
    {
      label: 'Resume',
      ready: resume === undefined ? undefined : Boolean(resume),
      detail: resume?.name ?? 'Upload a PDF and save your resume content.',
      href: '#/settings/resume',
    },
    {
      label: 'Application answers',
      ready: profile ? answersReady : undefined,
      detail: answersReady
        ? 'US authorization answers saved.'
        : 'Review US work authorization and sponsorship.',
      href: '#/settings/answers',
    },
    {
      label: 'Codex',
      ready: health ? health.installed && health.authenticated : undefined,
      detail: health?.authenticated
        ? (health.version ?? 'Connected to your local Codex CLI.')
        : (health?.error ?? 'Check the local Codex connection.'),
      href: '#/settings/codex',
    },
  ];
  return (
    <section className="mx-auto w-full max-w-5xl" aria-busy={busy}>
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Status</h1>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => void refresh()}
        >
          <RefreshCw
            aria-hidden
            className={busy ? 'animate-spin' : undefined}
          />
          {busy ? 'Checking…' : 'Refresh'}
        </Button>
      </header>
      {errors.length > 0 && (
        <div
          role="alert"
          className="mt-5 rounded-xl bg-destructive-soft p-4 text-sm text-destructive"
        >
          {errors.map((error, index) => (
            <p key={index}>{error}</p>
          ))}
        </div>
      )}
      <div className="mt-7 grid gap-4 sm:grid-cols-2">
        {cards.map(({ label, ready, detail, href }) => (
          <Card key={label} className="flex flex-col p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">{label}</h2>
              <Badge
                variant={
                  busy || ready === undefined
                    ? 'secondary'
                    : ready
                      ? 'success'
                      : 'warning'
                }
              >
                {busy
                  ? 'Checking'
                  : ready === undefined
                    ? 'Unavailable'
                    : ready
                      ? 'Ready'
                      : 'Needs setup'}
              </Badge>
            </div>
            <p className="my-4 flex-1 break-words text-sm text-muted-foreground">
              {detail}
            </p>
            <a
              className="inline-flex items-center gap-2 text-sm font-medium text-brand"
              href={href}
            >
              Open settings
              <ArrowUpRight className="size-4" />
            </a>
          </Card>
        ))}
      </div>
      <Card className="mt-6 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Applications</h2>
          <a href="#/queue" className="text-sm font-medium text-brand">
            Open job queue →
          </a>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-5">
          {(
            [
              'waiting',
              'continuing',
              'completed',
              'rejected',
              'stopped',
            ] as const
          ).map((status) => (
            <div key={status}>
              <p className="text-2xl font-semibold">
                {applications
                  ? applications.filter((item) => item.status === status).length
                  : '—'}
              </p>
              <p className="mt-1 text-sm capitalize text-muted-foreground">
                {status}
              </p>
            </div>
          ))}
        </div>
      </Card>
      <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
        Profile details, resume files, and the queue are stored on this
        computer. Application status is updated by you. Optional disclosures do
        not affect setup readiness.
      </p>
    </section>
  );
}
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
