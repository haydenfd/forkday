import { useEffect, useState } from 'react';
import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';
import type { Toast } from '@/lib/toast';
import { cn } from '@/lib/utils';

const icons = { success: CircleCheck, error: CircleAlert, info: Info };

/**
 * Bottom-right, newest at the bottom pushing older ones up. On the Browser page
 * the native view covers the right half, so toasts sit at the left pane's edge.
 */
export function Toaster({
  besideBrowser = false,
}: {
  besideBrowser?: boolean;
}): React.JSX.Element {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => {
    const dismiss = (id: number): void =>
      setToasts((current) => current.filter((item) => item.id !== id));
    const show = (event: Event): void => {
      const toast = (event as CustomEvent<Toast>).detail;
      setToasts((current) => [...current.slice(-2), toast]);
      setTimeout(() => dismiss(toast.id), toast.tone === 'error' ? 7000 : 3500);
    };
    window.addEventListener('forkday:toast', show);
    return () => window.removeEventListener('forkday:toast', show);
  }, []);
  return (
    <div
      className={cn(
        'pointer-events-none fixed bottom-4 z-50 flex w-[min(24rem,calc(50vw-2rem))] flex-col gap-2',
        besideBrowser ? 'right-[calc(50%+1rem)]' : 'right-4',
      )}
    >
      {toasts.map(({ id, message, tone }) => {
        const Icon = icons[tone];
        return (
          <div
            key={id}
            role={tone === 'error' ? 'alert' : 'status'}
            className="toast-enter pointer-events-auto flex items-start gap-3 rounded-lg border bg-card px-4 py-3 text-sm shadow-xl"
          >
            <Icon
              aria-hidden
              className={cn(
                'mt-0.5 size-4 shrink-0',
                tone === 'success' && 'text-success',
                tone === 'error' && 'text-destructive',
                tone === 'info' && 'text-muted-foreground',
              )}
            />
            <p className="min-w-0 flex-1 break-words">{message}</p>
            <button
              type="button"
              aria-label="Dismiss"
              className="-m-1 rounded p-1 text-muted-foreground hover:text-foreground"
              onClick={() =>
                setToasts((current) => current.filter((item) => item.id !== id))
              }
            >
              <X className="size-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
