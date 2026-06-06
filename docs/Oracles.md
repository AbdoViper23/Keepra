# Oracles

> Keepra's oracle architecture. The **DAO Release Oracle** is built first. All other oracle designs are **future work** — designs only, to be refined once the team decides on the decentralization model.

---

## 1. What is an "Oracle" in Keepra?

In Keepra, an **oracle** is anything that produces an on-chain signal that `seal_approve_release` can read as evidence that a release condition is met.

The MVP has three release conditions:

| Condition           | Source of truth                | Oracle needed?                           |
| ------------------- | ------------------------------ | ---------------------------------------- |
| **Inactivity**      | On-chain heartbeat timestamp   | No (purely on-chain)                     |
| **Guardian quorum** | On-chain attestation count     | No (purely on-chain)                     |
| **DAO release**     | External DAO governance result | **Yes — this is the DAO Release Oracle** |

Future conditions (post-MVP) require new oracles:

| Future condition                       | Oracle                                       |
| -------------------------------------- | -------------------------------------------- |
| "User is legally deceased"             | Death certificate oracle                     |
| "An obituary appeared in trusted news" | News scraper + AI oracle                     |
| "Government record indicates death"    | VitalChek / SSA API oracle                   |
| "Trusted attorney attests release"     | Single-attestor oracle                       |
| "Absolute time has passed"             | Sui Clock (already on-chain — not an oracle) |

This file documents the DAO Release Oracle in detail, then sketches future oracle designs at the level needed to iterate on decentralization.

---

## 2. The DAO Release Oracle (MVP+)

### 2.1 Purpose

Allow a user to configure a **DAO governance proposal** as one of the release conditions for their vault. When the DAO passes a release proposal, the vault unlocks.

### 2.2 Why this is the right business choice

The DAO Release Oracle has **three strategic advantages** over other oracle types:

| Reason                                   | Detail                                                                                                                                         |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Business model**                       | DAOs and protocol foundations have treasuries and budget for succession infrastructure. They are the most willing-to-pay customers for Keepra. |
| **Easiest to decentralize**              | The DAO itself is already decentralized — Keepra just reads its on-chain state. No new trust assumptions.                                      |
| **Demo-friendly**                        | "DAO votes to release founder's keys" is an immediately understandable, dramatic story for reviewers.                                          |
| **Composes with existing Sui ecosystem** | Sui has Multisig, Move-based governance modules, custom DAO frameworks — Keepra plugs into all of them via adapters.                           |

Contrast with future oracles (death certificates, government APIs, AI verification) which require **new trust assumptions** Keepra hasn't yet decided on.

### 2.3 Core mechanism

```
   User configures DAO at vault seal time:
       vault.dao_id = Some(dao_object_id)
       vault.dao_threshold = Some(quorum_value)
                  │
                  ▼
   Later, a DAO member proposes release:
       keepra::dao_release::propose(vault_id, dao_id)
                  │
                  ▼
       DAO members vote per the DAO's normal governance flow
                  │
                  ▼
       Proposal passes (≥ threshold votes)
                  │
                  ▼
   DAO adapter calls:
       keepra::dao_adapter_X::execute_release(req, log, voting_result, clock)
                  │
                  ▼
       Adapter verifies the DAO's pass conditions
                  │
                  ▼
       Adapter calls dao_release::set_released_internal
                  │
                  ▼
       HeartbeatLog.dao_released = true
                  │
                  ▼
       seal_approve_release now permits decryption
```

### 2.4 The Adapter Pattern

Different DAOs (Sui Multisig, Move-based governance modules, custom DAOs) have different internal structures. Keepra ships an **adapter interface**: each DAO type has its own adapter module that knows how to verify that DAO's proposal pass conditions.

```
                       ┌────────────────────────────┐
                       │ keepra::dao_release        │
                       │   - propose                 │
                       │   - set_released_internal   │ ← package-visibility only
                       └──────────┬─────────────────┘
                                  ▲
                                  │ called by
                  ┌───────────────┼────────────────┐
                  │               │                │
   ┌──────────────┴─┐  ┌──────────┴────────┐  ┌────┴──────────────────┐
   │ dao_adapter_   │  │ dao_adapter_      │  │ dao_adapter_          │
   │ simple_voting  │  │ sui_multisig      │  │ governance_framework  │
   └────────────────┘  └───────────────────┘  └───────────────────────┘
```

Each adapter:

1. Takes a DAO-specific proof object as input
2. Verifies the proof matches a passed proposal targeting this vault
3. Calls `dao_release::set_released_internal`

This pattern means **Keepra doesn't need to ship its own DAO framework** for the MVP. Users can configure any Sui-native DAO they already use.

### 2.5 The MVP adapter: `keepra_simple_voting`

For the demo, Keepra ships a minimal "SimpleVoting" Move module that any user can deploy in 30 seconds:

```move
module keepra::simple_voting;

public struct VotingDAO has key {
    id: UID,
    name: String,
    members: vector<address>,
    threshold: u64,
}

public struct VotingProposal has key {
    id: UID,
    dao_id: ID,
    target: ID,                 // The DAOReleaseRequest object
    yes_votes: vector<address>,
    no_votes: vector<address>,
    executed: bool,
}

public entry fun create_dao(
    name: String,
    members: vector<address>,
    threshold: u64,
    ctx: &mut TxContext,
) {
    let dao = VotingDAO {
        id: object::new(ctx),
        name, members, threshold,
    };
    transfer::share_object(dao);
}

public entry fun propose(
    dao: &VotingDAO,
    target: ID,
    ctx: &mut TxContext,
) {
    let sender = tx_context::sender(ctx);
    assert!(vector::contains(&dao.members, &sender), ENotMember);
    let prop = VotingProposal {
        id: object::new(ctx),
        dao_id: object::id(dao),
        target,
        yes_votes: vector::empty(),
        no_votes: vector::empty(),
        executed: false,
    };
    transfer::share_object(prop);
}

public entry fun vote(
    dao: &VotingDAO,
    prop: &mut VotingProposal,
    yes: bool,
    ctx: &TxContext,
) {
    let sender = tx_context::sender(ctx);
    assert!(vector::contains(&dao.members, &sender), ENotMember);
    assert!(prop.dao_id == object::id(dao), EWrongDAO);
    assert!(!prop.executed, EAlreadyExecuted);

    // Idempotent
    if (!vector::contains(&prop.yes_votes, &sender)
        && !vector::contains(&prop.no_votes, &sender)) {
        if (yes) {
            vector::push_back(&mut prop.yes_votes, sender);
        } else {
            vector::push_back(&mut prop.no_votes, sender);
        }
    }
}

public fun has_passed(prop: &VotingProposal, dao: &VotingDAO): bool {
    (vector::length(&prop.yes_votes) as u64) >= dao.threshold
}
```

And the adapter:

```move
module keepra::dao_adapter_simple_voting;

use keepra::dao_release::{Self, DAOReleaseRequest};
use keepra::heartbeat::HeartbeatLog;
use keepra::simple_voting::{Self, VotingDAO, VotingProposal};
use sui::clock::Clock;

public entry fun execute_release(
    req: &mut DAOReleaseRequest,
    log: &mut HeartbeatLog,
    dao: &VotingDAO,
    prop: &VotingProposal,
    clock: &Clock,
) {
    // Verify the proposal targets this release request
    assert!(simple_voting::proposal_target(prop) == object::id(req), EWrongProposal);
    // Verify the proposal has passed
    assert!(simple_voting::has_passed(prop, dao), EProposalNotPassed);

    // Forward to the protected internal function
    dao_release::set_released_internal(req, log, clock);
}
```

### 2.6 Sui Multisig adapter (post-MVP stretch)

For users with a Sui-native Multisig wallet, the adapter would verify that a specific multisig threshold has signed an "approve release" message. This requires reading multisig signatures from the proposal transaction; deferred to v1.

### 2.7 Owner control: revocable until execution

The vault owner retains the right to **revoke the vault** until the moment `dao_release::set_released_internal` is called. After execution:

- `HeartbeatLog.dao_released = true` is irreversible
- The owner can still call `revoke_vault`, which sets `revoked = true` and **takes precedence** in `seal_approve_release`'s evaluation order

This means: even after a DAO approves release, the owner has a small window to revoke before the beneficiary actually claims. After the first successful claim, the data has been seen and revocation is moot.

### 2.8 Owner notification of DAO proposals

When `DAOReleaseProposed` event fires, the indexer's DAO event relayer immediately emails the vault owner ("DAO X has proposed releasing your vault. You have until the proposal passes to revoke if this was unexpected.") This is the owner's safety net against malicious DAO members.

### 2.9 Business model angle

| Customer                                  | Pain                                           | Keepra offering                                                            |
| ----------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------- |
| Sui Foundation, Mysten Labs               | Founder/admin succession                       | Encrypt admin keys; release on board multisig                              |
| Protocol foundations (Aave, Uniswap, ...) | Treasury continuity if multisig signers vanish | Encrypt recovery procedures; release on community DAO vote                 |
| DAO treasurers                            | Emergency unlock procedures                    | Same                                                                       |
| Web3 startups (Y Combinator–style)        | Cap table succession; co-founder recovery      | Encrypt continuity instructions; release on investor + co-founder multisig |

Each of these is a "Keepra Enterprise" deal — sales motion is high-touch but ACV is in the thousands of dollars/year per vault. See [Roadmap.md](./Roadmap.md) for monetization.

---

## 3. Future Oracle Designs (NOT in MVP)

These designs are **sketches** to align team thinking. Each is documented at the level of "what would the trust model be and how would it be decentralized?" — not buildable code.

The user has flagged that **decentralization is the priority** for these oracles. The designs below favor decentralized constructions even where simpler centralized alternatives exist.

### 3.1 Death Certificate Oracle

**Goal:** Release the vault when the user is legally deceased.

**Naive design:** A trusted third party (Keepra operator, attorney, family lawyer) attests death via a Move function. **Rejected** — too centralized.

**Decentralized design candidates:**

| Approach                                 | Trust model                                                                        | Decentralization                                        | Complexity | When to consider                                    |
| ---------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------- | ---------- | --------------------------------------------------- |
| **A. m-of-n attestor committee**         | Pool of registered attestors (lawyers, notaries); ≥ m must independently attest    | n attestors collude attack: requires m of them          | Medium     | Post-MVP. Requires attestor onboarding (regulated). |
| **B. TEE-attested government API check** | Nautilus TEE calls VitalChek; produces signed attestation; ≥ m TEEs must agree     | Compromise requires breaking TEE remote attestation     | High       | v2. Requires TEE operator network.                  |
| **C. ZK proof of public obituary**       | Prove (in ZK) that a signed obituary appeared in a trusted news site's RSS feed    | Trust collapses to: did a news site sign that obituary? | Very high  | Research direction.                                 |
| **D. Public attestation period**         | Anyone can submit a "death claim"; bonded; counter-claim period; resolves on-chain | Game-theoretic; requires economic stake design          | Very high  | Optimistic-oracle style; v2+.                       |

**Keepra's likely path (when built):** **Approach A** — m-of-n registered attestor committee — is the right starting point. The attestor set is on-chain and Keepra ships an adapter for it (the same adapter pattern as DAO release). Attestors are registered notaries/lawyers in different jurisdictions. Compromise of any individual attestor doesn't compromise the system; need m colluders.

**Open question:** Who pays the attestors? Likely a one-time fee at vault creation, held in escrow on Sui, released to attestors when they attest (or refunded on revocation).

### 3.2 AI Verification Oracle

**Goal:** Release if an AI verifies certain evidence (e.g., "this PDF is a real death certificate", "this obituary matches this person").

**Naive design:** Keepra's backend runs an LLM; produces a signed attestation. **Rejected** — centralized inference.

**Decentralized design candidates:**

| Approach                                        | Trust model                                                      | Decentralization                                                  | Complexity              |
| ----------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------- |
| **A. Multiple independent inference providers** | k inference services each produce an attestation; ≥ m must agree | k-of-m collusion; same as attestor committee                      | Medium                  |
| **B. TEE-attested inference**                   | Inference runs in attestable TEE; result signed by enclave       | Trusts TEE attestation chain (Intel/AMD/AWS Nitro)                | High                    |
| **C. zkML proofs**                              | Prove model output in zero-knowledge                             | No trust in inference operator; trust in zkML circuit correctness | Very high; cutting-edge |

**Keepra's likely path (when built):** Approach A (multi-provider consensus) for v2; Approach B (TEE inference) for v3 once Nautilus matures.

**Open question:** What is the AI actually evaluating? Likely: "Does this Walrus-stored obituary PDF contain the user's full name in proximity to death-related terms?" — a verifiable claim with low ambiguity.

### 3.3 Government API Oracle

**Goal:** Release if a government death record (VitalChek, SSA Death Master File, state vital records) confirms death.

**Naive design:** Keepra's backend polls VitalChek; produces an attestation. **Rejected** — centralized.

**Decentralized design candidates:**

| Approach                                  | Trust model                                                                                              |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **A. TEE-wrapped API calls**              | Nautilus TEE polls VitalChek with verifiable inputs/outputs; ≥ m TEEs must agree                         |
| **B. Multi-jurisdictional API agreement** | Query VitalChek (US), General Register Office (UK), other national registries; release on any K agreeing |
| **C. ZK proof of API response**           | API signs response; circuit verifies signature → ZK proof on-chain                                       |

**Keepra's likely path (when built):** Approach A (TEE) is most practical; would integrate with Mysten's Nautilus when it ships to mainnet.

**Open question:** API costs (VitalChek charges per query) — who pays? Probably the same escrow model as attestor fees.

### 3.4 News Scraper Oracle

**Goal:** Release if an obituary, press release, or public news article confirms death.

**Decentralized design:**

```
   k federated scrapers running in different jurisdictions
              │
              │ each independently scrapes
              ▼
   ┌─────────────────────────────────────────┐
   │ Each scraper:                            │
   │  - Scrapes a configured news source      │
   │  - Looks for user-provided keywords      │
   │    (full name + death-related terms)     │
   │  - Submits an attestation on-chain       │
   └─────────────────────────────────────────┘
              │
              ▼
   ≥ m scrapers must independently produce
   matching attestations within a time window
              │
              ▼
   On-chain consensus → set dao_released = true (reusing the same flag)
```

**False positive risk:** Common names match many people. Mitigation: user provides hash-of-additional-identifiers at vault creation (date of birth, last 4 digits of SSN); scrapers verify against the article.

**This is the lowest-quality oracle** and would be one of the last shipped. Documented for completeness.

### 3.5 Time-Lock "Oracle"

**Goal:** Release after an absolute future date (e.g., "Open this letter on Jan 1, 2050.")

**Not really an oracle** — it's just an additional condition in `seal_approve_release`:

```move
let time_ok = option::is_some(&vault.unlock_after_ms)
              && now >= *option::borrow(&vault.unlock_after_ms);
```

The Sui `Clock` is already on-chain. No external oracle needed. This is the easiest condition to add (one-line Move change).

**Why not in MVP:** Adds a fourth condition to the OR, which means more UI surface in the wizard. Defer to v1 with a quick add.

---

## 4. Oracle Decentralization Principles (Keepra's stance)

The user has flagged decentralization as the top priority for any oracle Keepra adopts. The design principles below guide all future oracle decisions.

### Principles

1. **No single trusted party.** Any oracle Keepra ships must require collusion of ≥ m parties from ≥ n possible to spoof.
2. **Multi-jurisdictional.** Attestors / TEE operators / scrapers must span jurisdictions. A single-country subpoena cannot force a release.
3. **Economic stake when possible.** Attestors stake WAL or SUI bonds; false attestations get slashed.
4. **Owner override always.** The owner can `revoke_vault` until the moment of first claim, regardless of what any oracle says.
5. **Keepra operator is not an oracle participant.** Keepra ships adapter Move code only; never runs an oracle node.
6. **Auditable on-chain.** Every oracle attestation is an on-chain event; off-chain "the lawyer said so" is never sufficient.

### What Keepra will NEVER ship

- An oracle where Keepra operator alone can trigger release
- An oracle that depends on a single API provider (single point of failure)
- An oracle that requires off-chain trust we can't audit
- An AI oracle with no consensus layer

These constraints are stronger than typical MVP trade-offs, but they preserve **Invariant I1**: the Keepra operator cannot decrypt any vault.

---

## 5. The Oracle Roadmap

| Phase             | Oracle                                           | Status                                      |
| ----------------- | ------------------------------------------------ | ------------------------------------------- |
| **MVP** (Phase 5) | Inactivity + Guardian                            | ✅ On-chain only; no external oracle        |
| **MVP+**          | DAO Release (SimpleVoting adapter)               | 🚧 In progress                              |
| **v1**            | DAO Release (Sui Multisig adapter)               | ⏳ Planned                                  |
| **v1**            | Time-lock (Clock-only, not an oracle)            | ⏳ Planned                                  |
| **v2**            | m-of-n Attestor Committee (Approach A from §3.1) | 🔬 Design phase                             |
| **v2**            | TEE-attested API checks (Nautilus)               | 🔬 Design phase; waits for Nautilus mainnet |
| **v3**            | Multi-provider AI consensus                      | 🔬 Research                                 |
| **v3+**           | News scraper federation                          | 🔬 Research                                 |
| **v4+**           | zkML / ZK API response proofs                    | 🔬 Speculative                              |

---

## 6. Keepra's Oracle SDK (post-MVP)

Once Keepra has 2+ oracle types, we ship an SDK for third parties to build their own adapters:

```ts
// Hypothetical future SDK
import { OracleAdapter } from '@keepra/oracle-sdk';

class MyCustomOracle implements OracleAdapter {
  verifyProof(req: DAOReleaseRequest, proof: MyProof): boolean {
    // ...
  }
}
```

This makes Keepra **extensible**. Any project can build a release-condition oracle and plug it in. Keepra's adapter pattern is structurally designed for this — see [Contracts.md §7](./Contracts.md#7-the-dao-release-module).

---

## 7. Open Questions for the Team

1. **DAO type for the demo:** Should the demo use the SimpleVoting adapter, or hook into a real existing Sui DAO (e.g., a Mysten-operated test DAO)?
2. **Attestor onboarding (v2):** Open registration vs. Keepra-curated list of vetted attestors?
3. **Economic stake (v2):** Bond size and slashing conditions for attestors?
4. **AI provider list (v3):** Which providers (OpenAI, Anthropic, Google) and which model versions?
5. **TEE choice (v2/v3):** Nautilus (Sui-native) vs. AWS Nitro vs. Intel TDX?
6. **Owner-initiated DAO revocation:** Should the owner be able to remove a DAO from the policy post-seal? (Currently: no, by Invariant I2.)

These are deliberately deferred. The MVP scope is **DAO Release Oracle (SimpleVoting adapter) only**.

---

## See also

- [Architecture.md](./Architecture.md) §9 — Oracle architecture overview
- [Contracts.md](./Contracts.md) §7 — DAO release module structure
- [Flows.md](./Flows.md) Flow 9 — DAO release sequence diagram
- [Roadmap.md](./Roadmap.md) — When each oracle ships and why
- [Security.md](./Security.md) — Oracle-specific threat model
