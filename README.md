# Keepra

> **Programmable Conditional Release Infrastructure**
> Built on Sui · Seal · Walrus

**Live Demo:** [keepra.vercel.app](https://keepra.vercel.app)

Keepra is the first system that lets a user encrypt arbitrary data — letters, recovery instructions, structured credentials, founder keys, evidence — and have decryption be **mathematically gated** by on-chain conditions. Once sealed, no party (not even Keepra) can read the data. Only the cryptography decides when, how, and to whom it opens.

---

## 1. The Core Idea

Today, "digital legacy," "dead-man switches," and "founder succession" are all served by centralized custodians: Trust & Will, Casa, SafeBeyond, SecureDrop, password-manager emergency contacts. Every one of them has the same structural flaw — **a company holds the keys**. Subpoena, bankruptcy, insider compromise, ToS change, or pivot, and the data is exposed or lost.

Keepra removes the custodian entirely.

The user encrypts client-side. The ciphertext lives on Walrus. The release policy lives in a Move smart contract. The decryption keys are derived by an independent t-of-n committee of Seal key servers — and **only** when the Move policy evaluates true. There is no Keepra-held master key, no admin override, no "trust us" layer.

That is what we mean by _programmable conditional release infrastructure_: encryption with a programmable trigger, distributed trust at every layer, and zero ability for the operator to comply with a subpoena or be coerced by a state actor.

---

## 2. Why Sui + Seal + Walrus

This stack is the **only one** that makes the full vision possible today.

| Layer             | Primitive                   | What it makes possible                                                                                                                                                                                                                                          |
| ----------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Policy**        | Sui Move objects            | The release rules are a programmable on-chain object — composable, auditable, versioned. PTBs let creation, encryption-binding, and beneficiary minting happen in one atomic transaction.                                                                       |
| **Authorization** | Seal threshold IBE          | Decryption keys are derived only when a Move `seal_approve_*` function returns success under a dry run on each key server's full node. No platform-side key. No collusion below the threshold.                                                                  |
| **Storage**       | Walrus                      | Ciphertext lives on a Byzantine-fault-tolerant network of ~100 nodes across 19 countries with verifiable availability proofs. Subpoena-resistant, geographically distributed, cryptographically content-addressed.                                              |
| **Onboarding**    | zkLogin + Enoki _(planned)_ | A beneficiary signs in with Google — no wallet, no seed phrase, no SUI needed. The grieving spouse or the heir gets access through a familiar OAuth flow with sponsored gas. _(The current build uses a standard Sui wallet; zkLogin/Enoki is on the roadmap.)_ |

On any other chain you can build _parts_ of this — Lit Protocol on EVM gives you programmable decryption, IPFS gives you (volunteer) storage, ENS gives you a name. **No other ecosystem snaps the four pieces together as cleanly, with sub-second finality and Move's type-system guarantees on the policy layer.**

---

## 3. Main Use Cases

Keepra is a horizontal primitive. The launch wedges:

### 3.1 Crypto inheritance (consumer wedge)

A user prepares structured recovery instructions — exchange names, account references, hardware-wallet metadata, contact for the family attorney — and the beneficiary (typically a spouse or child) is notified only when the dead-man switch trips. **Keepra never stores raw seed phrases**; the structured-reference template avoids creating a single-point-of-theft. See [Security.md](./docs/Security.md#no-raw-seeds-policy).

### 3.2 Founder & DAO succession (B2B wedge)

A founder seals admin keys, multisig recovery information, and emergency runbook. Release is gated on **a DAO governance vote** — if the community formally votes to invoke succession (typically because the founder has been unreachable for N weeks), the vault opens to a pre-named board multisig. This is the first product that turns DAO governance into a _recovery oracle_. See [Architecture.md § DAO Release](./docs/Architecture.md#dao-release-oracle).

### 3.3 Whistleblower & journalist insurance

A source encrypts evidence + context. Conditions: 72-hour heartbeat OR multi-journalist quorum. If the source goes silent, the named journalists receive a claim notification. Different posture from SecureDrop — Keepra adds a programmable, automatic _publication insurance_ layer.

### 3.4 Family time capsules

Letters and videos for a child's future birthdays. Released when a dead-man condition trips, or (future, post-MVP) when a time-lock expires.

### 3.5 Personal documents

Will pointers, insurance policies, safety-deposit-box codes, executor instructions. Same Dead-Man Switch primitive, smaller payloads.

---

## 4. Quick Architecture Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                       USER DEVICE (trust zone)                   │
│  Plaintext exists only here. Browser does Seal encryption.       │
└──────────────────────┬──────────────────────────────────────────┘
                       │ Only ciphertext leaves the device
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│                    PUBLIC INFRASTRUCTURE                          │
│  ┌───────────┐    ┌─────────────────┐    ┌────────────────────┐ │
│  │  Walrus   │    │ Sui Move        │    │ Seal Key Servers   │ │
│  │(ciphertext│    │ (policy + state)│    │ (t-of-n threshold) │ │
│  │  blobs)   │    │                 │    │                    │ │
│  └───────────┘    └─────────────────┘    └────────────────────┘ │
└──────────────────────┬──────────────────────────────────────────┘
                       │ Threshold of t servers cooperate iff
                       │ Move seal_approve_release returns success
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│                  BENEFICIARY DEVICE (trust zone)                  │
│  Receives key shares, reconstructs DEK, decrypts ciphertext.     │
└──────────────────────────────────────────────────────────────────┘
```

**Three release conditions in v1** (combinable via simple OR):

1. **Inactivity (Dead-Man Switch)** — owner fails to heartbeat within `inactivity_seconds`.
2. **Guardian Quorum** — `m` of `n` named guardians attest release.
3. **DAO Vote** — a governance proposal on a configured DAO passes (decentralized recovery for DAOs and founder-led protocols).

The vault is **immutable after sealing**. The only mutation is `revoke()` — the owner's one-way escape hatch that permanently destroys access.

Full details: [Architecture.md](./docs/Architecture.md).

---

## 5. Repository Structure

```
keepra/
├── apps/
│   ├── web/                    # Next.js dApp (App Router) — UI, wallet, client-side Seal/Walrus
│   │   ├── app/                # routes: / · create · dashboard · vault/[id] · claim/[vaultId] · dao · api/rpc
│   │   ├── components/keepra/  # views + UI: wizard, dashboard, vault detail, claim, DAO console, nav
│   │   ├── hooks/              # data + tx hooks: useVault(s), useCreateVault, useClaim, useVaultActions, useDao
│   │   ├── lib/                # sui client, seal, walrus, ptb builders, payload codec, vault parsing, errors
│   │   └── stores/             # client-side wizard state
│   ├── shared/                 # @keepra/shared — Walrus HTTP client, runtime config, shared types
│   └── api/                    # off-chain services (notifications / indexer) — planned
├── move/keepra/
│   ├── sources/                # vault · heartbeat · guardian · policy · events · simple_voting · dao_release · dao_adapter_simple_voting
│   └── tests/                  # Move unit tests
├── tools/seal-roundtrip/       # CLI: encrypt → Walrus → seal on-chain → attest → fetch → decrypt (integration check)
└── docs/                       # architecture, flows, contracts, security, …
```

The repo is a **pnpm workspace**. The frontend reaches Sui through a same-origin RPC proxy (`app/api/rpc`) that forwards to a **Tatum** Sui gateway when configured, and falls back to a public fullnode otherwise.

---

## 6. Running Locally

```bash
# 1. Install (pnpm workspace)
pnpm install

# 2. Contracts — build + run the Move tests
cd move/keepra && sui move test

# 3. Frontend env
cp apps/web/.env.example apps/web/.env.local
#   - NEXT_PUBLIC_KEEPRA_PACKAGE_ID : the testnet package id (see § Status)
#   - TATUM_API_KEY (optional)      : routes Sui RPC through the Tatum gateway;
#                                     leave blank to use the public fullnode
#   - Walrus + Seal endpoints come pre-filled with testnet defaults

# 4. Run the dApp
pnpm --filter @keepra/web dev        # → http://localhost:3000
```

Creating and claiming vaults requires a **funded Sui testnet wallet** (e.g. Slush).

---

## 7. Documentation Map

| File                                      | What's in it                                                                                                                                                                |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [README.md](./README.md)                  | You are here. Project overview and entry point.                                                                                                                             |
| [Architecture.md](./docs/Architecture.md) | Full system architecture: on-chain vs off-chain, Move object model, Seal integration, Walrus integration, zkLogin/Enoki, policy engine, DAO oracle design, guardian system. |
| [Flows.md](./docs/Flows.md)               | End-to-end user flows with Mermaid sequence diagrams: create vault, heartbeat, trigger, claim, decryption, guardian attest, DAO release.                                    |
| [Contracts.md](./docs/Contracts.md)       | Move modules, struct definitions, capability pattern, `seal_approve_*` design, events, upgrade strategy.                                                                    |
| [Frontend.md](./docs/Frontend.md)         | Frontend architecture, pages, components, upload/claim UX, zkLogin integration, client-side encryption pipeline.                                                            |
| [Backend.md](./docs/Backend.md)           | Off-chain services: indexer, notification daemon, oracle relayer, Walrus upload relay, event listeners.                                                                     |
| [Security.md](./docs/Security.md)         | Threat model, threshold-encryption assumptions, oracle risks, collusion analysis, endpoint compromise, no-raw-seeds policy, abuse prevention.                               |
| [Roadmap.md](./docs/Roadmap.md)           | MVP → v1 → v2 → protocol phase → SDK phase → DAO/oracle expansion.                                                                                                          |
| [TechStack.md](./docs/TechStack.md)       | Exact libraries, SDK versions, infra choices, frontend + backend + Move stack.                                                                                              |

---

## 8. Status

Keepra is built as a series of small, individually-testable phases. The on-chain primitive and the full client flow run **end-to-end on Sui testnet**.

**Working today (testnet):**

- Move package deployed — `vault`, `heartbeat`, `guardian`, `policy`, plus the DAO release modules (`simple_voting`, `dao_release`, `dao_adapter_simple_voting`).
  Package id: `0x2d35cf0d810e5d43df3e8332d7e7a464e44f41cfd644af23ad68efcf901ba7a4`
- Client-side **Seal** encryption/decryption and **Walrus** blob storage, end-to-end.
- Next.js dApp: create-vault wizard, owner dashboard (heartbeat / revoke), beneficiary claim with in-browser decryption, and a DAO release console.
- **All three release conditions live and composable (OR-gated):** inactivity dead-man switch, guardian quorum, and DAO governance vote.
- Sui RPC routed through a Tatum gateway proxy, with a public-fullnode fallback.

**On the roadmap:**

- zkLogin + Enoki onboarding (no-wallet, sponsored-gas beneficiary claim).
- Notification / inactivity daemon and off-chain indexer.
- Mainnet deployment and a third-party security audit.

See [Roadmap.md](./docs/Roadmap.md) for the full phase plan.

---

## 9. License

MIT (planned). All Move modules will be published under an immutable upgrade policy on mainnet after audit.
