'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import {
  useAttest,
  useCurrentAccount,
  useGuardianCaps,
  useHeartbeat,
  useRevoke,
  useVault,
} from '@/lib/keepra/hooks';
import { VaultStateBadge } from '@/components/keepra/VaultStateBadge';
import { CountdownTimer } from '@/components/keepra/CountdownTimer';
import { ExplorerLink } from '@/components/keepra/ExplorerLink';
import { formatBlobId, formatDate, truncateId } from '@/lib/keepra/format';
import { useProposeRelease } from '@/hooks/useDao';
import { toast } from 'sonner';

export function VaultDetailView({ id }: { id: string }) {
  const account = useCurrentAccount();
  const { data } = useVault(id);
  const { data: caps = [] } = useGuardianCaps();

  if (!data) {
    return (
      <div className="max-w-4xl mx-auto px-6 pt-16 pb-24">
        <h1 className="font-serif italic text-3xl mb-3">Vault not found</h1>
        <p className="text-muted-foreground mb-6">
          We couldn&apos;t find a vault with id{' '}
          <span className="font-mono text-xs">{truncateId(id)}</span>.
        </p>
        <Link href="/dashboard" className="underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const isOwner = account && account.address === data.vault.owner;
  const cap = caps.find((c) => c.vaultId === data.vault.vaultId);
  const deadline = data.log.lastHeartbeatMs + data.vault.inactivitySeconds * 1000;
  const claimUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/claim/${data.vault.vaultId}` : '';

  return (
    <div className="max-w-5xl mx-auto px-6 pt-16 pb-24">
      <div className="font-mono text-[10px] uppercase tracking-widest text-primary mb-4">
        [ VAULT_DETAIL ]
      </div>
      <div className="flex flex-wrap items-end justify-between gap-6 mb-12">
        <div>
          <h1 className="font-display font-extrabold text-4xl md:text-5xl tracking-tight mb-3 break-all">
            {truncateId(data.vault.vaultId, 10, 8)}
          </h1>
          <VaultStateBadge state={data.state} />
        </div>
        {data.state === 'Sealed' && (
          <div className="text-right">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
              Unlocks in
            </div>
            <CountdownTimer deadlineMs={deadline} className="text-3xl" />
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-12">
        <dl className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-8">
          <Field label="Owner">
            <ExplorerLink id={data.vault.owner} />
          </Field>
          <Field label="Created">
            <span>{formatDate(data.vault.createdAtMs)}</span>
          </Field>
          <Field label="Walrus blob">
            <span className="font-mono text-xs break-all">{formatBlobId(data.vault.blobId)}</span>
          </Field>
          <Field label="Seal id">
            <span className="font-mono text-xs break-all">
              {truncateId(data.vault.sealIdHex, 8, 6)}
            </span>
          </Field>
          <Field label="Heartbeat log">
            <ExplorerLink id={data.log.logId} />
          </Field>
          <Field label="Last heartbeat">
            <span>{formatDate(data.log.lastHeartbeatMs)}</span>
          </Field>
          <Field label="Guardian progress">
            <span className="font-mono">
              {data.log.attestations.length} / {data.vault.guardianQuorum}
            </span>
          </Field>
          <Field label="Guardians">
            <span>{data.vault.guardianSet.length} addresses</span>
          </Field>
        </dl>

        {/* Sidebar: actions */}
        <aside className="space-y-4">
          {isOwner && data.state === 'Sealed' && (
            <HeartbeatBlock vaultId={data.vault.vaultId} logId={data.log.logId} />
          )}
          {cap && data.state === 'Sealed' && (
            <AttestBlock vaultId={data.vault.vaultId} capId={cap.capId} logId={data.log.logId} />
          )}
          {data.vault.daoId && data.state !== 'Revoked' && (
            <DaoReleaseBlock vaultId={data.vault.vaultId} daoId={data.vault.daoId} />
          )}
          {isOwner && !data.log.revoked && (
            <RevokeBlock vaultId={data.vault.vaultId} logId={data.log.logId} />
          )}
          <ClaimLinkBlock url={claimUrl} />
        </aside>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
        {label}
      </dt>
      <dd className="text-base">{children}</dd>
    </div>
  );
}

function HeartbeatBlock({ vaultId, logId }: { vaultId: string; logId: string }) {
  const { sendHeartbeat, isPending } = useHeartbeat(vaultId, logId);
  return (
    <div className="p-5 border border-border bg-card">
      <div className="font-mono text-[10px] uppercase tracking-widest text-primary mb-2">
        Liveness
      </div>
      <p className="text-sm text-muted-foreground mb-4">Reset the inactivity timer.</p>
      <button
        onClick={() => void sendHeartbeat()}
        disabled={isPending}
        className="w-full px-4 py-3 bg-foreground text-background text-sm font-medium rounded-sm hover:brightness-110 disabled:opacity-50 transition-all"
      >
        {isPending ? 'Sending…' : "I'm alive"}
      </button>
    </div>
  );
}

function AttestBlock({ vaultId, capId, logId }: { vaultId: string; capId: string; logId: string }) {
  const { attest, isPending } = useAttest(vaultId, capId, logId);
  return (
    <div className="p-5 border border-primary/40 bg-primary/5">
      <div className="font-mono text-[10px] uppercase tracking-widest text-primary mb-2">
        Guardian action
      </div>
      <p className="text-sm text-muted-foreground mb-4">Attest as a guardian to trigger release.</p>
      <button
        onClick={() => void attest()}
        disabled={isPending}
        className="w-full px-4 py-3 bg-primary text-primary-foreground text-sm font-medium rounded-sm hover:brightness-110 disabled:opacity-50 transition-all"
      >
        {isPending ? 'Attesting…' : 'Attest (guardian)'}
      </button>
    </div>
  );
}

function RevokeBlock({ vaultId, logId }: { vaultId: string; logId: string }) {
  const { revoke, isPending } = useRevoke(vaultId, logId);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState('');
  const ok = confirm === 'REVOKE';
  return (
    <div className="p-5 border border-destructive/40 bg-destructive/5">
      <div className="font-mono text-[10px] uppercase tracking-widest text-destructive mb-2">
        Danger zone
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Revoking is permanent. The vault becomes unopenable.
      </p>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full px-4 py-3 border border-destructive text-destructive text-sm font-medium rounded-sm hover:bg-destructive/10 transition-colors"
        >
          Revoke vault
        </button>
      ) : (
        <div className="space-y-3">
          <label className="block text-xs text-muted-foreground">
            Type <span className="font-mono text-destructive">REVOKE</span> to confirm
          </label>
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full p-2 border border-border bg-background font-mono text-sm focus:outline-none focus:border-destructive"
          />
          <div className="flex gap-2">
            <button
              onClick={() => {
                setOpen(false);
                setConfirm('');
              }}
              className="flex-1 px-3 py-2 border border-border text-sm rounded-sm hover:bg-foreground/5"
            >
              Cancel
            </button>
            <button
              onClick={() => void revoke()}
              disabled={!ok || isPending}
              className="flex-1 px-3 py-2 bg-destructive text-destructive-foreground text-sm font-medium rounded-sm hover:brightness-110 disabled:opacity-40"
            >
              {isPending ? '…' : 'Revoke'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ClaimLinkBlock({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Claim link copied');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Copy failed');
    }
  };
  return (
    <div className="p-5 border border-border bg-card">
      <div className="font-mono text-[10px] uppercase tracking-widest text-primary mb-2">
        Beneficiary link
      </div>
      <p className="text-sm text-muted-foreground mb-3">Share with the beneficiary.</p>
      <div className="flex items-center gap-2 p-2 bg-background border border-border">
        <code className="flex-1 font-mono text-[10px] truncate">{url}</code>
        <button
          onClick={copy}
          className="size-7 grid place-items-center hover:bg-foreground/5"
          aria-label="Copy"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </button>
      </div>
    </div>
  );
}

function DaoReleaseBlock({ vaultId, daoId }: { vaultId: string; daoId: string }) {
  const { proposeRelease, isPending } = useProposeRelease();
  const [proposalId, setProposalId] = useState('');
  const [copied, setCopied] = useState(false);
  const link =
    typeof window !== 'undefined' && proposalId
      ? `${window.location.origin}/dao?proposal=${proposalId}`
      : '';

  return (
    <div className="p-5 border border-primary/40 bg-primary/5">
      <div className="font-mono text-[10px] uppercase tracking-widest text-primary mb-2">
        DAO release
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        This vault can be released by a DAO vote ({truncateId(daoId)}).
      </p>
      {!proposalId ? (
        <button
          onClick={async () => {
            const r = await proposeRelease(vaultId, daoId);
            if (r) setProposalId(r.proposalId);
          }}
          disabled={isPending}
          className="w-full px-4 py-3 bg-primary text-primary-foreground text-sm font-medium rounded-sm hover:brightness-110 disabled:opacity-50 transition-all"
        >
          {isPending ? 'Proposing…' : 'Propose DAO release'}
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Share with DAO members to vote:</p>
          <div className="flex items-center gap-2 p-2 bg-background border border-border">
            <code className="flex-1 font-mono text-[10px] truncate">{link}</code>
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(link);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="size-7 grid place-items-center hover:bg-foreground/5"
              aria-label="Copy voting link"
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            </button>
          </div>
          <a
            href={`/dao?proposal=${proposalId}`}
            className="inline-block text-xs text-primary underline"
          >
            Open the voting console →
          </a>
        </div>
      )}
    </div>
  );
}
