import Link from 'next/link';

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="pt-24 pb-32 px-6">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-12 gap-12 items-end">
          <div className="lg:col-span-8">
            <div className="font-mono text-[10px] uppercase tracking-widest text-primary mb-6 animate-reveal">
              [ SECURE_PROTOCOL_V.01 · SUI TESTNET ]
            </div>
            <h1 className="font-display font-extrabold text-6xl md:text-8xl tracking-tight leading-[0.9] text-balance mb-8 animate-reveal [animation-delay:100ms]">
              Mathematics as your{' '}
              <span className="font-serif italic font-normal lowercase">last testament.</span>
            </h1>
            <p className="max-w-md text-lg text-muted-foreground text-pretty mb-10 animate-reveal [animation-delay:200ms]">
              A cryptographic sanctuary for the things that must eventually be said. Encrypted by
              you, released only when the conditions of your life—or silence—are met.
            </p>
            <div className="flex flex-wrap gap-4 animate-reveal [animation-delay:300ms]">
              <Link
                href="/create"
                className="px-8 py-4 bg-primary text-primary-foreground font-medium rounded-sm hover:brightness-110 transition-all"
              >
                Create a vault
              </Link>
              <Link
                href="/dashboard"
                className="px-8 py-4 border border-border font-medium rounded-sm hover:bg-foreground/5 transition-all"
              >
                View dashboard
              </Link>
            </div>
          </div>
          <div className="lg:col-span-4 hidden lg:block animate-reveal [animation-delay:400ms]">
            <div className="p-6 border border-border bg-card/60">
              <div className="font-mono text-[10px] mb-4 opacity-40">0x71C9…8E21</div>
              <div className="space-y-3">
                <div className="h-1 w-full bg-primary/20"></div>
                <div className="h-1 w-2/3 bg-primary/20"></div>
                <div className="h-1 w-full bg-primary/20"></div>
              </div>
              <p className="mt-8 font-serif italic text-xl leading-snug">
                &ldquo;What is encrypted cannot be broken, only revealed at the appointed
                hour.&rdquo;
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Release conditions */}
      <section className="py-24 bg-card/40 border-y border-border px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-end mb-16">
            <h2 className="font-display font-extrabold text-4xl tracking-tight">
              Release conditions
            </h2>
            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
              Composable · OR-gated
            </span>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <article className="group p-8 border border-border hover:border-foreground/20 transition-colors">
              <div className="font-mono text-[10px] text-primary mb-6">MODE_01</div>
              <h3 className="font-serif italic text-3xl mb-4">Inactivity Switch</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-8">
                If your wallet remains silent for a predefined period, your vault is released to
                designated heirs. The &ldquo;Dead Man&apos;s Switch&rdquo; for the digital age.
              </p>
              <div className="font-mono text-[10px] text-muted-foreground py-2 border-t border-border/50">
                DEFAULT: 90 DAYS
              </div>
            </article>

            <article className="group p-8 border border-border hover:border-foreground/20 transition-colors">
              <div className="font-mono text-[10px] text-primary mb-6">MODE_02</div>
              <h3 className="font-serif italic text-3xl mb-4">Guardian Quorum</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-8">
                Appoint a circle of trust. Your content releases only when a specific majority
                (m-of-n) of your guardians attest to the release condition.
              </p>
              <div className="font-mono text-[10px] text-muted-foreground py-2 border-t border-border/50">
                M-OF-N MULTISIG
              </div>
            </article>

            <article className="group p-8 border border-border/40 bg-background/40 relative overflow-hidden">
              <div className="absolute top-4 right-4">
                <span className="px-2 py-0.5 border border-primary/30 text-[9px] text-primary font-mono rounded-full uppercase">
                  Coming Soon
                </span>
              </div>
              <div className="font-mono text-[10px] text-muted-foreground mb-6">MODE_03</div>
              <h3 className="font-serif italic text-3xl mb-4 opacity-50">DAO Governance</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-8 opacity-50">
                Release keys based on collective decisions or verifiable on-chain events within a
                specific community or decentralized entity.
              </p>
              <div className="font-mono text-[10px] text-muted-foreground py-2 border-t border-border/30 opacity-50">
                ON-CHAIN PROPOSAL
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-32 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-serif italic text-4xl mb-20 text-center">The journey of a secret</h2>

          <ol className="space-y-24">
            <li className="flex gap-12">
              <span className="font-display font-extrabold text-6xl text-primary/20 shrink-0 tabular-nums">
                01
              </span>
              <div>
                <h3 className="font-display font-extrabold text-xl uppercase tracking-tight mb-4">
                  Encrypt locally
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Your data never leaves your device in a readable state. Using Seal client-side
                  encryption, your message is sealed with a key only the Sui network can eventually
                  reconstruct.
                </p>
              </div>
            </li>
            <li className="flex gap-12">
              <span className="font-display font-extrabold text-6xl text-primary/20 shrink-0 tabular-nums">
                02
              </span>
              <div>
                <h3 className="font-display font-extrabold text-xl uppercase tracking-tight mb-4">
                  Store on Walrus
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Encrypted shards are distributed across Walrus, a decentralized storage layer. No
                  single entity—not even Keepra—can access or delete your legacy.
                </p>
              </div>
            </li>
            <li className="flex gap-12">
              <span className="font-display font-extrabold text-6xl text-primary/20 shrink-0 tabular-nums">
                03
              </span>
              <div>
                <h3 className="font-display font-extrabold text-xl uppercase tracking-tight mb-4">
                  Beneficiary claims
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  When the network confirms your release condition, your beneficiary can claim the
                  key fragments to reconstruct and decrypt the original content—in their browser.
                </p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      {/* Trust bar */}
      <section className="py-12 border-t border-border">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-4">
            <div className="size-2 rounded-full bg-primary animate-pulse" aria-hidden />
            <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Keepra mathematically cannot decrypt your vault
            </span>
          </div>
          <div className="font-mono text-[10px] text-muted-foreground flex gap-8">
            <span>VERIFIED ON SUI</span>
            <span>NO_CENTRAL_AUTH</span>
            <span>ZERO_KNOWLEDGE</span>
          </div>
        </div>
      </section>
    </>
  );
}
