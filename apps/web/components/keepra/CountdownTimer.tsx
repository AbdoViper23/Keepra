'use client';

import { useEffect, useState } from 'react';
import { countdownColor, formatCountdown } from '@/lib/keepra/format';
import { cn } from '@/lib/utils';

export function CountdownTimer({
  deadlineMs,
  className,
}: {
  deadlineMs: number;
  className?: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const ms = deadlineMs - now;
  const color = countdownColor(ms);
  const colorClass =
    color === 'success'
      ? 'text-[color:var(--color-success)]'
      : color === 'warning'
        ? 'text-[color:var(--color-warning)]'
        : 'text-destructive';
  return (
    <span className={cn('font-mono tabular-nums', colorClass, className)}>
      {formatCountdown(ms)}
    </span>
  );
}
