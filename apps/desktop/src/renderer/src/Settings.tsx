import {
  Bell,
  FileText,
  UserRound,
  ClipboardList,
  Puzzle,
  ShieldCheck,
  Terminal,
} from 'lucide-react';
import { useState } from 'react';
import Profile, { type ProfileSection } from './Profile';
import CodexSettings from './CodexSettings';
import { ExtensionSettings, NotificationSettings } from './Integrations';
import { cn } from '@/lib/utils';

const tabs = [
  { id: 'profile', label: 'Profile', icon: UserRound },
  { id: 'resume', label: 'Resume', icon: FileText },
  { id: 'answers', label: 'Application answers', icon: ClipboardList },
  { id: 'disclosures', label: 'Disclosures', icon: ShieldCheck },
  { id: 'extension', label: 'Extension', icon: Puzzle },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'codex', label: 'Codex', icon: Terminal },
] as const;
const profileTabs = ['profile', 'resume', 'answers', 'disclosures'];

export default function Settings({
  route,
  legacyProfile = false,
}: {
  route: string;
  legacyProfile?: boolean;
}): React.JSX.Element {
  const requested = route.split('/')[2];
  const tab = tabs.find((item) => item.id === requested)?.id ?? 'profile';
  const onProfile = profileTabs.includes(tab);
  const [actions, setActions] = useState<HTMLElement | null>(null);
  return (
    <section>
      {/* Full-width pinned band with one strict bottom border; content scrolls under it.
          Negative margins and -top-8 cancel main's padding: sticky offsets start
          inside the scroll padding, so top-0 would push the band over the content. */}
      <div className="sticky -top-8 z-10 -mx-8 -mt-8 mb-8 border-b bg-background px-8 pt-8">
        <div className="mx-auto max-w-5xl">
          <header className="flex min-h-9 items-center justify-between gap-4">
            <h1 className="text-2xl font-semibold tracking-tight">
              {legacyProfile ? 'Profile' : 'Settings'}
            </h1>
            <div ref={setActions} />
          </header>
          <nav
            aria-label="Settings sections"
            className="-mx-3 mt-4 flex gap-1 overflow-x-auto [scrollbar-width:none]"
          >
            {tabs.map(({ id, label, icon: Icon }) => (
              <a
                key={id}
                href={`#/settings/${id}`}
                aria-current={tab === id ? 'page' : undefined}
                className={cn(
                  // Underline sits on the band's border; focus ring stays inside the tab.
                  'relative flex shrink-0 items-center gap-2 px-3 pb-3.5 pt-2 text-sm font-medium text-muted-foreground after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full hover:text-foreground focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand',
                  tab === id && 'text-foreground after:bg-brand',
                )}
              >
                <Icon className="size-4" />
                {label}
              </a>
            ))}
          </nav>
        </div>
      </div>
      <div className="mx-auto max-w-5xl">
        {/* Profile stays mounted on other tabs so its unsaved-changes guard keeps working. */}
        <div hidden={!onProfile}>
          <Profile
            section={onProfile ? (tab as ProfileSection) : 'profile'}
            actions={onProfile ? actions : null}
          />
        </div>
        <div key={tab} className="page-enter">
          {tab === 'codex' && <CodexSettings />}
          {tab === 'extension' && <ExtensionSettings />}
          {tab === 'notifications' && <NotificationSettings />}
        </div>
      </div>
    </section>
  );
}
