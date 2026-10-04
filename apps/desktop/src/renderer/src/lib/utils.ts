import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

/** "just now", "5 min. ago", "yesterday", then a date after a week. */
export function timeAgo(iso: string): string {
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
  if (seconds > -45) return 'just now';
  for (const [unit, size] of [
    ['minute', 60],
    ['hour', 3600],
    ['day', 86400],
  ] as const) {
    const next = unit === 'day' ? 7 * 86400 : unit === 'hour' ? 86400 : 3600;
    if (-seconds < next)
      return relative.format(Math.round(seconds / size), unit);
  }
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  // Electron prefixes IPC errors with the channel; users only need the reason.
  return message.replace(
    /^Error invoking remote method '[^']+': (Error: )?/,
    '',
  );
}
