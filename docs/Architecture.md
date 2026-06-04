# Keepra — Architecture

> **Audience**: engineers building Keepra. This is the canonical reference for _how the system fits together_. Implementation specifics for Move are in [Contracts.md](./Contracts.md), flows are in [Flows.md](./Flows.md), services in [Backend.md](./Backend.md), UI in [Frontend.md](./Frontend.md).

---

## 1. Design Principles

1. **The platform mathematically cannot decrypt.** Plaintext exists only on user devices. There is no operator key, no master backup, no admin override.
2. **Immutable after sealing.** A `Vault` object is frozen at creation. The only mutation is `revoke()`, which permanently destroys access. There are no "edits."
3. **Distributed trust at every layer.** Walrus storage is BFT-distributed. Seal key servers are an independent t-of-n committee chosen at sealing time. The Move policy is on a public blockchain.
4. **Fail-secret by default.** Every failure mode keeps data encrypted. We never reveal data due to a missing oracle, an offline service, or a buggy notifier.
5. **Web2 onboarding for beneficiaries.** A non-crypto-native heir must be able to claim with a Google sign-in. No seed phrase. No gas.
6. **Modular policy engine.** The release-condition primitives — inactivity, guardian quorum, DAO vote — are independent Move modules combined by a single `seal_approve_release`. Adding a new primitive in v2 (time-lock, multi-DAO, TEE-attested oracle) does not require redesigning the rest.

---

## 2. Trust Zones

```
┌──────────────────────── USER DEVICE ──────────────────────────────┐
│  TRUST: HIGH (the user's own browser/device)                       │
│  HOLDS: Plaintext. The Seal-derived DEK during decryption.         │
│  CRYPTO: Seal SDK + AES-GCM. WebAuthn / wallet signing for auth.   │
└──────────────────────────────────┬─────────────────────────────────┘
                                   │ ONLY CIPHERTEXT crosses this line
                                   ▼
┌──────────────────────── PUBLIC INFRASTRUCTURE ────────────────────┐
│  TRUST: NONE individually; BFT in aggregate                       │
│                                                                    │
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────────┐  │
│  │ Walrus storage  │  │ Sui validators   │  │ Seal key servers│  │
│  │ ~100 nodes / 19 │  │ (Move state)     │  │ t-of-n, indep.  │  │
│  │ countries; BFT  │  │                  │  │ operators       │  │
│  └─────────────────┘  └──────────────────┘  └─────────────────┘  │
└──────────────────────────────────┬─────────────────────────────────┘
                                   │ Threshold of t key shares
                                   │ released iff seal_approve_release
                                   │ succeeds under dry-run
                                   ▼
┌──────────────────────── BENEFICIARY DEVICE ───────────────────────┐
│  TRUST: HIGH (the beneficiary's own browser)                       │
│  HOLDS: Decrypted plaintext (post-claim).                         │
│  Authenticated via zkLogin (Google OAuth → Sui address).          │
└────────────────────────────────────────────────────────────────────┘
```

Keepra the company **never appears in this diagram** as a trust party. Keepra operates services (frontend, indexer, notifier) but none of them is on the cryptographic decryption path.

---

## 3. On-Chain vs Off-Chain Split

### 3.1 On-chain (Sui Move)

**What lives here**: the canonical state of every vault, the release policy, the capability objects that govern guardian/owner rights.

| Responsibility                                                                         | Why on-chain                                                     |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `Vault` object (frozen)                                                                | Must be tamper-proof and globally readable by Seal key servers   |
| `HeartbeatLog` (mutable sidecar)                                                       | Owner heartbeat state must be visible to the policy evaluator    |
| `GuardianCap` (per-guardian capability)                                                | Capability pattern enforces "only the right guardian can attest" |
| `DaoLinkage` (per-vault DAO oracle binding)                                            | The policy must be able to query the linked DAO's proposal state |
| `seal_approve_release` (entry function)                                                | The single source of truth for "can this vault open right now?"  |
| Events: `VaultSealed`, `Heartbeat`, `GuardianAttested`, `DaoTriggered`, `VaultRevoked` | Indexers and notifiers subscribe to these                        |

### 3.2 Off-chain (Keepra services)

**What lives here**: anything that's _not_ required for cryptographic correctness — UX, notifications, performance.

| Responsibility                 | Why off-chain                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------------ |
| Frontend SPA                   | Performance and UX                                                                   |
| Indexer (Postgres)             | Fast queries; on-chain state is authoritative                                        |
| Notification daemon            | Email/SMS for heartbeat reminders, claim alerts                                      |
| Walrus upload relay (optional) | Browser-friendly Walrus uploads (avoids client hitting ~2200 storage nodes directly) |
| Oracle relayer                 | Reads DAO contract state, pushes proof to chain (when needed)                        |
| Enoki sponsor service          | Sponsors beneficiary gas for claim transactions                                      |

**Critical principle**: if any off-chain service is compromised, the worst-case outcome is _denial of service_ — never _unauthorized decryption_. The cryptographic decision (release the keys) is always made by Seal key servers running the Move policy.

---

## 4. The Sui Move Object Model

See [Contracts.md](./Contracts.md) for full struct definitions. Conceptually:

### 4.1 The frozen vault + mutable sidecar pattern

A naive design would put `last_heartbeat_ms` and guardian attestations inside the `Vault` object. But our invariant requires the Vault to be immutable. Solution: split state into two objects.

```
┌─────────────────────────────┐         ┌──────────────────────────┐
│   Vault (FROZEN)            │         │ HeartbeatLog             │
│   ─────────────────────     │ ──ID──▶ │   (shared, mutable)      │
│   walrus_blob_id            │         │ ──────────────────────── │
│   seal_id                   │         │   last_heartbeat_ms      │
│   threshold, key_servers    │         │   attestations[]         │
│   inactivity_seconds        │         │   dao_release_triggered  │
│   guardian_set, quorum      │         │   revoked, owner_triggered│
│   beneficiary_zk_sub        │         └──────────────────────────┘
│   dao_linkage_id (opt)      │
│   heartbeat_log_id          │
└─────────────────────────────┘
```

`seal_approve_release` takes both as **immutable references** (`&Vault`, `&HeartbeatLog`). Mutating functions (`heartbeat`, `attest`, `dao_trigger`, `revoke`) take `&mut HeartbeatLog` only — the Vault is never touched after sealing.

### 4.2 Capability pattern

```
GuardianCap   ─── minted at seal time, transferred to guardian address
                  required to call attest()
                  cannot be forged (Move type system)

OwnerCap      ─── implicit: tx_context::sender == vault.owner
                  required for heartbeat() and revoke()

ReclaimCap    ─── minted at seal time, transferred to beneficiary address
                  (zkLogin-derivable in advance)
                  proof-of-right at claim time
```

### 4.3 Why frozen objects work for `seal_approve_release`

Per Sui docs: an immutable object can be accessed by all network participants in parallel and passed as `&T` (immutable reference) to entry functions. This is exactly what we need — Seal key servers run `dry_run_transaction_block` calling `seal_approve_release(id, &vault, &log, &clock)` and they all read the same canonical state.

The single caveat: Move package upgrades can change the policy _code_. Mitigation: after audit, publish the mainnet package with an immutable upgrade policy (irrevocable). See [Contracts.md § Upgrade Strategy](./Contracts.md#upgrade-strategy).

---

## 5. Seal Integration (The Cryptographic Core)

> **Seal is not an encryption library bolted onto Keepra. It is the policy-enforcement substrate.** Every release decision is a Seal decision, made by independent operators running our Move code on their own full nodes.

### 5.1 What Seal gives us

| Seal property                       | What we use it for                                                                                                          |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Identity-Based Encryption (IBE)** | Encrypt to a vault's `UID` — the same identity is derivable client-side at any future date without server-side coordination |
| **Threshold (t-of-n)**              | Privacy holds while < t servers are compromised; liveness holds while ≥ t are available                                     |
| **Move-defined access policy**      | The `seal_approve_*` Move convention turns _"can this client decrypt?"_ into _"does this Move function abort?"_             |
| **Hybrid KEM/DEM construction**     | Encrypt small DEK with IBE; AES-GCM-encrypt large payload with DEK; one envelope on Walrus                                  |
| **Optional `backupKey` return**     | User-side recovery if all key servers vanish; see [§9 Recovery Design](#9-recovery-design)                                  |

### 5.2 The `seal_approve_release` convention

Each Keepra vault is created with a single Seal identity. **As-built (Phase 4):** the identity is `vault.seal_id` — a client-generated random 32-byte nonce committed into the frozen Vault — rather than `bcs::to_bytes(vault.id)`, because a vault's object ID isn't known until the creation tx executes (so it can't be the encryption identity in a single-PTB frozen-vault flow). The Move package exposes one entry function:

```move
entry fun seal_approve_release(
    id: vector<u8>,
    vault: &Vault,
    log: &HeartbeatLog,
    clock: &Clock,
)
```

When a beneficiary wants to decrypt, the frontend builds a Programmable Transaction Block (PTB) calling this function (in `onlyTransactionKind` mode — no execution) and submits it to each chosen key server. Each server independently performs `dry_run_transaction_block` against its own Sui full node. If `seal_approve_release` returns without aborting, the server releases its share of the IBE key.

**The check inside `seal_approve_release` is exactly one logical statement**:

```move
let inactive_ok = clock.timestamp_ms() >= log.last_heartbeat_ms + vault.inactivity_seconds * 1000;
let quorum_ok   = (vector::length(&log.attestations) as u8) >= vault.guardian_quorum;
let dao_ok      = log.dao_release_triggered;

assert!(!log.revoked, ENoAccess);
assert!(inactive_ok || quorum_ok || dao_ok, ENoAccess);
```

That's the **entire policy engine**. Adding a new condition in v2 (time-lock, TEE oracle, external attestation) means adding one more `let xxx_ok = ...` and ORing it in.

### 5.3 Key server selection

Seal testnet now exposes two complementary server types — Keepra uses both:

1. **Decentralized Committee Server** (primary, recommended). A single logical server backed by a 3-of-5 MPC committee operated by Mysten Labs, Natsai, Overclock, NodeInfra, and Ruby Nodes. From the SDK's perspective it counts as **one** server in `SealClient.serverConfigs`; the internal 3-of-5 split is hidden from the app. Aggregator URL: `https://seal-aggregator-testnet.mystenlabs.com`.
2. **Independent Open-Mode Servers**. Ten verified operators (Mysten 1/2, Ruby, NodeInfra, Mirai, Overclock, H2O, Triton, Natsai, Mhax.io). No API key needed in `Open` mode; each counts as one server.

Keepra's two configurations:

| Config     | Server set                                          | App-level threshold | When used                                                                  |
| ---------- | --------------------------------------------------- | ------------------- | -------------------------------------------------------------------------- |
| **Simple** | Committee only                                      | `threshold: 1`      | Phase 4 CLI roundtrip; quickest path to a working demo                     |
| **Hybrid** | Committee + 2 independents (e.g., Ruby + NodeInfra) | `threshold: 2` of 3 | Phase 7 onward; stronger pitch — committee compromise alone cannot decrypt |

The server set is **chosen at sealing time and frozen into the Vault object** — per Seal's design, the committee cannot be rotated after encryption. Exact Object IDs and URLs live in [Seal-Config.md](../Seal-Config.md) (the canonical source) and are mirrored in [TechStack.md §6](./TechStack.md#6-endpoints-canonical-urls). For higher-paranoia vaults the wizard can extend to Committee + 4 independents at `threshold: 3 of 5`.

### 5.4 Session keys at decryption

A beneficiary's claim flow uses Seal `SessionKey` (TTL = 10 minutes by default). The user signs a personal message that authorizes the session key to make decryption requests on their behalf for that vault and that package. Each key server verifies the session signature before honoring the dry-run authorization. Full flow in [Flows.md § Seal Decryption](./Flows.md#5-seal-decryption-internals).

---

## 6. Walrus Integration (The Storage Substrate)

> **Walrus is where the user's life-or-death data physically lives.** It is not a CDN; it is a Byzantine-fault-tolerant erasure-coded blob store with on-chain availability proofs.

### 6.1 What we store on Walrus

| Blob type                       | Contents                                                    | Typical size |
| ------------------------------- | ----------------------------------------------------------- | ------------ | ---------- | --- | --- | --- | --------------- | ------------ |
| Vault payload                   | Seal-encrypted envelope: `header                            |              | sealed_DEK |     | iv  |     | aes_ciphertext` | 10 KB – 5 MB |
| Letter blob (optional)          | Separately-encrypted "human readable" letter to beneficiary | 1 – 100 KB   |
| Site assets (stretch, Phase 14) | The Keepra SPA itself as a Walrus Site                      | ~5 MB        |

### 6.2 Why Walrus, not S3 / IPFS / Arweave

| Property                         | S3               | IPFS                | Arweave | **Walrus**       |
| -------------------------------- | ---------------- | ------------------- | ------- | ---------------- |
| BFT durability                   | ❌ single vendor | ⚠️ pinning required | ✅      | ✅               |
| Native Sui object representation | ❌               | ❌                  | ❌      | ✅ `Blob` object |
| On-chain lifetime management     | ❌               | ❌                  | partial | ✅ via Move      |
| Verifiable availability proof    | ❌               | ❌                  | ❌      | ✅               |
| Pairs natively with Seal IBE     | ❌               | ❌                  | ❌      | ✅               |

### 6.3 Storage lifecycle

1. **Encrypt** client-side (Seal hybrid envelope).
2. **PUT** to Walrus publisher (`PUT /v1/blobs?epochs=N`) — Keepra's MVP runs through a public publisher; production deploys an in-house publisher for rate-limit independence.
3. **Receive** `{ newlyCreated: { blobObject: { blobId, id, endEpoch } } }`.
4. **Bind** `blob_id` into the `Vault` Move object at creation; the Vault is now frozen and immutable.
5. **At claim time**: GET from Walrus aggregator (`GET /v1/blobs/{blob_id}`). Multiple fallback aggregators configured.

### 6.4 Lifetime management

On testnet the max storage duration is 53 epochs (1 day each = ~53 days). On mainnet it is 53 epochs of 14 days = ~2 years. We expose a "refresh storage" action that the owner can call to extend lifetime; the wizard offers a 5-year prepaid plan (auto-renewing if owner is alive — see Phase 12 in [Roadmap.md](./Roadmap.md)).

If the owner never renews and is also inactive past `inactivity_seconds`, the vault triggers, beneficiary claims, and the blob is then renewed by the beneficiary if they want to keep accessing it after their initial claim.

### 6.5 No raw-secrets storage

> **This is a Keepra-specific design constraint, not a Walrus property.**

Keepra does **not** ever push raw seed phrases, raw private keys, or raw API tokens into the encrypted payload — even though the encryption would protect them. We use a **structured-reference template** instead. See [Security.md § No-Raw-Seeds Policy](./Security.md#no-raw-seeds-policy) for the full rationale and the template schema.

---

## 7. zkLogin + Enoki Flow

### 7.1 Why this matters

The beneficiary of a Keepra vault is often a _non-crypto-native human_ — a spouse, a child, an attorney. Forcing them to set up MetaMask, buy SUI for gas, and manage a seed phrase to claim their inheritance would defeat the entire product.

zkLogin solves this. The beneficiary signs in with Google (or Apple, Facebook, Twitch). A Sui address is derived deterministically from `(iss, aud, sub_hash, salt)` using a ZK proof — no seed phrase exists. Combined with **Enoki sponsored transactions**, the beneficiary's claim transaction is paid for by Keepra. Total UX: open email → click link → "Sign in with Google" → "Claim" → letters render.

### 7.2 zkLogin identity at sealing time

When the owner creates a vault, they specify the beneficiary by **OAuth subject hash** (not raw email). The hash binds to a future `(iss, aud, sub)` tuple — the same Google account, even if email aliases change. Reasoning:

- Email aliases are mutable; OAuth subjects are stable.
- Hashing avoids leaking the beneficiary's email on-chain.
- At claim time, the frontend recomputes `sub_hash` from the beneficiary's JWT and compares to the on-chain value.

The on-chain field:

```move
public struct Vault has key {
    // ...
    beneficiary_zk_sub: vector<u8>,  // sha256(iss || aud || sub)
    beneficiary_email_hash: vector<u8>,  // sha256(email) — for notifier lookup only
}
```

### 7.3 Enoki sponsorship

Enoki is Mysten's hosted service that combines (a) zkLogin proof generation, (b) sponsored transactions, (c) wallet management for OAuth users. Keepra uses:

- `registerEnokiWallets({ providers: ['google', 'apple'] })` on the frontend → standard `useCurrentAccount()` returns a Sui address derived from the user's Google/Apple sign-in.
- Backend route `/api/sponsor` calls `EnokiClient.createSponsoredTransaction({ network, transactionKindBytes, sender, allowedMoveCallTargets })`. The allowlist is locked to `${KEEPRA_PKG}::policy::seal_approve_release` and the claim-related move calls — defense in depth.

See [Frontend.md § zkLogin](./Frontend.md#zklogin) and [Backend.md § Enoki Sponsor Service](./Backend.md#enoki-sponsor-service).

---

## 8. Policy Engine Design

### 8.1 Modular condition primitives

Each release condition is an independent Move module that exposes a single `is_satisfied` predicate. `seal_approve_release` calls each and ORs the results. This makes the engine extensible without policy-engine rewrites.

```
policy.move         (top-level: seal_approve_release)
   │
   ├─ uses inactivity_check  ── reads HeartbeatLog.last_heartbeat_ms + Vault.inactivity_seconds
   ├─ uses guardian_check    ── reads HeartbeatLog.attestations + Vault.guardian_quorum
   └─ uses dao_check         ── reads HeartbeatLog.dao_release_triggered (set by dao_oracle)
```

### 8.2 v1 conditions

| Condition           | Source of truth                                                                              | Owner-revocable?   |
| ------------------- | -------------------------------------------------------------------------------------------- | ------------------ |
| **Inactivity**      | Owner's heartbeat misses → on-chain check against `Clock`                                    | Yes (heartbeat)    |
| **Guardian Quorum** | m-of-n attestations on `HeartbeatLog.attestations`                                           | Yes (revoke vault) |
| **DAO Vote**        | A linked DAO governance proposal passes (see [§9 DAO Release Oracle](#9-dao-release-oracle)) | Yes (revoke vault) |

A vault MUST configure **at least one** condition. The MVP wizard requires inactivity (the simplest dead-man) and lets the user optionally add guardians and/or a DAO linkage.

### 8.3 v2+ conditions (designed, not built)

- **Time-lock** — release after absolute timestamp (e.g., child's 18th birthday)
- **External oracle attestation** — death certificate, court order, TEE-attested external event
- **Multi-DAO threshold** — k of n DAOs agree
- **Combined Boolean tree** — full AND/OR/NOT composition (current MVP only supports OR)
- **Heartbeat-via-on-chain-activity** — automatically count any signed tx from owner's address as a heartbeat (see [Roadmap.md § Automatic Liveness](./Roadmap.md#v3-automatic-liveness))

See [Roadmap.md](./Roadmap.md) for sequencing.

---

## 9. DAO Release Oracle

> **This is Keepra's headline B2B feature for v1.** It turns DAO governance into a programmable recovery mechanism. The MVP design is built to ship inside the hackathon window.

### 9.1 Use case

Founder of a Sui protocol seals their admin keys + emergency runbook. The release condition: **a successful governance vote on the protocol's DAO**. If the founder vanishes, the community can formally invoke succession; once the vote passes, a pre-named backup multisig can claim the vault.

This is decentralization at the _recovery layer_ — the same DAO that governs the protocol governs its own emergency continuity. No external custodian.

### 9.2 Architecture

```
Owner-side (at seal time):
  Vault.dao_linkage_id ──▶ DaoLinkage object
                            ├─ dao_package_id      (which DAO contract)
                            ├─ dao_object_id       (which DAO instance)
                            ├─ proposal_topic      (a magic bytestring identifying "release vault X")
                            └─ min_quorum          (% of voting power required)

Trigger-side (at trigger time):
  DAO contract emits ProposalPassed event
                            │
                            ▼
  Oracle relayer (off-chain) sees event ── computes that topic matches vault X
                            │
                            ▼
  Calls dao_oracle::trigger_release(&mut HeartbeatLog, &DaoLinkage, &proposal_object)
                            │
                            ▼
  Move function verifies on-chain:
    - The proposal object's topic == DaoLinkage.proposal_topic
    - The proposal status == Passed
    - Voting power threshold met
  Sets log.dao_release_triggered = true
```

### 9.3 The compatibility layer

DAOs on Sui are heterogeneous — there is no single standard. Keepra supports them via an **adapter pattern**:

```move
module keepra::dao_adapter;

// One trait-like interface per supported DAO framework.
// Each adapter does the actual reading and verification.
public fun verify_proposal_passed_v0(
    dao_obj: &SomeDaoObject,
    proposal_id: vector<u8>,
    expected_topic: vector<u8>,
): bool { /* ... */ }
```

For MVP we ship **one adapter** — a vanilla "Keepra-DAO" reference module that's also part of the demo (the demo wallet IS a DAO member who calls `cast_vote` live). For v1 we add adapters for popular Sui DAO frameworks (e.g., Movement, Suins-governed DAOs). v2+ becomes a community contribution model.

### 9.4 What the demo shows

This is **the visual headline of the Sui Overflow pitch**. Three browser windows side-by-side: (1) founder seals vault, (2) DAO members vote on-chain, (3) board-multisig claims the moment the vote passes.

### 9.5 Business model implications

A DAO-treasury succession vault is sold _to the DAO itself_ (B2B), priced at $5k–$50k/year per DAO. Compare to current alternatives (multi-day legal coordination, hardware-wallet hand-offs, "we'll figure it out") — Keepra is the only programmable answer. See [Roadmap.md § Business Model](./Roadmap.md#business-model).

---

## 10. Guardian System

### 10.1 Design

Guardians are _individuals the user trusts to attest the conditions of release have been met_ — typically a spouse, a sibling, a family attorney, a co-founder, a senior community member.

At seal time, the owner specifies `(guardian_set: vector<address>, guardian_quorum: u8)`. Keepra mints one `GuardianCap` per guardian and transfers it to their address.

If an owner specifies guardian addresses for people who don't yet have Sui wallets, the wizard pre-pays for zkLogin onboarding: each guardian receives an email with a link, signs in with Google, and the `GuardianCap` is transferred to their newly-derived zkLogin address (using Enoki).

### 10.2 Attestation flow

A guardian attests by submitting a `guardian::attest(&GuardianCap, &mut HeartbeatLog, &Clock)` transaction. The function:

- Verifies sender owns the cap.
- Verifies cap's `vault_id` matches.
- Appends sender to `HeartbeatLog.attestations` (idempotent — no double-attest).
- Emits `GuardianAttested` event.

When `attestations.length >= guardian_quorum`, the quorum condition is satisfied. The next `seal_approve_release` call from a beneficiary will succeed.

### 10.3 Revocation

While the owner is alive and active, they can revoke a vault (`revoke_vault(&mut HeartbeatLog)`). This sets `log.revoked = true`. Future `seal_approve_release` calls fail at `assert!(!log.revoked)` regardless of attestations. Guardian caps remain — they're capabilities, not authority — but they cannot do anything useful on a revoked log.

### 10.4 Why not just multisig?

A Sui multisig would let m-of-n co-sign a transaction to _transfer_ an asset. That's a different problem. Guardians here are not co-signing a transfer; they are _attesting that the conditions of release are met_. The actual decryption happens client-side, off-chain, by the beneficiary's browser fetching Seal key shares.

The guardian model also degrades gracefully: a single guardian attests → that's logged on-chain but not actionable (quorum not yet met). The owner can still revoke. A multisig has no equivalent in-between state.

---

## 11. Recovery Design

> The killer investor question: **"What if the Seal key servers all die?"**

### 11.1 Layered defenses

| Layer  | Mechanism                                                                                 | In MVP?              |
| ------ | ----------------------------------------------------------------------------------------- | -------------------- |
| **L1** | Diversified key-server committee — pick 3 operators across jurisdictions                  | ✅ default           |
| **L2** | Larger `n` with same `t` — pick `t=2, n=5` for resilience to 3 simultaneous failures      | ✅ opt-in via wizard |
| **L3** | `backupKey` self-custody — user prints QR + 24-word mnemonic at seal time, stores offline | ✅ opt-in via wizard |
| **L4** | Shamir-split the `backupKey` across guardians                                             | v2                   |
| **L5** | Multi-encryption to two disjoint committees                                               | v3                   |

### 11.2 Keepra's stance: fail-secret by default

If the user does not opt into L3 and the chosen committee permanently vanishes, the data is unrecoverable. **This is correct.** A system whose pitch is "the platform mathematically cannot decrypt" cannot have a hidden recovery mechanism — that would be the trapdoor we promised doesn't exist.

The wizard surfaces this with a mandatory checkbox before the seal PTB executes. See [Frontend.md § Wizard](./Frontend.md#wizard).

### 11.3 backupKey UX

Seal's `client.encrypt` returns an optional `backupKey` (32 bytes — the symmetric DEM key). When the user opts in, the wizard:

1. Converts the 32 bytes to a BIP-39-style 24-word mnemonic + a QR code.
2. Renders an HTML page formatted for printing on a single sheet (recovery sheet template).
3. **Discards the backupKey from memory** the moment the user confirms they've stored it.

A separate `/recover` page lets a user paste the mnemonic + provide the Walrus blob ID; the page decrypts entirely in-browser, never sending the key anywhere.

Full flow: [Flows.md § Recovery](./Flows.md#9-recovery-flow-backup-key).

---

## 12. Component Map

For the full component diagram, see [README.md § Quick Architecture](../README.md#4-quick-architecture-summary). Component details below.

### 12.1 Frontend (`apps/web`)

Next.js SPA. Pages: marketing, wizard, dashboard, claim, guardian portal, DAO admin, recovery. Uses `@mysten/sui`, `@mysten/seal`, `@mysten/walrus`, `@mysten/enoki`, `@mysten/dapp-kit`. See [Frontend.md](./Frontend.md).

### 12.2 Backend (`apps/api`)

Fastify on Node. Endpoints: `/sponsor` (Enoki sponsor proxy), `/vaults` (read indexer), `/notify` (webhook into notification queue). See [Backend.md § API](./Backend.md#api-service).

### 12.3 Indexer (`apps/indexer`)

Subscribes to Sui events for the Keepra package. Maintains Postgres tables: `vault_index`, `address_last_activity`, `beneficiary_link`, `notification_queue`. See [Backend.md § Indexer](./Backend.md#indexer).

### 12.4 Notifier (`apps/notifier`)

Cron consuming `notification_queue`. Sends transactional email (SendGrid/SES) for heartbeat reminders, trigger alerts, claim notifications. See [Backend.md § Notifier](./Backend.md#notifier).

### 12.5 Oracle relayer (`apps/relayer`)

Subscribes to DAO contracts. When a tracked proposal passes, calls `dao_oracle::trigger_release` on the relevant vault's `HeartbeatLog`. See [Backend.md § Oracle Relayer](./Backend.md#oracle-relayer).

### 12.6 Move package (`move/keepra`)

Modules: `vault`, `heartbeat`, `guardian`, `dao_oracle`, `dao_adapter`, `policy`. See [Contracts.md](./Contracts.md).

---

## 13. Future Work

(Designed-but-not-built; sequenced in [Roadmap.md](./Roadmap.md))

### 13.1 Automatic on-chain liveness

Heartbeat by _any signed transaction from the owner's address_ instead of an explicit "I'm alive" click. The indexer reads `suix_queryTransactionBlocks({ FromAddress: owner })` and treats the latest tx timestamp as the heartbeat. Multi-chain extension monitors EVM, Solana, Bitcoin addresses for the same purpose.

### 13.2 Time-lock primitive

A simple Move condition: `assert!(clock.timestamp_ms() >= unlock_at_ms)`. Used for time capsules.

### 13.3 Vault templates

Wizard presets: "Crypto inheritance," "Family time capsule," "Whistleblower dead-man," "Founder succession," "Personal documents." Each template prefills sensible defaults for `inactivity_seconds`, `guardian_quorum`, and the structured-reference schema.

### 13.4 External oracles

- TEE-attested oracle (Nautilus) for death-certificate APIs in supported jurisdictions
- AI-attested oracle for "is this evidence still relevant" (Whistleblower flavor)
- Public news-event oracles for emergency leak mode

All of these are out of MVP scope; they share the same `seal_approve_release` interface — the oracle just flips a flag on `HeartbeatLog`, the policy is unchanged.

### 13.5 Boolean policy composition

Move helpers `assert_all`, `assert_any`, `assert_threshold` to build arbitrary AND/OR/NOT trees of conditions.

### 13.6 Walrus Sites deployment

Frontend itself hosted on Walrus at `keepra.wal.app` for censorship-resistance. See [Roadmap.md § Stretch](./Roadmap.md#stretch).

### 13.7 MemWal AI legacy assistant

Optional AI assistant that helps the user describe what to leave behind. The conversation memory is itself encrypted on Walrus via MemWal. Optional, opt-in, gated by the same `seal_approve_release` as the vault.
