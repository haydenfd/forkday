import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        secondary: 'text-muted-foreground',
        active: 'bg-brand-soft text-brand-strong',
        warning: 'bg-warning-soft text-warning',
        success: 'bg-success-soft text-success',
        destructive: 'bg-destructive-soft text-destructive',
        outline: 'border text-muted-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** Leading status dot; `pulse` animates it for live states. */
  dot?: boolean | 'pulse';
}

function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && (
        <span
          aria-hidden
          className={cn(
            'size-1.5 rounded-full bg-current',
            dot === 'pulse' && 'animate-pulse',
          )}
        />
      )}
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
