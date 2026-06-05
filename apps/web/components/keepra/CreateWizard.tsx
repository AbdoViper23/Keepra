'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  Trash2,
  Upload,
} from 'lucide-react';
import { useCreateVault, useCurrentAccount } from '@/lib/keepra/hooks';
import { mockConnect } from '@/lib/keepra/mock-store';
import { looksLikeSeedPhrase } from '@/lib/keepra/seedphrase-detector';
import { bytesToSize, isValidSuiAddress, truncateId } from '@/lib/keepra/format';
import { cn } from '@/lib/utils';

const INACTIVITY_OPTIONS = [
  { label: '2 minutes (demo)', seconds: 120 },
  { label: '7 days', seconds: 7 * 86400 },
  { label: '30 days', seconds: 30 * 86400 },
  { label: '90 days', seconds: 90 * 86400 },
  { label: '365 days', seconds: 365 * 86400 },
];

interface PendingFile {
  name: string;
  mime: string;
  bytes: Uint8Array;
}

type Step = 1 | 2 | 3 | 4 | 5;

export function CreateWizard() {
  const router = useRouter();
  const account = useCurrentAccount();
  const { create, phase, error, reset } = useCreateVault();

  const [step, setStep] = useState<Step>(1);

  // Step 1
  const [text, setText] = useState('');
  const [files, setFiles] = useState<PendingFile[]>([]);

  // Step 2
  const [inactivitySeconds, setInactivitySeconds] = useState(30 * 86400);
  const [guardiansEnabled, setGuardiansEnabled] = useState(false);
  const [guardianInput, setGuardianInput] = useState('');
  const [guardians, setGuardians] = useState<string[]>([]);
  const [quorum, setQuorum] = useState(1);

  // Step 3
  const [email, setEmail] = useState('');

  // Step 4
  const [recoveryKey, setRecoveryKey] = useState(false);

  // Step 5
  const [confirm, setConfirm] = useState(false);

  const totalSize = files.reduce((n, f) => n + f.bytes.length, 0);
  const seed = useMemo(() => looksLikeSeedPhrase(text), [text]);

  const onFilesChosen = (list: FileList | null) => {
    if (!list) return;
    const arr = Array.from(list);
    Promise.all(
      arr.map(async (f) => ({
        name: f.name,
        mime: f.type || 'application/octet-stream',
        bytes: new Uint8Array(await f.arrayBuffer()),
      })),
    ).then((next) => setFiles((prev) => [...prev, ...next]));
  };

  const addGuardian = () => {
    const v = guardianInput.trim();
    if (!isValidSuiAddress(v)) {
      toast.error('Not a valid Sui address (0x + 64 hex characters).');
      return;
    }
    if (guardians.includes(v)) {
      toast.error('Guardian already added.');
      return;
    }
    setGuardians((g) => [...g, v]);
    setGuardianInput('');
  };

  const removeGuardian = (a: string) => setGuardians((g) => g.filter((x) => x !== a));

  const inactivityLabel =
    INACTIVITY_OPTIONS.find((o) => o.seconds === inactivitySeconds)?.label ?? '';
  const previewText = useMemo(() => {
    const parts: string[] = [];
    parts.push(`This vault unlocks if you go quiet for ${inactivityLabel.replace(' (demo)', '')}`);
    if (guardiansEnabled && guardians.length >= quorum && quorum >= 1) {
      parts.push(` or ${quorum} of ${guardians.length} guardians approve`);
    }
    return parts.join('') + '.';
  }, [inactivityLabel, guardiansEnabled, guardians, quorum]);

  // Validation
  const canNext = (() => {
    if (step === 1) return text.trim().length > 0 || files.length > 0;
    if (step === 2) {
      if (!guardiansEnabled) return true;
      return guardians.length >= 1 && quorum >= 1 && quorum <= guardians.length;
    }
    if (step === 3) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (step === 4) return true;
    if (step === 5) return confirm && account !== null;
    return false;
  })();

  const onSeal = async () => {
    if (!account) {
      toast.error('Connect a wallet first.');
      return;
    }
    try {
      const res = await create({
        text: text.trim() || undefined,
        files: files.length > 0 ? files : undefined,
        inactivitySeconds,
        guardianAddresses: guardiansEnabled ? guardians : [],
        guardianQuorum: guardiansEnabled ? quorum : 1,
        beneficiaryEmail: email,
      });
      toast.success('Vault sealed.');
      router.push(`/vault/${res.vaultId}`);
    } catch {
      /* error already toasted by hook */
    }
  };

  const isSealing = phase === 'encrypting' || phase === 'uploading' || phase === 'sealing';

  return (
    <div className="max-w-4xl mx-auto px-6 pt-16 pb-24">
      <div className="font-mono text-[10px] uppercase tracking-widest text-primary mb-4">
        [ CREATE_VAULT · STEP {step} OF 5 ]
      </div>
      <h1 className="font-display font-extrabold text-4xl md:text-5xl tracking-tight mb-12">
        {step === 1 && (
          <>
            What do you want to <span className="font-serif italic font-normal">protect</span>?
          </>
        )}
        {step === 2 && (
          <>
            When should it <span className="font-serif italic font-normal">release</span>?
          </>
        )}
        {step === 3 && (
          <>
            Who is the <span className="font-serif italic font-normal">beneficiary</span>?
          </>
        )}
        {step === 4 && (
          <>
            Recovery <span className="font-serif italic font-normal">key</span>
          </>
        )}
        {step === 5 && (
          <>
            Review &amp; <span className="font-serif italic font-normal">seal</span>
          </>
        )}
      </h1>

      <StepProgress current={step} />

      <div className="mt-12">
        {step === 1 && (
          <div className="space-y-8">
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
                Message
              </label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={8}
                placeholder="A note, instructions, credentials, last words…"
                className="w-full p-4 border border-border bg-card font-sans text-base resize-y focus:outline-none focus:border-foreground/40"
              />
              {seed.isLikely && (
                <div className="mt-3 flex gap-3 p-4 border border-[color:var(--color-warning)]/50 bg-[color:var(--color-warning)]/5 rounded-sm">
                  <AlertTriangle className="size-4 text-[color:var(--color-warning)] shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <div className="font-medium text-foreground">
                      This looks like a seed phrase.
                    </div>
                    <div className="text-muted-foreground mt-1">
                      {seed.reason} You can still proceed — but make sure you really want to commit
                      a recovery phrase to an on-chain vault.
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
                Attachments
              </label>
              <FileDrop onFiles={onFilesChosen} />
              {files.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {files.map((f, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-3 p-3 border border-border bg-card"
                    >
                      <FileText className="size-4 text-muted-foreground" />
                      <span className="flex-1 truncate">{f.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {bytesToSize(f.bytes.length)}
                      </span>
                      <button
                        onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}
                        className="size-7 grid place-items-center hover:bg-foreground/5"
                        aria-label="Remove"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </li>
                  ))}
                  <li className="text-right font-mono text-xs text-muted-foreground pt-2">
                    Total: {bytesToSize(totalSize)}
                  </li>
                </ul>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-10">
            {/* Inactivity */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-serif italic text-2xl">Inactivity switch</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Always on. The dead-man timer.
                  </p>
                </div>
                <span className="font-mono text-[10px] uppercase text-primary">Required</span>
              </div>
              <select
                value={inactivitySeconds}
                onChange={(e) => setInactivitySeconds(Number(e.target.value))}
                className="w-full p-3 border border-border bg-card font-mono text-sm focus:outline-none focus:border-foreground/40"
              >
                {INACTIVITY_OPTIONS.map((o) => (
                  <option key={o.seconds} value={o.seconds}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Guardians */}
            <div>
              <label className="flex items-center justify-between mb-4 cursor-pointer">
                <div>
                  <h3 className="font-serif italic text-2xl">Guardian quorum</h3>
                  <p className="text-sm text-muted-foreground mt-1">m-of-n trusted approvers.</p>
                </div>
                <input
                  type="checkbox"
                  checked={guardiansEnabled}
                  onChange={(e) => setGuardiansEnabled(e.target.checked)}
                  className="size-4 accent-[color:var(--color-primary)]"
                />
              </label>
              {guardiansEnabled && (
                <div className="space-y-3 pl-4 border-l-2 border-border">
                  <div className="flex gap-2">
                    <input
                      value={guardianInput}
                      onChange={(e) => setGuardianInput(e.target.value)}
                      placeholder="0x…"
                      className="flex-1 p-3 border border-border bg-card font-mono text-sm focus:outline-none focus:border-foreground/40"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addGuardian();
                        }
                      }}
                    />
                    <button
                      onClick={addGuardian}
                      className="px-4 border border-border hover:bg-foreground/5 transition-colors font-medium text-sm"
                    >
                      Add
                    </button>
                  </div>
                  {guardians.length > 0 && (
                    <ul className="space-y-2">
                      {guardians.map((g) => (
                        <li
                          key={g}
                          className="flex items-center gap-3 p-3 border border-border bg-card"
                        >
                          <span className="size-1.5 rounded-full bg-primary" />
                          <span className="font-mono text-sm flex-1 truncate">
                            {truncateId(g, 10, 8)}
                          </span>
                          <button
                            onClick={() => removeGuardian(g)}
                            className="size-7 grid place-items-center hover:bg-foreground/5"
                            aria-label="Remove"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {guardians.length > 0 && (
                    <div className="flex items-center gap-3 pt-2">
                      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                        Quorum
                      </span>
                      <select
                        value={quorum}
                        onChange={(e) => setQuorum(Number(e.target.value))}
                        className="p-2 border border-border bg-card font-mono text-sm"
                      >
                        {Array.from({ length: guardians.length }, (_, i) => i + 1).map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                      <span className="text-sm text-muted-foreground">of {guardians.length}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* DAO */}
            <div className="p-6 border border-border/40 bg-background/40 opacity-70">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-serif italic text-2xl opacity-60">DAO governance vote</h3>
                <span className="px-2 py-0.5 border border-primary/30 text-[9px] text-primary font-mono rounded-full uppercase">
                  Coming Soon
                </span>
              </div>
              <p className="text-sm text-muted-foreground opacity-70">
                Release based on a community vote. Available in a future release.
              </p>
            </div>

            {/* Preview */}
            <div className="p-6 border-l-2 border-primary bg-primary/5">
              <div className="font-mono text-[10px] uppercase tracking-widest text-primary mb-2">
                Plain English
              </div>
              <p className="font-serif italic text-lg">{previewText}</p>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 max-w-xl">
            <label className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Beneficiary email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="someone@somewhere.com"
              className="w-full p-3 border border-border bg-card focus:outline-none focus:border-foreground/40"
            />
            <p className="text-sm text-muted-foreground">
              Stored only as a salted hash on-chain. Keepra never sees the address.
            </p>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6 max-w-xl">
            <label className="flex items-start gap-4 p-5 border border-border bg-card cursor-pointer">
              <input
                type="checkbox"
                checked={recoveryKey}
                onChange={(e) => setRecoveryKey(e.target.checked)}
                className="mt-1 size-4 accent-[color:var(--color-primary)]"
              />
              <div>
                <div className="font-medium">Generate a printable recovery key</div>
                <p className="text-sm text-muted-foreground mt-1">
                  An offline QR + mnemonic backup, openable without the chain.
                </p>
                <span className="inline-block mt-3 px-2 py-0.5 border border-primary/30 text-[9px] text-primary font-mono rounded-full uppercase">
                  Coming Soon
                </span>
              </div>
            </label>
            <p className="text-sm text-muted-foreground">
              By default this is off. The wizard will not produce a recovery key in this preview.
            </p>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-8">
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
              <Summary label="Payload">
                {text.trim() && <div>Message ({text.length} chars)</div>}
                {files.length > 0 && (
                  <div>
                    {files.length} file{files.length === 1 ? '' : 's'} · {bytesToSize(totalSize)}
                  </div>
                )}
                {!text.trim() && files.length === 0 && (
                  <div className="text-destructive">Empty</div>
                )}
              </Summary>
              <Summary label="Unlock window">{inactivityLabel}</Summary>
              <Summary label="Guardians">
                {guardiansEnabled && guardians.length > 0
                  ? `${quorum} of ${guardians.length}`
                  : 'Owner only'}
              </Summary>
              <Summary label="Beneficiary">{email || '—'}</Summary>
              <Summary label="Recovery key">{recoveryKey ? 'Requested' : 'None'}</Summary>
              <Summary label="Wallet">
                {account ? (
                  truncateId(account.address, 8, 6)
                ) : (
                  <span className="text-destructive">Not connected</span>
                )}
              </Summary>
            </dl>

            {!account && (
              <div className="p-4 border border-destructive/40 bg-destructive/5 flex items-center justify-between">
                <span className="text-sm">You need a connected wallet to seal this vault.</span>
                <button
                  onClick={mockConnect}
                  className="px-4 py-2 bg-foreground text-background text-sm font-medium rounded-sm"
                >
                  Connect
                </button>
              </div>
            )}

            <label className="flex items-start gap-3 p-4 border border-border bg-card cursor-pointer">
              <input
                type="checkbox"
                checked={confirm}
                onChange={(e) => setConfirm(e.target.checked)}
                className="mt-1 size-4 accent-[color:var(--color-primary)]"
              />
              <span className="text-sm">
                I understand this vault is <strong>immutable once sealed</strong>. The only owner
                action afterwards is to <strong>revoke</strong> it.
              </span>
            </label>

            {isSealing && <SealingProgress phase={phase} />}
            {phase === 'error' && error && (
              <div className="p-4 border border-destructive/40 bg-destructive/5 text-sm">
                <div className="font-medium text-destructive mb-1">Failed to seal</div>
                <div className="text-muted-foreground">{error}</div>
                <button
                  onClick={reset}
                  className="mt-3 text-xs underline text-muted-foreground hover:text-foreground"
                >
                  Try again
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer nav */}
      <div className="mt-16 pt-8 border-t border-border flex items-center justify-between">
        <button
          onClick={() => setStep((s) => (s > 1 ? ((s - 1) as Step) : s))}
          disabled={step === 1 || isSealing}
          className="inline-flex items-center gap-2 px-4 py-3 text-sm font-medium hover:bg-foreground/5 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ArrowLeft className="size-4" />
          Back
        </button>
        {step < 5 ? (
          <button
            onClick={() => canNext && setStep((s) => (s + 1) as Step)}
            disabled={!canNext}
            className="inline-flex items-center gap-2 px-8 py-3 bg-primary text-primary-foreground text-sm font-medium rounded-sm hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Continue
            <ArrowRight className="size-4" />
          </button>
        ) : (
          <button
            onClick={onSeal}
            disabled={!canNext || isSealing}
            className="inline-flex items-center gap-2 px-8 py-3 bg-primary text-primary-foreground text-sm font-medium rounded-sm hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSealing ? 'Sealing…' : 'Seal the vault'}
            <Check className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function StepProgress({ current }: { current: number }) {
  const steps = ['Protect', 'Conditions', 'Beneficiary', 'Recovery', 'Review'];
  return (
    <ol className="flex gap-2">
      {steps.map((label, i) => {
        const n = i + 1;
        const done = current > n;
        const active = current === n;
        return (
          <li key={label} className="flex-1">
            <div
              className={cn(
                'h-1 mb-3 transition-colors',
                done || active ? 'bg-primary' : 'bg-border',
              )}
            />
            <div
              className={cn(
                'font-mono text-[10px] uppercase tracking-widest',
                active ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              0{n} · {label}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Summary({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
        {label}
      </dt>
      <dd className="font-serif italic text-xl">{children}</dd>
    </div>
  );
}

function FileDrop({ onFiles }: { onFiles: (l: FileList | null) => void }) {
  const [over, setOver] = useState(false);
  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onFiles(e.dataTransfer.files);
      }}
      className={cn(
        'block border-2 border-dashed p-10 text-center cursor-pointer transition-colors',
        over ? 'border-primary bg-primary/5' : 'border-border hover:border-foreground/30',
      )}
    >
      <input type="file" multiple className="sr-only" onChange={(e) => onFiles(e.target.files)} />
      <Upload className="size-6 mx-auto text-muted-foreground mb-3" />
      <div className="text-sm font-medium">Drop files or click to browse</div>
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mt-2">
        Anything · encrypted before upload
      </div>
    </label>
  );
}

function SealingProgress({ phase }: { phase: string }) {
  const steps = [
    { key: 'encrypting', label: 'Encrypting with Seal' },
    { key: 'uploading', label: 'Uploading to Walrus' },
    { key: 'sealing', label: 'Sealing on Sui' },
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
              {active && <span className="ml-2 font-mono text-xs">…</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
