import { useId } from 'react';
import { cn } from '@/lib/utils';

/** Forkday mark: a white fork leaving the tile's bottom-right corner. Source: resources/icon.svg. */
export function Logo({ className }: { className?: string }): React.JSX.Element {
  const clip = useId();
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden
      className={cn('size-7 shrink-0', className)}
    >
      <clipPath id={clip}>
        <rect width="100" height="100" rx="23" />
      </clipPath>
      <rect width="100" height="100" rx="23" fill="var(--logo)" />
      <g clipPath={`url(#${clip})`} fill="#fff">
        <g transform="translate(56 56) rotate(-45) scale(0.86)">
          <rect x="-21" y="-44" width="10" height="29" rx="5" />
          <rect x="-5" y="-44" width="10" height="29" rx="5" />
          <rect x="11" y="-44" width="10" height="29" rx="5" />
          <path d="M-21 -20H21V-12C21 -1 10.5 1 8.5 11H-8.5C-10.5 1 -21 -1 -21 -12Z" />
          <rect x="-8.5" y="2" width="17" height="90" rx="8.5" />
        </g>
      </g>
    </svg>
  );
}
