'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { useCurrentAccount, useHeartbeat, useVault, useVaults } from '@/lib/keepra/hooks';
import { mockConnect } from '@/lib/keepra/mock-store';
import { VaultStateBadge } from '@/components/keepra/VaultStateBadge';
import { CountdownTimer } from '@/components/keepra/CountdownTimer';
import { formatBlobId, formatDate, truncateId } from '@/lib/keepra/format';

export function DashboardView() {
  const account = useCurrentAccount();
  const { data: vaults, isLoading } = useVaults();

  return (
    <div className="max-w-7xl mx-auto px-6 pt-16 pb-24">
      <div className="flex items-end justify-between mb-12">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-primary mb-4">
            [ DASHBOARD ]
          </div>
          <h1 className="font-display font-extrabold text-5xl tracking-tight">
            Your <span className="font-serif italic font-normal">vaults</span>
          </h1>
        </div>
        <Link
          href="/create"
          className="hidden md:inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground text-sm font-medium rounded-sm hover:brightness-110 transition-all"
        >
          <Plus className="size-4" />
          New vault
        </Link>
      </div>

      {!account && (
        <EmptyState
          title="Connect a wallet to begin"
          body="Your vaults live on Sui. Connect a wallet to see what you've sealed."
          cta={
            <button
              onClick={mockConnect}
              className="px-6 py-3 bg-primary text-primary-foreground text-sm font-medium rounded-sm"
            >
              Connect wallet
            </button>
          }
        />
      )}

      {account && isLoading && <div className="text-muted-foreground">Loading…</div>}

      {account && !isLoading && (!vaults || vaults.length === 0) && (
        <EmptyState
          title="Nothing sealed yet"
          body="Create your first vault — a message, a key, a file — to leave behind."
          cta={
            <Link
              href="/create"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground text-sm font-medium rounded-sm"
            >
              <Plus className="size-4" />
              Create a vault
            </Link>
          }
        />
      )}

      {account && vaults && vaults.length > 0 && (
        <ul className="grid md:grid-cols-2 gap-6">
          {vaults.map((v) => (
            <VaultCard key={v.vaultId} vaultId={v.vaultId} />
          ))}
        </ul>
      )}
    </div>
  );
}

function VaultCard({ vaultId }: { vaultId: string }) {
  const { data } = useVault(vaultId);
  if (!data) return null;
  const deadline = data.log.lastHeartbeatMs + data.vault.inactivitySeconds * 1000;
  return (
    <li className="border border-border bg-card p-6 flex flex-col gap-4 hover:border-foreground/20 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="font-mono text-xs truncate">{truncateId(data.vault.vaultId, 10, 8)}</div>
        <VaultStateBadge state={data.state} />
      </div>
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        Created · {formatDate(data.vault.createdAtMs)}
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Walrus blob</span>
        <span className="font-mono text-xs">{formatBlobId(data.vault.blobId)}</span>
      </div>
      {data.state === 'Sealed' && (
        <div className="flex items-center justify-between text-sm pt-2 border-t border-border">
          <span className="text-muted-foreground">Unlocks in</span>
          <CountdownTimer deadlineMs={deadline} className="text-base" />
        </div>
      )}
      {data.state === 'Triggered' && (
        <div className="text-sm text-[color:var(--color-warning)]">
          Conditions met — beneficiary can claim.
        </div>
      )}
      <div className="flex gap-2 mt-2">
        {data.state === 'Sealed' && <HeartbeatButton vaultId={vaultId} logId={data.log.logId} />}
        <Link
          href={`/vault/${vaultId}`}
          className="flex-1 text-center px-4 py-2 border border-border hover:bg-foreground/5 text-sm font-medium rounded-sm transition-colors"
        >
          View
        </Link>
      </div>
    </li>
  );
}

function HeartbeatButton({ vaultId, logId }: { vaultId: string; logId: string }) {
  const { sendHeartbeat, isPending } = useHeartbeat(vaultId, logId);
  return (
    <button
      onClick={() => void sendHeartbeat()}
      disabled={isPending}
      className="flex-1 px-4 py-2 bg-foreground text-background text-sm font-medium rounded-sm hover:brightness-110 disabled:opacity-50 transition-all"
    >
      {isPending ? '…' : "I'm alive"}
    </button>
  );
}

function EmptyState({ title, body, cta }: { title: string; body: string; cta: React.ReactNode }) {
  return (
    <div className="border border-dashed border-border p-16 text-center">
      <h2 className="font-serif italic text-3xl mb-3">{title}</h2>
      <p className="text-muted-foreground max-w-md mx-auto mb-8">{body}</p>
      {cta}
    </div>
  );
}
