# Roadmap

> Keepra's evolution from MVP to long-lived protocol. Each phase has a concrete deliverable, scope boundary, and business model implication.

---

## Roadmap at a Glance

```
   MVP        v1          v2           v3+
  ──────  ───────────  ──────────   ──────────────
  MVP        Pre-product  Production   Protocol + SDK
  ──────  ───────────  ──────────   ──────────────
  6 weeks   3 months     6-12 months  18+ months
```

| Phase                 | Focus                                              | Status              |
| --------------------- | -------------------------------------------------- | ------------------- |
| **MVP** (Phases 0–13) | 3 release conditions, working end-to-end           | 🚧 In progress      |
| **v1**                | Templates, mainnet, monetization                   | 📅 Planned post-MVP |
| **v2**                | Decentralized oracles, advanced policies, mobile   | 🔬 Design           |
| **v3**                | Protocol SDK, third-party integrations, governance | 🔬 Research         |
| **vN**                | Keepra-as-public-infrastructure                    | 🔮 Vision           |

---

## MVP (6 weeks)

### Scope

The 15 small testable phases from the engineering plan. The first 5 produce a working end-to-end MVP; the next 8 add UX and polish; the last 2 are stretch goals.

| #   | Phase                    | Owner | Days | Deliverable                                           |
| --- | ------------------------ | ----- | ---- | ----------------------------------------------------- |
| 0   | Setup                    | E4    | 1    | Green CI                                              |
| 1   | Move skeleton            | E1    | 2    | Vault struct compiles, basic create                   |
| 2   | Heartbeat                | E1    | 1    | heartbeat() works on testnet                          |
| 3   | Guardian                 | E1    | 2    | attest() with cap                                     |
| 4   | Seal integration         | E2    | 3    | Encrypt → decrypt CLI roundtrip                       |
| 5   | **Walrus integration**   | E2    | 2    | **MVP CUTOFF** — full encrypt+upload+download+decrypt |
| 6   | zkLogin + Enoki          | E3    | 3    | Google sign-in → Sui address                          |
| 7   | Vault creation UI        | E3    | 4    | Wizard end-to-end                                     |
| 8   | Beneficiary claim page   | E3    | 4    | Email link → claim → decrypt                          |
| 9   | Heartbeat dashboard      | E3    | 2    | Owner dashboard                                       |
| 10  | Notification daemon      | E4    | 3    | Trigger detection + email                             |
| 11  | Enoki sponsorship        | E2    | 2    | Zero-gas claims                                       |
| 12  | Immutability enforcement | E1    | 2    | Move audits enforce I1–I6                             |
| 13  | DAO release flow         | E1+E2 | 4    | SimpleVoting adapter + UI                             |
| 14  | Demo polish + video      | all   | 3    | Demo-ready                                            |
| 15  | Walrus Sites (stretch)   | E4    | 1    | keepra.wal.app                                        |

### MVP feature set

- Three release conditions: Inactivity, Guardian Quorum, DAO Vote
- Single-file vaults (one payload per vault)
- Manual heartbeat (no auto-detection)
- Google + Apple sign-in via Enoki zkLogin
- Sponsored gas for all beneficiary/guardian actions
- All on testnet
- Frontend hosted on Vercel + optional Walrus Sites mirror

### MVP business model: free

The MVP has no monetization. It proves the technology works and the use cases are real. Monetization starts in v1.

---

## v1 — Pre-Product (Months 1–3 post-MVP)

### Scope

Make Keepra **production-usable** for individual users (not yet enterprise DAOs).

| Theme                    | Features                                                                                                       |
| ------------------------ | -------------------------------------------------------------------------------------------------------------- |
| **Templates**            | Pre-baked vault wizards for: Crypto Inheritance, Family Time Capsule, Personal Documents, Journalist Insurance |
| **Mainnet**              | Deploy Move package to Sui mainnet with immutable upgrade authority; external Move audit                       |
| **Multi-file vaults**    | Walrus Quilt integration: upload videos, photos, multiple files in one vault                                   |
| **Time-locks**           | New release condition: `unlock_after_ms` (absolute time)                                                       |
| **Better mobile UX**     | PWA installable; mobile-first responsive design; push notifications                                            |
| **Owner reminders**      | Email + SMS reminders before inactivity threshold                                                              |
| **`backupKey` recovery** | Printable QR + 24-word mnemonic; recovery page works offline                                                   |
| **Storage payment UX**   | Hide WAL token complexity; one-time fiat payment for storage duration                                          |

### v1 business model: freemium with paid storage

| Tier         | Price     | Features                                                    |
| ------------ | --------- | ----------------------------------------------------------- |
| **Free**     | $0        | 1 vault, 10 MB, 1 year storage, inactivity only             |
| **Personal** | $5/month  | 10 vaults, 1 GB, unlimited storage duration, all conditions |
| **Family**   | $15/month | 25 vaults, 5 GB, shared family dashboard, priority support  |

Pricing rationale:

- Walrus storage costs are absorbed up to tier limits
- Sui gas for heartbeats is sponsored via Enoki
- Margin comes from amortized infrastructure (backend, email, indexer)

**Revenue target Y1**: 1,000 paying users = ~$80K ARR. Modest but proves willingness-to-pay.

### v1 explicit non-goals

- No new oracle types (DAO oracle is enough; future oracles deferred to v2)
- No mobile native app (PWA is the mobile play)
- No browser extension
- No SDK for third parties

---

## v2 — Production (Months 4–12)

### Scope

Scale beyond individuals to **DAOs and enterprises**, and add decentralized oracles.

| Theme                               | Features                                                                                                           |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Decentralized oracles (Tier 1)**  | m-of-n Attestor Committee for death certificates (see [Oracles.md §3.1](./Oracles.md#31-death-certificate-oracle)) |
| **TEE-attested API checks**         | Nautilus TEE for VitalChek / government APIs (waits for Nautilus mainnet)                                          |
| **Sui Multisig adapter**            | DAO release works with native Sui Multisig wallets                                                                 |
| **Boolean policy composition**      | AND/OR Boolean trees in policy (e.g., "Guardian quorum AND time has passed")                                       |
| **Shamir secret sharing**           | Split a vault across N independent vaults; reconstruct with K                                                      |
| **Hardware wallet support**         | Ledger / hardware wallet integration for signing                                                                   |
| **Browser extension**               | Verified extension that runs encryption locally; removes frontend-hosting attack vector                            |
| **Enterprise dashboard**            | Multi-vault admin UI for DAOs and orgs; bulk operations                                                            |
| **Audit log export**                | Compliance-friendly CSV / PDF audit reports                                                                        |
| **Walrus Sites mirror (mandatory)** | Censorship-resistant frontend at `keepra.wal.app`                                                                  |
| **Reproducible builds**             | Published bundle hashes; community verifiability                                                                   |

### v2 business model: + Enterprise tier

| Tier           | Price          | Customers                        |
| -------------- | -------------- | -------------------------------- |
| **Enterprise** | $500–$5K/month | DAOs, foundations, Web3 startups |

Enterprise features:

- Dedicated DAO release adapters (custom governance integrations)
- White-label deployment
- Compliance review (SOC 2 Type I target)
- Priority audit support
- Dedicated CSM

Enterprise sales motion:

- Direct outreach to top 100 Sui DAOs and foundations
- Co-marketing with Sui Foundation
- Conference presence (Sui Basecamp, KSEA, EthCC)

**Revenue target Y2**: 10 enterprise customers at $2K/mo average = $240K ARR; consumer base at 5,000 users = $400K ARR; total ~$640K ARR.

---

## v3 — Protocol + SDK (Months 13–24)

### Scope

Keepra becomes **infrastructure other projects build on**, not just a consumer product.

| Theme                              | Features                                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------------------------ |
| **Keepra SDK**                     | TypeScript + Rust SDKs for embedding "sealed vault" primitives in other apps                     |
| **Oracle adapter SDK**             | Third parties can ship oracle adapters (e.g., a legal-tech company adds notary attestor adapter) |
| **Move-level integration**         | Other Sui dApps can call `keepra::vault::create_and_seal` directly from their own Move code      |
| **Multi-chain Walrus reads**       | Vaults can be read from non-Sui clients (Walrus is chain-agnostic for retrieval)                 |
| **Cross-vault references**         | A vault can reference another vault (nested release conditions)                                  |
| **Decentralized oracles (Tier 2)** | News scraper federation, multi-provider AI consensus                                             |
| **Vault marketplace**              | (Optional, business-decision-dependent) Pre-built guardian services from notaries / lawyers      |

### v3 business model: + Protocol fees + B2B SDK licensing

| Source                    | Mechanism                                                                                                  |
| ------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Protocol fee              | Small fee on every vault creation (e.g., 0.1 SUI) — split between Keepra DAO treasury and oracle attestors |
| SDK licensing             | Free for open-source; paid commercial license for closed-source enterprises                                |
| Custom oracle development | Bespoke oracle adapters for large customers                                                                |

**Revenue target Y3**: $2M+ ARR (mix of consumer, enterprise, and protocol fees).

---

## vN — Keepra-as-Public-Infrastructure

### Vision

Keepra becomes the **standard primitive** for any application needing "conditional release of encrypted data." Examples:

- A Web2 password manager uses Keepra under the hood for emergency access
- A legal-tech platform uses Keepra for will execution
- A journalism tool uses Keepra for whistleblower dead-man switches
- A DAO governance framework uses Keepra for treasury succession

At this stage, Keepra the company is no longer the only operator. The protocol is governed by a Keepra DAO; the Move package is upgradable only by DAO vote.

### Open questions for vN

- Token? (Probably no token in MVP/v1/v2; protocol fees in SUI/WAL suffice. vN may justify a Keepra token for governance.)
- Foundation? (Keepra Foundation as a non-profit holding the protocol's reserves.)
- Audit subsidy fund? (Pool that pays for ongoing audits as the codebase evolves.)

---

## Protocol Phase

Keepra's "protocol phase" is the moment when the Move package stops being upgradable and becomes a fixed primitive. This happens at the end of v1:

- Move package authority renounced (`sui::package::make_immutable`)
- All future changes require deploying a new package and migrating
- Stability and audit-confidence are the priority over rapid iteration

After protocol phase:

- The package becomes a "Schelling point" — other projects can rely on it not changing under them
- Third-party SDKs become safer to build
- The protocol is genuinely censorship-resistant (no upgrade key to subpoena)

---

## SDK Phase

The SDK phase begins in v3. The product split:

| Layer                                     | Audience                                                    |
| ----------------------------------------- | ----------------------------------------------------------- |
| **Protocol** (Move package)               | Anyone, on-chain                                            |
| **SDK** (`@keepra/sdk`)                   | Developers embedding sealed vaults in their apps            |
| **Backend services** (operated by Keepra) | Developers who don't want to run their own indexer/notifier |
| **Consumer app** (`keepra.app`)           | End users                                                   |

The SDK lets a developer:

```ts
import { KeepraClient } from "@keepra/sdk";

const keepra = new KeepraClient({ network: "mainnet" });

// Create a vault
const vault = await keepra.createVault({
  payload: encryptedBytes,
  policy: { inactivity: { seconds: 30 * 86400 }, guardians: { addresses: [...], quorum: 2 } },
  beneficiary: { email: "heir@example.com" },
});

// Claim a vault
const plaintext = await keepra.claim(vaultId);
```

The SDK abstracts Seal + Walrus + Sui + Enoki into one API.

---

## DAO and Oracle Expansion

Per [Oracles.md](./Oracles.md), oracle types ship in waves:

| Wave              | Oracles                     | When                   | Decentralization                     |
| ----------------- | --------------------------- | ---------------------- | ------------------------------------ |
| Wave 1 (MVP+)     | DAO Release (SimpleVoting)  | MVP                    | DAO itself is decentralized          |
| Wave 2 (v1)       | DAO Release (Sui Multisig)  | Month 1–3              | Same                                 |
| Wave 3 (v2)       | m-of-n Attestor Committee   | Month 6–12             | Multi-attestor, multi-jurisdictional |
| Wave 4 (v2)       | TEE-attested API (Nautilus) | After Nautilus mainnet | TEE + multi-operator                 |
| Wave 5 (v3)       | News scraper federation     | Year 2                 | Federated scrapers                   |
| Wave 6 (v3+)      | Multi-provider AI consensus | Year 2+                | Multi-provider consensus             |
| Wave 7 (research) | zkML, ZK API proofs         | Speculative            | Best-in-class                        |

Each wave maintains the principle: **no single trusted party can trigger release**.

---

## Business Model Evolution

```
   MVP         v1              v2                v3+
  ──────  ─────────────  ────────────────  ────────────────────
   Free   Freemium       + Enterprise      + Protocol fees
                         ($500-5K/mo)      + SDK licensing
                                           + Custom oracles
```

| Phase | Primary revenue                      | Target ARR    |
| ----- | ------------------------------------ | ------------- |
| MVP   | None (demo)                          | $0            |
| v1    | Subscriptions ($5–15/mo)             | $80K          |
| v2    | + Enterprise ($2K avg/mo)            | $640K         |
| v3    | + Protocol fees + SDK licensing      | $2M+          |
| vN    | Public infrastructure (DAO-governed) | DAO-allocated |

---

## What Keepra Will Never Do

These are explicit non-goals — design commitments to the user:

- **Never hold decryption keys**: would break Invariant I1 (operator cannot decrypt)
- **Never serve ads in vaults or claim pages**: violates the trust model
- **Never sell user data**: we have very little (email hashes, addresses) and never sell what we have
- **Never lock the protocol behind a token**: protocol works without any Keepra token
- **Never gate critical features behind paid tiers**: cryptographic primitives are always free; we charge for convenience (storage, support, enterprise features)
- **Never add backdoors for governments**: there are no backdoors to add — the cryptography prevents it

These commitments are part of the brand.

---

## Geographic & Regulatory Roadmap

| Phase | Jurisdictions                    | Compliance focus                                         |
| ----- | -------------------------------- | -------------------------------------------------------- |
| MVP   | Anywhere (no compliance)         | Testnet                                                  |
| v1    | US, EU, Canada, UK               | RUFADAA tier 1 ("online tool"); GDPR; UK Data Protection |
| v2    | + APAC (Singapore, Japan, Korea) | PDPA, local crypto regulations                           |
| v3    | Global                           | MiCA compliance (EU); future US digital-asset laws       |

Compliance posture: Keepra is an **infrastructure provider**, not a custodian. We do not hold user funds or keys. Our regulatory burden is closer to that of an email provider than a wallet service.

---

## Open Strategic Questions (deferred decisions)

1. **Token or no token?** — Lean: no token through v2. Reconsider at v3 if governance benefits outweigh complexity.
2. **Foundation timing?** — Form Keepra Foundation at v2 if external funding raises require it.
3. **Open-source license?** — Backend & frontend: MIT or Apache 2. Move package: should be Apache 2 with patent grant.
4. **Mobile app?** — PWA in v1, native in v3 only if PWA performance is insufficient.
5. **Partnerships?** — Co-market with Sui Foundation in v1, with Walrus Foundation in v1.
6. **Self-host option?** — At v2, offer enterprise self-hosting for compliance-sensitive customers.

---

## See also

- [README.md](../README.md) — project overview
- [Architecture.md §13](./Architecture.md#13-production-grade-concerns-deferred-to-post-mvp) — production concerns deferred to v1+
- [Oracles.md §5](./Oracles.md#5-the-oracle-roadmap) — oracle-specific roadmap
- `internal/` (gitignored) — team-only planning notes
