'use client';

import { useState } from 'react';
import { Check, Copy, LogOut } from 'lucide-react';
import { mockConnect, mockDisconnect, useCurrentAccount } from '@/lib/keepra/mock-store';
import { truncateId } from '@/lib/keepra/format';
import { cn } from '@/lib/utils';

export function ConnectButton({ className }: { className?: string }) {
  const account = useCurrentAccount();
  const [copied, setCopied] = useState(false);

  if (!account) {
    return (
      <button
        onClick={mockConnect}
        className={cn(
          'px-4 py-1.5 rounded-full border border-foreground text-sm font-medium hover:bg-foreground hover:text-background transition-all duration-300 active:scale-95',
          className,
        )}
      >
        Connect Wallet
      </button>
    );
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(account.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded-full border border-foreground/30 pl-3 pr-1 py-1 text-xs font-mono',
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-primary" aria-hidden />
      <button
        onClick={copy}
        className="flex items-center gap-1.5 hover:text-primary transition-colors"
      >
        {truncateId(account.address, 6, 4)}
        {copied ? <Check className="size-3" /> : <Copy className="size-3 opacity-50" />}
      </button>
      <button
        onClick={mockDisconnect}
        title="Disconnect"
        className="size-6 rounded-full hover:bg-foreground/10 grid place-items-center"
      >
        <LogOut className="size-3" />
      </button>
    </div>
  );
}
