import {
  FileText,
  UserRound,
  ClipboardList,
  ShieldCheck,
  Terminal,
} from 'lucide-react';
import Profile, { type ProfileSection } from './Profile';
import CodexSettings from './CodexSettings';
import { cn } from '@/lib/utils';

const tabs = [
  { id: 'profile', label: 'Profile', icon: UserRound },
  { id: 'resume', label: 'Resume', icon: FileText },
  { id: 'answers', label: 'Application answers', icon: ClipboardList },
  { id: 'disclosures', label: 'Disclosures', icon: ShieldCheck },
  { id: 'codex', label: 'Codex', icon: Terminal },
] as const;

export default function Settings({
  route,
  legacyProfile = false,
}: {
  route: string;
  legacyProfile?: boolean;
}): React.JSX.Element {
  const requested = route.split('/')[2];
  const tab = tabs.find((item) => item.id === requested)?.id ?? 'profile';
  return (
    <section className="mx-auto w-full max-w-5xl">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {legacyProfile ? 'Profile' : 'Settings'}
        </h1>
      </header>
      <nav
        aria-label="Settings sections"
        className="my-7 flex gap-1 overflow-x-auto border-b pb-3"
      >
        {tabs.map(({ id, label, icon: Icon }) => (
          <a
            key={id}
            href={`#/settings/${id}`}
            aria-current={tab === id ? 'page' : undefined}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
              tab === id && 'bg-brand-soft text-brand-strong',
            )}
          >
            <Icon className="size-4" />
            {label}
          </a>
        ))}
      </nav>
      <div hidden={tab === 'codex'}>
        <Profile
          section={tab === 'codex' ? 'profile' : (tab as ProfileSection)}
        />
      </div>
      {tab === 'codex' && <CodexSettings />}
    </section>
  );
}
