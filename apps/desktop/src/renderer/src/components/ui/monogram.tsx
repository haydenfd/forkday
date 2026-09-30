import { cn } from '@/lib/utils';

/** Neutral circle with the first letter of `name`. */
export function Monogram({
  name,
  className,
}: {
  name: string;
  className?: string;
}): React.JSX.Element {
  return (
    <span
      aria-hidden
      className={cn(
        'grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold uppercase text-muted-foreground',
        className,
      )}
    >
      {name.replace(/^www\./, '').charAt(0)}
    </span>
  );
}
