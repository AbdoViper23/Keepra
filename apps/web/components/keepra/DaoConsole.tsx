'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Check, Copy, Vote } from 'lucide-react';
import { toast } from 'sonner';

import { useCurrentAccount } from '@/lib/keepra/hooks';
import { useCreateDao, useExecuteRelease, useProposalView, useVote } from '@/hooks/useDao';
import { ConnectModalButton } from '@/components/keepra/ConnectButton';
import { truncateId } from '@/lib/keepra/format';

const SUI_ADDRESS = /^0x[0-9a-fA-F]{64}$/;

export function DaoConsole() {
  const params = useSearchParams();
  return (
    <div className="max-w-3xl mx-auto px-6 pt-16 pb-24 space-y-16">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-primary mb-4">
          [ DAO_CONSOLE ]
        </div>
        <h1 className="font-display font-extrabold text-4xl md:text-5xl tracking-tight">
          DAO <span className="font-serif italic font-normal">release</span> console
        </h1>
        <p className="text-muted-foreground mt-3">
          Create a reference DAO, then vote a vault open — the headline succession flow.
        </p>
      </div>

      <CreateDaoCard />
      <ReleaseCard initialProposalId={params.get('proposal') ?? ''} />
    </div>
  );
}

function CreateDaoCard() {
  const account = useCurrentAccount();
  const { createDao, isPending } = useCreateDao();
  const [name, setName] = useState('');
  const [membersText, setMembersText] = useState('');
  const [threshold, setThreshold] = useState(2);
  const [createdId, setCreatedId] = useState('');
  const [copied, setCopied] = useState(false);

  const members = membersText
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const validMembers = members.filter((m) => SUI_ADDRESS.test(m));
  const ok =
    name.trim().length > 0 &&
    validMembers.length >= 1 &&
    threshold >= 1 &&
    threshold <= validMembers.length;

  async function submit() {
    if (members.length !== validMembers.length) {
      toast.error('Every member must be a valid Sui address (0x + 64 hex).');
      return;
    }
    const id = await createDao(name.trim(), validMembers, threshold);
    if (id) setCreatedId(id);
  }

  return (
    <section className="border border-border bg-card p-8">
      <div className="flex items-center gap-3 mb-6">
        <Vote className="size-5 text-primary" />
        <h2 className="font-serif italic text-2xl">Create a DAO</h2>
      </div>

      <div className="space-y-5">
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
            Name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Founding Board"
            className="w-full p-3 border border-border bg-background focus:outline-none focus:border-foreground/40"
          />
        </div>
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
            Members — one Sui address per line
          </label>
          <textarea
            value={membersText}
            onChange={(e) => setMembersText(e.target.value)}
            rows={4}
            placeholder={'0x…\n0x…'}
            className="w-full p-3 border border-border bg-background font-mono text-xs resize-y focus:outline-none focus:border-foreground/40"
          />
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">
            {validMembers.length} valid address(es)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Threshold (yes votes)
          </span>
          <input
            type="number"
            min={1}
            value={threshold}
            onChange={(e) => setThreshold(Math.max(1, Number(e.target.value)))}
            className="w-20 p-2 border border-border bg-background font-mono text-sm"
          />
        </div>

        {account ? (
          <button
            onClick={submit}
            disabled={!ok || isPending}
            className="px-6 py-3 bg-primary text-primary-foreground text-sm font-medium rounded-sm hover:brightness-110 disabled:opacity-40"
          >
            {isPending ? 'Creating…' : 'Create DAO'}
          </button>
        ) : (
          <ConnectModalButton>
            <button className="px-6 py-3 bg-primary text-primary-foreground text-sm font-medium rounded-sm">
              Connect to create
            </button>
          </ConnectModalButton>
        )}

        {createdId && (
          <div className="mt-2 p-4 border border-[color:var(--color-success)]/40 bg-[color:var(--color-success)]/5">
            <div className="font-mono text-[10px] uppercase tracking-widest text-[color:var(--color-success)] mb-2">
              DAO created — paste this id into the vault wizard
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate font-mono text-xs">{createdId}</code>
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(createdId);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="size-7 grid place-items-center hover:bg-foreground/5"
                aria-label="Copy DAO id"
              >
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function ReleaseCard({ initialProposalId }: { initialProposalId: string }) {
  const account = useCurrentAccount();
  const [input, setInput] = useState(initialProposalId);
  const [active, setActive] = useState(initialProposalId);

  const { data: view, isLoading } = useProposalView(active || undefined);
  const { vote, isPending: voting } = useVote(view?.daoId ?? '', active);
  const { execute, isPending: executing } = useExecuteRelease(active);

  const isMember = Boolean(account && view?.members.includes(account.address));

  return (
    <section className="border border-border bg-card p-8">
      <div className="flex items-center gap-3 mb-6">
        <Vote className="size-5 text-primary" />
        <h2 className="font-serif italic text-2xl">Vote on a release</h2>
      </div>

      <div className="flex gap-2 mb-6">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Voting proposal id (0x…)"
          className="flex-1 p-3 border border-border bg-background font-mono text-xs focus:outline-none focus:border-foreground/40"
        />
        <button
          onClick={() => setActive(input.trim())}
          className="px-4 border border-border hover:bg-foreground/5 text-sm font-medium"
        >
          Load
        </button>
      </div>

      {!active && (
        <p className="text-sm text-muted-foreground">
          Paste a proposal id, or open the link shared from a vault&apos;s DAO panel.
        </p>
      )}
      {active && isLoading && <p className="text-muted-foreground">Loading proposal…</p>}

      {view && (
        <div className="space-y-6">
          <dl className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
            <Field label="DAO">{view.daoName || truncateId(view.daoId)}</Field>
            <Field label="Vault">
              <Link
                href={`/vault/${view.vaultId}`}
                className="font-mono text-xs text-primary hover:underline"
              >
                {truncateId(view.vaultId)}
              </Link>
            </Field>
            <Field label="Yes votes">
              <span className="font-mono">
                {view.yesCount} / {view.threshold}
              </span>
            </Field>
            <Field label="Status">
              {view.executed ? (
                <span className="text-[color:var(--color-success)]">Released ✓</span>
              ) : view.passed ? (
                <span className="text-[color:var(--color-warning)]">Passed — ready to execute</span>
              ) : (
                <span className="text-muted-foreground">Voting open</span>
              )}
            </Field>
          </dl>

          <div className="h-1 w-full bg-border overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{
                width: `${Math.min(100, (view.yesCount / Math.max(1, view.threshold)) * 100)}%`,
              }}
            />
          </div>

          {!view.executed && (
            <div className="flex flex-wrap gap-3">
              {!account ? (
                <ConnectModalButton>
                  <button className="px-6 py-3 bg-primary text-primary-foreground text-sm font-medium rounded-sm">
                    Connect to vote
                  </button>
                </ConnectModalButton>
              ) : isMember ? (
                <>
                  <button
                    onClick={() => vote(true)}
                    disabled={voting}
                    className="px-6 py-3 bg-primary text-primary-foreground text-sm font-medium rounded-sm hover:brightness-110 disabled:opacity-40"
                  >
                    {voting ? '…' : 'Vote to release'}
                  </button>
                  <button
                    onClick={() => vote(false)}
                    disabled={voting}
                    className="px-6 py-3 border border-border text-sm font-medium rounded-sm hover:bg-foreground/5 disabled:opacity-40"
                  >
                    Vote against
                  </button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Only DAO members can vote on this proposal.
                </p>
              )}

              {view.passed && (
                <button
                  onClick={() =>
                    execute({
                      requestId: view.requestId,
                      logId: view.logId,
                      daoId: view.daoId,
                      proposalId: view.proposalId,
                    })
                  }
                  disabled={executing}
                  className="px-6 py-3 bg-foreground text-background text-sm font-medium rounded-sm hover:brightness-110 disabled:opacity-40"
                >
                  {executing ? 'Executing…' : 'Execute release'}
                </button>
              )}
            </div>
          )}

          {view.executed && (
            <Link
              href={`/claim/${view.vaultId}`}
              className="inline-flex px-6 py-3 bg-primary text-primary-foreground text-sm font-medium rounded-sm hover:brightness-110"
            >
              Open the claim page →
            </Link>
          )}
        </div>
      )}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
        {label}
      </dt>
      <dd>{children}</dd>
    </div>
  );
}
