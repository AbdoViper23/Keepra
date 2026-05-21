# Frontend

> Keepra's web frontend: Next.js 15, Sui dApp Kit, Seal SDK, Walrus SDK, Enoki for zkLogin. The frontend is **load-bearing for security**: encryption and decryption both happen here, in the user's browser, never on Keepra servers.

---

## 1. Stack at a Glance

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15 (App Router) + React 19 | SSR for marketing pages, CSR for app shell, mature ecosystem |
| Wallet | `@mysten/dapp-kit` | Mysten's official React wallet kit; supports zkLogin via Enoki |
| Auth (consumer) | `@mysten/enoki` zkLogin | Google/Apple sign-in → Sui address derivation |
| Encryption | `@mysten/seal` | Threshold IBE + Move policy gating |
| Storage | `@mysten/walrus` | Walrus SDK (browser + Node) |
| State | Zustand + TanStack Query | Lightweight; TanStack Query handles Sui RPC caching |
| Styling | TailwindCSS + Radix UI primitives | Speed; accessibility built-in |
| Routing | Next.js App Router | File-based |
| PWA | `next-pwa` | Offline-capable; installable on mobile |
| Forms | `react-hook-form` + `zod` | Validated wizard forms |
| Testing | Vitest + Playwright (E2E) | Fast unit + reliable E2E |

Exact versions are in [TechStack.md](./TechStack.md).

---

## 2. Page Structure (App Router)

```
apps/web/
├── app/
│   ├── (marketing)/
│   │   ├── page.tsx                       # Landing
│   │   ├── how-it-works/page.tsx
│   │   └── security/page.tsx
│   ├── (app)/
│   │   ├── layout.tsx                     # Auth-gated layout
│   │   ├── dashboard/page.tsx             # Owner's vault list
│   │   ├── create/page.tsx                # Vault creation wizard
│   │   ├── vault/[id]/
│   │   │   ├── page.tsx                   # Vault detail + heartbeat
│   │   │   └── revoke/page.tsx
│   │   └── settings/page.tsx
│   ├── guardian/
│   │   ├── onboard/[capId]/page.tsx       # Guardian onboarding
│   │   └── attest/[vaultId]/page.tsx      # Guardian attest action
│   ├── claim/[vaultId]/page.tsx           # Beneficiary claim page
│   ├── recover/page.tsx                   # backupKey recovery
│   └── api/                               # (Empty: backend is separate)
├── components/
├── lib/
│   ├── seal.ts                            # SealClient wrapper
│   ├── walrus.ts                          # Walrus upload/download
│   ├── enoki.ts                           # zkLogin + sponsor calls
│   ├── sui.ts                             # SuiClient singleton
│   └── crypto.ts                          # Mnemonic ↔ backupKey
├── stores/
└── public/
```

---

## 3. The Five Critical Pages

### 3.1 Landing (`/`)

Marketing only. The headline is the product's pitch:

> *"Encrypt anything. Set the conditions for its release. We mathematically cannot decrypt it. Only the conditions can."*

CTA: "Create a vault" (→ /create).

Sub-points: three illustrated panels for the three release conditions (Inactivity / Guardians / DAO Vote).

### 3.2 Vault Creation Wizard (`/create`)

The most complex page. A 5-step wizard:

```
Step 1: What are you protecting?
  - Drag-and-drop file upload OR text editor for letters
  - Live preview of payload size
  - "Skip files; just include a text message"
  - Warning if user pastes patterns matching seed phrases ("This looks like a seed phrase. Consider using a template — link.")

Step 2: When should it unlock?
  - Three toggleable conditions (OR-composition):
    [✓] Dead-Man Switch     "Open if I don't check in for [30 days ▼]"
    [✓] Guardian Quorum     "Open if [2 ▼] of these people approve:"
                            [+ Add guardian by email]
    [ ] DAO Governance      "Open if this DAO passes a release proposal: [DAO address]"
  - Live "Policy preview" panel showing the OR-composition in plain English

Step 3: Who receives it?
  - "Enter beneficiary email"
  - "They will sign in with Google to claim. They need nothing else."
  - Optional: pre-bind to a specific zkLogin OAuth sub (advanced)

Step 4: Recovery (optional, default OFF)
  - [☐] Generate a backup recovery key
        "Advanced: a printable QR code that decrypts the vault even if all key servers shut down.
         Anyone who finds this paper can decrypt your vault. Only enable if you have a safe deposit box."

Step 5: Review and seal
  - Full summary
  - Estimated cost (Walrus storage + Sui gas)
  - Big red "Seal Vault" button
  - "After sealing, this vault cannot be edited. The only change you can make is to revoke (destroy) it."
```

#### Wizard state machine

```
[Step 1] ─→ [Step 2] ─→ [Step 3] ─→ [Step 4] ─→ [Step 5]
   ↑           ↑           ↑           ↑           │
   └───────────┴───────────┴───────────┴────[Back]─┘
                                                    │
                                                    ▼
                                              [Encrypting...]
                                                    │
                                                    ▼
                                              [Uploading to Walrus...]
                                                    │
                                                    ▼
                                              [Sealing on Sui...]
                                                    │
                                                    ▼
                                              [Vault sealed ✓]
                                                    │
                                                    ▼
                                              [Print recovery sheet?]
                                                    │
                                                    ▼
                                              → /dashboard
```

State held in Zustand store; persisted to `sessionStorage` so a refresh during step 4 doesn't lose progress (without persisting the plaintext, which only enters memory at Step 5).

### 3.3 Dashboard (`/dashboard`)

Owner's vault list. Each row shows:

- Vault name + size + creation date
- Status badge (`Sealed` / `Triggered` / `Revoked`)
- Countdown to next heartbeat-due (color-coded: green > 7d, yellow 1–7d, red < 24h)
- One-click **"I'm alive"** button per vault (sends heartbeat PTB)
- Guardian onboarding status indicator
- Quick actions: View, Revoke

```
┌─────────────────────────────────────────────────────────────┐
│  Family Time Capsule          🟢 SEALED      [I'm alive ✓]  │
│  3 files · 12 MB · Created Mar 14                            │
│  Next heartbeat: 18 days                                     │
│  Beneficiary: maya@gmail.com    Guardians: 2/3 onboarded     │
└─────────────────────────────────────────────────────────────┘
```

### 3.4 Beneficiary Claim Page (`/claim/[vaultId]`)

**This is the headline UX.** The beneficiary may be technically unsophisticated; the page must work for someone who has never used crypto.

```
┌─────────────────────────────────────────────────────────────┐
│   You have a Keepra vault waiting for you.                  │
│                                                              │
│   This vault was prepared by Alice Smith.                    │
│   It became available on March 28, 2026.                     │
│                                                              │
│   To open it, sign in with Google. You don't need to install │
│   anything or have any cryptocurrency.                       │
│                                                              │
│   [  Sign in with Google  ]                                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

After sign-in:

```
┌─────────────────────────────────────────────────────────────┐
│   ✓ Signed in as maya@gmail.com                              │
│                                                              │
│   Vault status: UNLOCKED (Alice missed heartbeats for 32 days)│
│                                                              │
│   [  Open Vault  ]                                           │
│                                                              │
│   We will fetch the encrypted contents and decrypt them in   │
│   your browser. The Keepra team never sees the contents.    │
└─────────────────────────────────────────────────────────────┘
```

During decrypt:

```
   Fetching encrypted data from Walrus...        ✓
   Requesting decryption keys (2 of 3 needed)... ✓
   Decrypting in your browser...                 ✓
```

Then renders the decrypted content with appropriate viewers (text, image, video, file downloads).

### 3.5 Guardian Portal (`/guardian/...`)

Two pages:

**`/guardian/onboard/[capId]`** — first-time onboarding. Sign in with Google, accept the cap transfer.

**`/guardian/attest/[vaultId]`** — attestation page. Shows vault context (who, what's known), explains the gravity of attesting, requires typing the owner's name to confirm.

```
┌─────────────────────────────────────────────────────────────┐
│   Alice has been inactive for 32 days.                       │
│                                                              │
│   If you believe Alice is unable to maintain her vault, you  │
│   can attest. When 2 of 3 guardians attest, the vault will   │
│   unlock for Alice's beneficiary (maya@gmail.com).           │
│                                                              │
│   Other attestations: 1 / 2 required                         │
│                                                              │
│   To confirm, type Alice's name:                             │
│   [_________________]                                        │
│                                                              │
│   [  Attest  ]    [  Cancel  ]                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Component Architecture

```
components/
├── ui/                    # Radix-based design system (Button, Input, Dialog, ...)
├── wallet/
│   ├── ConnectButton.tsx       # @mysten/dapp-kit ConnectButton wrapper
│   └── EnokiSignInButton.tsx   # zkLogin sign-in button
├── vault/
│   ├── VaultCard.tsx           # Dashboard row
│   ├── PolicyBuilder.tsx       # Step 2 of wizard
│   ├── GuardianList.tsx        # Add/remove guardians
│   ├── ConditionPreview.tsx    # Plain-English policy summary
│   ├── HeartbeatButton.tsx     # "I'm alive" with countdown
│   └── VaultStateBadge.tsx     # Sealed/Triggered/Revoked
├── upload/
│   ├── FileDropzone.tsx
│   ├── EncryptionProgress.tsx  # Multi-stage progress UI
│   └── PayloadComposer.tsx     # File-or-text editor
├── claim/
│   ├── ClaimGate.tsx           # Sign-in or wait-for-conditions
│   ├── DecryptionProgress.tsx
│   └── ContentRenderer.tsx     # Renders decrypted content by MIME type
├── recovery/
│   ├── BackupSheetGenerator.tsx
│   └── MnemonicInput.tsx
└── shared/
    ├── CountdownTimer.tsx
    ├── ExplorerLink.tsx
    └── HelpTooltip.tsx
```

### Component design principles

| Principle | Application |
|---|---|
| **No plaintext in props** | Never pass plaintext through component trees; only blob refs and signed ciphertext |
| **No state escape** | `PayloadComposer` keeps file contents in local state; never lifted to global |
| **Encryption happens in workers** | `lib/seal.ts` runs heavy crypto in a Web Worker to keep the UI thread responsive |
| **Optimistic UI for sponsored TXs** | Show "Sealed ✓" after Enoki accepts the request; reconcile with chain state in background |

---

## 5. Encryption Flow (client-side)

The detailed encryption flow that happens entirely in the user's browser at vault-seal time.

### `lib/seal.ts` — the SealClient wrapper

```ts
// Pseudo-code; exact types depend on @mysten/seal version
// Source of truth for IDs: Seal-Config.md
import { SealClient, EncryptedObject } from "@mysten/seal";
import { suiClient } from "./sui";
import {
  KEEPRA_PKG,
  SEAL_COMMITTEE_SERVER_ID,
  SEAL_COMMITTEE_AGGREGATOR_URL,
  SEAL_INDEP_RUBY,
  SEAL_INDEP_NODEINFRA,
} from "./config";

let _client: SealClient | null = null;

/**
 * Hybrid config (Phase 7+): Committee server + 2 independents, threshold 2-of-3.
 * For Phase 4 CLI roundtrip, switch to Committee-only with threshold: 1.
 */
export function getSealClient(): SealClient {
  if (_client) return _client;
  _client = new SealClient({
    suiClient,
    serverConfigs: [
      {
        objectId: SEAL_COMMITTEE_SERVER_ID,
        aggregatorUrl: SEAL_COMMITTEE_AGGREGATOR_URL,
        weight: 1,
      },
      { objectId: SEAL_INDEP_RUBY, weight: 1 },
      { objectId: SEAL_INDEP_NODEINFRA, weight: 1 },
    ],
    verifyKeyServers: true,
  });
  return _client;
}

export async function encryptForVault(
  plaintext: Uint8Array,
  vaultUid: string,
): Promise<{ encryptedObject: Uint8Array; backupKey?: Uint8Array }> {
  const client = getSealClient();
  const idBytes = bcsToBytes(vaultUid);  // 32-byte UID

  const { encryptedObject, key } = await client.encrypt({
    threshold: 2,         // 2-of-3 (Committee + Ruby + NodeInfra)
    packageId: KEEPRA_PKG,
    id: idBytes,
    data: plaintext,
    // demType: 1 (EncodedHashed), kemType: 0 (BLS12-381 IBE) — verify field names with installed SDK
  });

  return { encryptedObject, backupKey: key };
}
```

### Why a Web Worker

For payloads > 1 MB, Seal encryption can block the UI thread for seconds. We push encryption into a Web Worker:

```
main thread                Web Worker
    │                         │
    │ postMessage(plaintext)  │
    ├────────────────────────→│
    │                         │ SealClient.encrypt(...)
    │                         │ (blocks ~2s for 10 MB)
    │←────────────────────────┤
    │ postMessage(ciphertext) │
```

The main thread shows an animated progress bar; the worker reports completion percentages.

### Walrus upload flow (`lib/walrus.ts`)

```ts
import { WalrusClient } from "@mysten/walrus";
import { suiClient, signer } from "./sui";

export async function uploadEncryptedBlob(
  ciphertext: Uint8Array,
  epochs: number = 53,  // max
): Promise<{ blobId: string; blobObjectId: string }> {
  const walrusClient = new WalrusClient({ suiClient, network: "mainnet" });

  // Browser path: use the upload relay to avoid connecting to ~2200 storage nodes
  const result = await walrusClient.writeBlob({
    blob: ciphertext,
    epochs,
    deletable: false,
    signer,
  });

  return {
    blobId: result.blobObject.blobId,
    blobObjectId: result.blobObject.id,
  };
}

export async function fetchBlob(blobId: string): Promise<Uint8Array> {
  // Try aggregators in order with fallback
  for (const agg of AGGREGATORS) {
    try {
      const r = await fetch(`${agg}/v1/blobs/${blobId}`, { signal: timeoutSignal(8000) });
      if (r.ok) return new Uint8Array(await r.arrayBuffer());
    } catch (e) { /* next aggregator */ }
  }
  throw new Error("All aggregators failed");
}
```

### PTB construction for `create_and_seal`

```ts
import { Transaction } from "@mysten/sui/transactions";

const tx = new Transaction();
tx.moveCall({
  target: `${KEEPRA_PKG}::vault::create_and_seal`,
  arguments: [
    tx.pure.vector("u8", blobIdBytes),
    tx.pure.vector("u8", sealIdBytes),
    tx.pure.u8(2),                                   // threshold
    tx.pure.vector("address", KEY_SERVER_IDS),
    tx.pure.u64(BigInt(30 * 24 * 60 * 60)),          // 30 days inactivity
    tx.pure.vector("address", guardianAddresses),
    tx.pure.u8(2),                                    // quorum
    tx.pure.option("address", daoId),
    tx.pure.option("u64", daoThreshold),
    tx.pure.vector("u8", sha256(beneficiaryEmail)),
    tx.pure.option("string", beneficiaryZkSub),
    tx.object("0x6"),                                 // Clock
  ],
});

const { digest } = await signAndExecute(tx);
```

---

## 6. Decryption Flow (client-side)

```ts
import { SessionKey } from "@mysten/seal";
import { Transaction } from "@mysten/sui/transactions";

export async function claimVault(vaultId: string, userAddress: string) {
  // 1. SessionKey
  const sk = await SessionKey.create({
    address: userAddress,
    packageId: KEEPRA_PKG,
    ttlMin: 10,
    suiClient,
  });
  const sig = await wallet.signPersonalMessage(sk.getPersonalMessage());
  sk.setPersonalMessageSignature(sig);

  // 2. Build approval PTB (NOT executed — just serialized for dry-run)
  const tx = new Transaction();
  tx.moveCall({
    target: `${KEEPRA_PKG}::policy::seal_approve_release`,
    arguments: [
      tx.pure.vector("u8", fromHex(vaultIdHex)),
      tx.object(vaultId),
      tx.object(heartbeatLogId),
      tx.object("0x6"),
    ],
  });
  const txBytes = await tx.build({ client: suiClient, onlyTransactionKind: true });

  // 3. Fetch ciphertext in parallel
  const [ciphertext, sealClient] = await Promise.all([
    fetchBlob(blobId),
    Promise.resolve(getSealClient()),
  ]);

  // 4. Decrypt
  const plaintext = await sealClient.decrypt({
    data: ciphertext,
    sessionKey: sk,
    txBytes,
  });

  return plaintext;
}
```

### Rendering decrypted content

The plaintext is a binary blob with a structured header that tells the renderer what to do:

```
[4 bytes magic] [1 byte version] [variable manifest] [payload]

Manifest is JSON-encoded:
{
  "type": "single_file" | "multi_file" | "text",
  "files": [{ "name": "letter.pdf", "mime": "application/pdf", "offset": 0, "size": 1234 }, ...]
}
```

The `ContentRenderer` component reads the manifest and renders each file with an appropriate viewer (PDFs in `react-pdf`, images natively, videos with `<video>`, text in a Markdown renderer).

---

## 7. zkLogin Integration

### Enoki setup (one-time, app boot)

```ts
import { registerEnokiWallets } from "@mysten/enoki";
import { getWallets } from "@mysten/wallet-standard";

if (typeof window !== "undefined") {
  registerEnokiWallets({
    apiKey: process.env.NEXT_PUBLIC_ENOKI_API_KEY!,
    providers: {
      google: { clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID! },
      apple: { clientId: process.env.NEXT_PUBLIC_APPLE_CLIENT_ID! },
    },
    client: suiClient,
    network: "testnet",
  });
}
```

After registration, Google and Apple sign-in buttons appear in the dApp Kit `<ConnectButton />` as if they were regular Sui wallets. The user clicks, completes OAuth, and a Sui address is derived. No seed phrase, no extension, no installation.

### Sponsoring transactions

Beneficiary claims and guardian attestations are sponsored. The flow:

```
Frontend builds PTB
    │
    ▼
txBytes = tx.build({ client, onlyTransactionKind: true })
    │
    ▼
POST /api/sponsor { txBytes }
    │
    ▼  (Keepra backend)
EnokiClient.createSponsoredTransaction({
  network: "testnet",
  transactionKindBytes: txBytes,
  sender: userAddress,
  allowedMoveCallTargets: [`${KEEPRA_PKG}::guardian::attest`, ...],
})
    │
    ▼  returns { bytes, digest }
Frontend receives sponsored bytes
    │
    ▼
User signs the digest with their zkLogin wallet
    │
    ▼
POST /api/sponsor/execute { digest, signature }
    │
    ▼
EnokiClient.executeSponsoredTransaction({ digest, signature })
    │
    ▼
Sui executes — gas paid by Keepra
```

The `allowedMoveCallTargets` allowlist on Enoki side is a defense-in-depth: even if a sponsor key leaks, the attacker can only sponsor calls to specific Keepra functions.

---

## 8. State Management

### Zustand stores

| Store | Responsibility | Persistence |
|---|---|---|
| `useSessionStore` | Current user, zkLogin state, signer | None (re-derived) |
| `useWizardStore` | Vault creation wizard state | sessionStorage (cleared on seal) |
| `useVaultsStore` | Owner's vault list | memory; refetched on focus |
| `useClaimStore` | In-flight claim state | None |

### TanStack Query keys

```ts
['vault', vaultId]                   // Vault + HeartbeatLog snapshot
['vaults-by-owner', ownerAddress]    // Owner's list (paginated)
['vault-status', vaultId]            // Light-weight: just current state + countdown
['guardian-caps', userAddress]       // Owned GuardianCaps
['blob', blobId]                     // Cached ciphertext (60s TTL)
```

Query invalidation: on every successful PTB, invalidate the affected queries via TanStack Query.

---

## 9. Routing and Auth Guards

### Public routes (no auth required)
- `/` Landing
- `/how-it-works`, `/security`
- `/claim/[vaultId]` (initial state; gated after click)
- `/recover` (works entirely offline)

### Auth-gated routes (require connected wallet OR zkLogin)
- `/dashboard`, `/create`, `/vault/[id]`, `/vault/[id]/revoke`
- `/guardian/onboard/[capId]`, `/guardian/attest/[vaultId]`
- `/settings`

Auth gate is a Next.js middleware that checks for a connected wallet (via dApp Kit context). Unauthenticated users are redirected to `/?login=true`.

### Route-level access checks (Move-enforced, validated client-side)

- `/dashboard`: shows only vaults where `vault.owner == currentAddress`
- `/guardian/attest/[vaultId]`: shows only if user owns a `GuardianCap` for that vault
- `/claim/[vaultId]`: shows if user's zkLogin sub matches `beneficiary_zk_sub` OR if no pre-binding (anyone can attempt — but only the bound beneficiary will succeed at decrypt time)

These client-side checks are **UX hints only**. The authoritative checks are in Move (`seal_approve_release`, `attest`).

---

## 10. Error Handling and User Feedback

| Error class | UX |
|---|---|
| Wallet not connected | Modal: "Connect a wallet" |
| Network down | Toast: "Network error. Retrying..." with exponential backoff |
| PTB fails (transient) | Auto-retry up to 3× then surface |
| PTB fails (permanent) | Modal with error code lookup, link to error doc |
| Walrus upload fails | Fallback to alternate publisher; surface if all fail |
| Seal key server timeout | Continue with remaining servers; need only t of n |
| Decryption denied | "Vault is not yet unlocked. Conditions: 1/2 met." |
| Insufficient gas (owner-paid TXs only) | Surface "Get SUI from faucet" link |

### Error code mapping

Move error codes from `keepra::errors` are mapped to user-facing messages in `lib/errors.ts`:

```ts
export const MoveErrorMap: Record<number, string> = {
  0: "Access denied. The vault's release conditions are not yet met.",
  1: "Only the vault owner can perform this action.",
  2: "You are not a guardian for this vault.",
  3: "Guardian capability mismatch.",
  4: "This vault has been revoked.",
  // ...
};
```

---

## 11. Accessibility

| Concern | Mitigation |
|---|---|
| Keyboard navigation | Radix UI primitives ship with full keyboard support |
| Screen readers | Semantic HTML; ARIA labels on critical actions |
| Color contrast | WCAG AA enforced via Tailwind theme tokens |
| Reduced motion | `prefers-reduced-motion` respected in all animations |
| Translations | i18n scaffolded but English-only in MVP |

---

## 12. Performance

| Concern | Tactic |
|---|---|
| Initial bundle size | Code-split per route; Seal/Walrus SDKs only loaded on /create, /claim, /recover |
| Time-to-interactive | Static landing pages prerendered; app shell hydrates lazily |
| Crypto in Web Worker | Heavy Seal operations off-main-thread |
| Blob caching | TanStack Query 60s TTL on aggregator GETs |
| Image optimization | `next/image` for marketing pages |

Target: Lighthouse > 90 for marketing, > 80 for app shell.

---

## 13. Open-Source + Reproducible Builds (v1+)

To make the "platform cannot decrypt" claim verifiable:

- Frontend is open-source on GitHub
- Each deployment publishes a SHA256 hash of the built bundle
- Sui Walrus Sites deployment (Phase 14 stretch) mirrors the frontend on Walrus itself — judges can verify the served bundle matches the repo

These are documented in [Security.md](./Security.md) as part of the threat-model mitigations.

---

## 14. Mobile (PWA)

The frontend is PWA-installable:

- Manifest declares standalone display
- Service worker caches static assets and the app shell
- Offline mode shows a friendly "you're offline" page
- Push notifications (v1+) wake the user for heartbeat-due reminders

Native mobile app is **explicitly out of scope** for MVP. v2+ in [Roadmap.md](./Roadmap.md).

---

## See also

- [Architecture.md](./Architecture.md) — system architecture this frontend talks to
- [Flows.md](./Flows.md) — sequence diagrams for every UX flow
- [Backend.md](./Backend.md) — the backend services the frontend calls
- [TechStack.md](./TechStack.md) — exact library versions
