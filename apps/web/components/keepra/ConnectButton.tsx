'use client';

import { useState, type ReactElement } from 'react';
import { ConnectModal, useCurrentAccount, useDisconnectWallet } from '@mysten/dapp-kit';
import { Check, Copy, LogOut } from 'lucide-react';

import { truncateId } from '@/lib/keepra/format';
import { cn } from '@/lib/utils';

/**
 * Wraps any styled element so clicking it opens the dapp-kit wallet picker.
 * Used by the inline "Connect wallet" CTAs to keep their Editorial styling.
 */
export function ConnectModalButton({ children }: { children: ReactElement }) {
  const [open, setOpen] = useState(false);
  return <ConnectModal open={open} onOpenChange={setOpen} trigger={children} />;
}

/** Nav wallet control: connect pill when disconnected, address + disconnect when connected. */
export function ConnectButton({ className }: { className?: string }) {
  const account = useCurrentAccount();
  const { mutate: disconnect } = useDisconnectWallet();
  const [copied, setCopied] = useState(false);

  if (!account) {
    return (
      <ConnectModalButton>
        <button
          className={cn(
            'px-4 py-1.5 rounded-full border border-foreground text-sm font-medium hover:bg-foreground hover:text-background transition-all duration-300 active:scale-95',
            className,
          )}
        >
          Connect Wallet
        </button>
      </ConnectModalButton>
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
        onClick={() => disconnect()}
        title="Disconnect"
        className="size-6 rounded-full hover:bg-foreground/10 grid place-items-center"
      >
        <LogOut className="size-3" />
      </button>
    </div>
  );
}
