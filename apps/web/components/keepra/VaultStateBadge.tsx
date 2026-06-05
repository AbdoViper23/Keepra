import type { VaultState } from '@/lib/keepra/types';
import { cn } from '@/lib/utils';

export function VaultStateBadge({ state, className }: { state: VaultState; className?: string }) {
  const styles =
    state === 'Sealed'
      ? 'border-[color:var(--color-success)]/40 text-[color:var(--color-success)] bg-[color:var(--color-success)]/5'
      : state === 'Triggered'
        ? 'border-[color:var(--color-warning)]/40 text-[color:var(--color-warning)] bg-[color:var(--color-warning)]/5'
        : 'border-destructive/40 text-destructive bg-destructive/5';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 border rounded-full font-mono text-[10px] uppercase tracking-widest',
        styles,
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {state}
    </span>
  );
}
