'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Check, Download, FileText, Image as ImageIcon } from 'lucide-react';
import { useClaim, useCurrentAccount, useVault } from '@/lib/keepra/hooks';
import { mockConnect } from '@/lib/keepra/mock-store';
import { VaultStateBadge } from '@/components/keepra/VaultStateBadge';
import { CountdownTimer } from '@/components/keepra/CountdownTimer';
import { bytesToSize, truncateId } from '@/lib/keepra/format';
import type { DecodedPayload } from '@/lib/keepra/types';
import { cn } from '@/lib/utils';

export function ClaimView({ vaultId }: { vaultId: string }) {
  const { data } = useVault(vaultId);
  const account = useCurrentAccount();
  const { claim, phase, error } = useClaim();
  const [payload, setPayload] = useState<DecodedPayload | null>(null);

  if (!data) {
    return (
      <Frame title="Vault not found">
        <p className="text-muted-foreground">
          We couldn&apos;t find a vault with id{' '}
          <span className="font-mono text-xs">{truncateId(vaultId)}</span>.
        </p>
      </Frame>
    );
  }

  // 1) Revoked
  if (data.state === 'Revoked') {
    return (
      <Frame title="This vault was revoked.">
        <p className="text-muted-foreground">Nothing to open.</p>
      </Frame>
    );
  }

  // 7) Already opened
  if (payload) {
    return <OpenedView payload={payload} />;
  }

  const deadline = data.log.lastHeartbeatMs + data.vault.inactivitySeconds * 1000;
  const opening = phase === 'authorizing' || phase === 'fetching' || phase === 'decrypting';

  return (
    <div className="max-w-3xl mx-auto px-6 pt-16 pb-24">
      <div className="font-mono text-[10px] uppercase tracking-widest text-primary mb-4">
        [ BENEFICIARY_CLAIM ]
      </div>
      <h1 className="font-display font-extrabold text-4xl md:text-5xl tracking-tight mb-4">
        A vault is waiting for <span className="font-serif italic font-normal">you.</span>
      </h1>
      <p className="text-muted-foreground mb-8">
        Vault <span className="font-mono text-xs">{truncateId(data.vault.vaultId, 8, 6)}</span> was
        sealed on Sui. It will open when its release conditions are met.
      </p>
      <div className="mb-12">
        <VaultStateBadge state={data.state} />
      </div>

      {/* 3) Not yet claimable */}
      {!data.claimable && (
        <div className="p-8 border border-border bg-card space-y-6">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
              Inactivity countdown
            </div>
            <CountdownTimer deadlineMs={deadline} className="text-3xl" />
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
              Guardian progress
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1 bg-border overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{
                    width: `${Math.min(100, (data.log.attestations.length / Math.max(1, data.vault.guardianQuorum)) * 100)}%`,
                  }}
                />
              </div>
              <span className="font-mono text-sm">
                {data.log.attestations.length} / {data.vault.guardianQuorum}
              </span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground border-t border-border pt-4">
            Check back soon. The page updates automatically.
          </p>
        </div>
      )}

      {/* 4 & 5) Claimable */}
      {data.claimable && !account && (
        <div className="p-8 border border-primary/40 bg-primary/5 space-y-4">
          <h2 className="font-serif italic text-2xl">Conditions met.</h2>
          <p className="text-muted-foreground">
            Connect a wallet to open the vault. Decryption happens entirely in your browser.
          </p>
          <button
            onClick={mockConnect}
            className="px-6 py-3 bg-primary text-primary-foreground text-sm font-medium rounded-sm hover:brightness-110"
          >
            Connect wallet
          </button>
        </div>
      )}

      {data.claimable && account && !opening && (
        <div className="p-8 border border-primary/40 bg-primary/5 space-y-4">
          <h2 className="font-serif italic text-2xl">Conditions met.</h2>
          <p className="text-muted-foreground">
            Open the vault to fetch the encrypted blob from Walrus and decrypt it in your browser.
            Keepra never sees the contents.
          </p>
          <button
            onClick={async () => {
              try {
                const p = await claim(data);
                setPayload(p);
              } catch {
                /* error shown below */
              }
            }}
            className="px-6 py-3 bg-primary text-primary-foreground text-sm font-medium rounded-sm hover:brightness-110"
          >
            Open vault
          </button>
        </div>
      )}

      {opening && <OpenProgress phase={phase} />}

      {/* 8) Error */}
      {phase === 'error' && error && (
        <div className="mt-6 p-4 border border-destructive/40 bg-destructive/5 text-sm">
          <div className="font-medium text-destructive mb-1">Could not open vault</div>
          <div className="text-muted-foreground">{error}</div>
        </div>
      )}
    </div>
  );
}

function OpenProgress({ phase }: { phase: string }) {
  const steps = [
    { key: 'authorizing', label: 'Authorizing wallet (SessionKey)' },
    { key: 'fetching', label: 'Fetching ciphertext from Walrus' },
    { key: 'decrypting', label: 'Requesting keys & decrypting' },
  ];
  const idx = steps.findIndex((s) => s.key === phase);
  return (
    <ol className="space-y-3 p-6 border border-border bg-card">
      {steps.map((s, i) => {
        const done = idx > i;
        const active = idx === i;
        return (
          <li key={s.key} className="flex items-center gap-3 text-sm">
            <span
              className={cn(
                'size-5 rounded-full grid place-items-center border',
                done
                  ? 'bg-primary border-primary text-primary-foreground'
                  : active
                    ? 'border-primary text-primary'
                    : 'border-border text-muted-foreground',
              )}
            >
              {done ? (
                <Check className="size-3" />
              ) : active ? (
                <span className="size-1.5 rounded-full bg-primary animate-pulse" />
              ) : (
                <span className="font-mono text-[9px]">{i + 1}</span>
              )}
            </span>
            <span className={cn(active ? 'text-foreground' : 'text-muted-foreground')}>
              {s.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function OpenedView({ payload }: { payload: DecodedPayload }) {
  return (
    <div className="max-w-3xl mx-auto px-6 pt-16 pb-24">
      <div className="font-mono text-[10px] uppercase tracking-widest text-primary mb-4">
        [ DECRYPTED · BROWSER ONLY ]
      </div>
      <h1 className="font-display font-extrabold text-4xl md:text-5xl tracking-tight mb-4">
        Opened.
      </h1>
      <p className="text-muted-foreground mb-12">
        Decrypted entirely in your browser. Keepra never saw these contents.
      </p>

      {payload.text && (
        <article className="p-8 border-l-2 border-primary bg-card mb-10">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4">
            Message
          </div>
          <div className="font-serif text-xl leading-relaxed whitespace-pre-wrap">
            {payload.text}
          </div>
        </article>
      )}

      {payload.files.length > 0 && (
        <div className="space-y-3">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Files
          </div>
          <ul className="space-y-3">
            {payload.files.map((f, i) => (
              <FileItem key={i} file={f} />
            ))}
          </ul>
        </div>
      )}

      <div className="mt-16 pt-8 border-t border-border">
        <Link
          href="/"
          className="font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
        >
          ← Return home
        </Link>
      </div>
    </div>
  );
}

function FileItem({ file }: { file: DecodedPayload['files'][number] }) {
  const isImage = file.entry.mime.startsWith('image/');
  const buf = new Uint8Array(file.bytes.byteLength);
  buf.set(file.bytes);
  const url = URL.createObjectURL(new Blob([buf], { type: file.entry.mime }));
  return (
    <li className="border border-border bg-card overflow-hidden">
      {isImage && (
        <img
          src={url}
          alt={file.entry.name}
          className="w-full max-h-96 object-contain bg-background"
        />
      )}
      <div className="p-4 flex items-center gap-3">
        {isImage ? (
          <ImageIcon className="size-4 text-muted-foreground" />
        ) : (
          <FileText className="size-4 text-muted-foreground" />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{file.entry.name}</div>
          <div className="font-mono text-[10px] text-muted-foreground">
            {file.entry.mime} · {bytesToSize(file.entry.size)}
          </div>
        </div>
        <a
          href={url}
          download={file.entry.name}
          className="inline-flex items-center gap-2 px-3 py-2 border border-border hover:bg-foreground/5 text-sm rounded-sm"
        >
          <Download className="size-3.5" />
          Download
        </a>
      </div>
    </li>
  );
}

function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="max-w-2xl mx-auto px-6 pt-24 pb-24 text-center">
      <h1 className="font-display font-extrabold text-4xl tracking-tight mb-4">{title}</h1>
      <div className="text-muted-foreground">{children}</div>
      <div className="mt-10">
        <Link href="/" className="underline text-sm">
          Return home
        </Link>
      </div>
    </div>
  );
}
