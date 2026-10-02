import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const UNSET = '__forkday_unset__';

export function Select({
  id,
  value,
  onValueChange,
  options,
  disabled,
  required,
  className,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
}: {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
  required?: boolean;
  className?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
}): React.JSX.Element {
  return (
    <SelectPrimitive.Root
      value={value || UNSET}
      onValueChange={(next) => onValueChange(next === UNSET ? '' : next)}
      disabled={disabled}
      required={required}
    >
      <SelectPrimitive.Trigger
        id={id}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        className={cn(
          'flex h-9 w-full items-center justify-between gap-3 rounded-lg border border-input bg-card px-3 text-left text-sm focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/15 disabled:cursor-not-allowed disabled:opacity-50 data-[state=open]:border-brand [&>span:first-child]:truncate',
          className,
        )}
      >
        <SelectPrimitive.Value>
          {options.find((option) => option.value === value)?.label ?? 'Not set'}
        </SelectPrimitive.Value>
        <SelectPrimitive.Icon asChild>
          <ChevronDown
            aria-hidden
            className="select-chevron size-4 shrink-0 text-muted-foreground"
          />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          collisionPadding={12}
          className="select-menu z-50 max-h-[var(--radix-select-content-available-height)] w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border bg-card text-foreground shadow-xl"
        >
          <SelectPrimitive.Viewport className="p-1">
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value || UNSET}
                textValue={option.label}
                className="relative flex min-h-9 cursor-pointer select-none items-center rounded-md py-2 pl-3 pr-9 text-sm outline-none data-[highlighted]:bg-brand-soft data-[highlighted]:text-brand-strong"
              >
                <SelectPrimitive.ItemText>
                  {option.label}
                </SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="absolute right-3 flex size-4 items-center justify-center">
                  <Check aria-hidden className="size-4" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
