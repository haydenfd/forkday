import { useEffect, useState } from 'react';
import { Bell, Check, Copy, LoaderCircle, Puzzle } from 'lucide-react';
import type { BridgeStatus } from '../../shared/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from '@/lib/toast';
import { errorMessage } from '@/lib/utils';

export function ExtensionSettings(): React.JSX.Element {
  const [bridge, setBridge] = useState<BridgeStatus>();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    void window.forkday.getBridgeStatus().then(setBridge);
  }, []);
  const copy = async (): Promise<void> => {
    if (!bridge) return;
    await navigator.clipboard.writeText(bridge.extensionPath);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="max-w-2xl space-y-6">
      <Card className="p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-lg bg-secondary p-2.5 text-muted-foreground">
            <Puzzle className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">Browser extension</h2>
              <Badge
                variant={
                  !bridge
                    ? 'secondary'
                    : bridge.listening
                      ? 'success'
                      : 'warning'
                }
                dot
              >
                {!bridge
                  ? 'Checking'
                  : bridge.listening
                    ? 'Connected'
                    : 'Unavailable'}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {bridge?.error ??
                'On a Workday job, click Apply with Forkday. Forkday queues the job, signs in, fills each page, and shows its progress in the browser and here.'}
            </p>
          </div>
        </div>
        <div className="mt-5 flex items-center gap-2 rounded-lg bg-secondary px-3 py-2">
          <code className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            {bridge?.extensionPath ?? '…'}
          </code>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7"
            disabled={!bridge}
            onClick={() => void copy()}
          >
            {copied ? <Check /> : <Copy />}
            {copied ? 'Copied' : 'Copy path'}
          </Button>
        </div>
      </Card>
      <section>
        <h2 className="eyebrow mb-3">Firefox</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground marker:text-muted-foreground">
          <li>
            Open{' '}
            <code className="text-foreground">
              about:debugging#/runtime/this-firefox
            </code>
            .
          </li>
          <li>
            Click{' '}
            <span className="text-foreground">Load Temporary Add-on…</span> and
            choose <code className="text-foreground">manifest.json</code> in the
            folder above.
          </li>
          <li>
            If the card does not appear on Workday, open the extensions menu in
            the toolbar and allow Forkday on myworkdayjobs.com.
          </li>
        </ol>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          Firefox removes temporary add-ons when it quits. To keep it installed,
          sign the folder as an unlisted add-on on addons.mozilla.org, or use
          Firefox Developer Edition with signing turned off.
        </p>
      </section>
      <section>
        <h2 className="eyebrow mb-3">Chrome</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          <li>
            Open <code className="text-foreground">chrome://extensions</code>{' '}
            and turn on Developer mode.
          </li>
          <li>
            Click <span className="text-foreground">Load unpacked</span> and
            choose the folder above.
          </li>
        </ol>
      </section>
    </div>
  );
}

export function NotificationSettings(): React.JSX.Element {
  const [testing, setTesting] = useState(false);
  const [blocked, setBlocked] = useState<string>();
  const test = async (): Promise<void> => {
    setTesting(true);
    setBlocked(undefined);
    try {
      const result = await window.forkday.testNotification();
      if (result.shown)
        toast(
          'Test sent. Nothing appeared? Allow notifications for Forkday in System Settings.',
          'info',
        );
      else setBlocked(result.error ?? 'The system blocked the notification.');
    } catch (error) {
      setBlocked(errorMessage(error));
    } finally {
      setTesting(false);
    }
  };
  return (
    <div className="max-w-2xl">
      <Card className="p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-lg bg-secondary p-2.5 text-muted-foreground">
            <Bell className="size-5" />
          </div>
          <div>
            <h2 className="font-semibold">System notifications</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Forkday notifies you when a job is queued from the extension, when
              an application is ready for your review, when it needs you, and
              when the queue goes idle. Click a notification to jump to it.
            </p>
          </div>
        </div>
        {blocked && (
          <p
            role="alert"
            className="mt-5 rounded-lg bg-warning-soft px-4 py-3 text-sm text-warning"
          >
            Notifications are blocked ({blocked}). Allow them for Forkday
            {navigator.userAgent.includes('Mac OS')
              ? ' (shown as Electron while in development)'
              : ''}{' '}
            in System Settings, then test again.
          </p>
        )}
        <div className="mt-5 flex flex-wrap gap-2">
          <Button type="button" disabled={testing} onClick={() => void test()}>
            {testing && <LoaderCircle className="animate-spin" />}
            Send test notification
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void window.forkday.openNotificationSettings()}
          >
            Open System Settings
          </Button>
        </div>
      </Card>
    </div>
  );
}
