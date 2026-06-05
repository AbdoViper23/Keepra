# Contracts

> Move module structure for the Keepra on-chain package. Module-by-module breakdown with struct definitions, function signatures, events, and the canonical `seal_approve_release` source.

> All code blocks are **illustrative pseudo-Move** showing structure and intent. Production code lives in `move/keepra/sources/`.

---

## 1. Package Layout

```
move/keepra/
├── Move.toml
├── sources/
│   ├── vault.move          # Vault object + create_and_seal + revoke
│   ├── heartbeat.move      # HeartbeatLog + heartbeat function
│   ├── guardian.move       # GuardianCap + attest function
│   ├── beneficiary.move    # BeneficiaryCap + claim helpers
│   ├── dao_release.move    # DAO governance integration (Phase 13)
│   ├── policy.move         # seal_approve_release (the single gateway)
│   ├── events.move         # All event struct definitions
│   └── errors.move         # All error code constants
└── tests/
    ├── vault_tests.move
    ├── heartbeat_tests.move
    ├── guardian_tests.move
    ├── dao_release_tests.move
    ├── policy_tests.move
    └── integration_tests.move
```

---

## 2. Module Dependency Graph

```
                  ┌────────────┐
                  │   errors    │  (constants only)
                  └─────┬──────┘
                        │
                  ┌─────┴──────┐
                  │   events    │
                  └─────┬──────┘
                        │
        ┌───────────────┼────────────┬──────────────┐
        ▼               ▼            ▼              ▼
   ┌─────────┐   ┌──────────┐  ┌─────────┐  ┌────────────┐
   │  vault  │   │heartbeat │  │guardian │  │beneficiary │
   └────┬────┘   └────┬─────┘  └────┬────┘  └──────┬─────┘
        │             │             │              │
        └─────────────┴──────┬──────┴──────────────┘
                             │
                       ┌─────┴──────┐
                       │   policy    │  ← seal_approve_release here
                       └─────┬──────┘
                             │
                       ┌─────┴──────┐
                       │ dao_release │
                       └────────────┘
```

The `policy` module is the **single Seal-facing module**. All `seal_approve_*` functions live here.

---

## 3. The Vault Module

The Vault is the centerpiece. It is **frozen after creation** and never mutated again.

### Vault struct

```move
public struct Vault has key, store {
    id: UID,
    owner: address,                    // recorded at seal time; never re-checked at decrypt
    walrus_blob_id: vector<u8>,        // Walrus content-addressed ID (raw bytes)
    walrus_blob_object_id: Option<ID>, // [Phase 5 as-built] Sui Blob object, for lifetime extension (Phase 9)
    seal_id: vector<u8>,               // IBE identity bytes (typically vault UID)
    threshold: u8,                     // Seal threshold t
    key_server_ids: vector<ID>,        // KeyServer object IDs chosen at seal time (frozen)
    inactivity_seconds: u64,           // Dead-Man Switch window
    guardian_quorum: u8,               // m
    guardian_set: vector<address>,     // n guardians, sorted and deduplicated
    dao_id: Option<ID>,                // Optional: DAO that can vote release
    dao_threshold: Option<u64>,        // Optional: DAO quorum required
    beneficiary_email_hash: vector<u8>,// sha256(email); off-chain notifier reference
    beneficiary_zk_sub: Option<String>,// Optional pre-bound zkLogin OAuth subject hash
    heartbeat_log_id: ID,              // Pointer to mutable sidecar
    version: u64,                      // For future upgrade compatibility
    created_at_ms: u64,
}
```

### `create_and_seal` (entry function)

Mints the Vault, HeartbeatLog, and all GuardianCaps in one atomic transaction, then freezes the Vault.

```move
public entry fun create_and_seal(
    blob_id: vector<u8>,
    seal_id: vector<u8>,
    threshold: u8,
    key_server_ids: vector<ID>,
    inactivity_seconds: u64,
    guardian_set: vector<address>,
    guardian_quorum: u8,
    dao_id: Option<ID>,
    dao_threshold: Option<u64>,
    beneficiary_email_hash: vector<u8>,
    beneficiary_zk_sub: Option<String>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    // Validate inputs
    assert!(guardian_quorum > 0, EInvalidQuorum);
    assert!((guardian_quorum as u64) <= vector::length(&guardian_set), EQuorumExceedsSet);
    assert!(inactivity_seconds > 0, EInvalidInactivity);
    assert!(threshold > 0 && threshold <= (vector::length(&key_server_ids) as u8), EInvalidThreshold);

    // Mint HeartbeatLog (mutable sidecar; shared so guardians can attest)
    let log = heartbeat::new(
        object::new(ctx),
        tx_context::sender(ctx),
        clock::timestamp_ms(clock),
        ctx,
    );
    let log_id = object::id(&log);

    // Mint Vault
    let vault = Vault {
        id: object::new(ctx),
        owner: tx_context::sender(ctx),
        walrus_blob_id: blob_id,
        seal_id,
        threshold,
        key_server_ids,
        inactivity_seconds,
        guardian_quorum,
        guardian_set,
        dao_id,
        dao_threshold,
        beneficiary_email_hash,
        beneficiary_zk_sub,
        heartbeat_log_id: log_id,
        version: 1,
        created_at_ms: clock::timestamp_ms(clock),
    };
    let vault_id = object::id(&vault);

    // Mint a GuardianCap for each guardian, transferred to a holding address
    // (the holding address is derived deterministically; Keepra holds no keys for it)
    let i = 0;
    while (i < vector::length(&guardian_set)) {
        let guardian_addr = *vector::borrow(&guardian_set, i);
        let cap = guardian::mint_cap(vault_id, guardian_addr, ctx);
        transfer::transfer(cap, holding_address_for(vault_id));
        i = i + 1;
    };

    // Emit event for off-chain indexer
    event::emit(events::VaultCreated {
        vault_id,
        owner: tx_context::sender(ctx),
        blob_id: vault.walrus_blob_id,
        heartbeat_log_id: log_id,
        created_at_ms: vault.created_at_ms,
    });

    // Share the HeartbeatLog so anyone can read (guardians can attest)
    transfer::share_object(log);

    // FREEZE the vault — this is the immutability lock
    transfer::public_freeze_object(vault);
}
```

### `revoke_vault` (entry function)

The only "edit" allowed. Permanently destroys all future decryption authority.

```move
public entry fun revoke_vault(
    log: &mut HeartbeatLog,
    ctx: &TxContext,
) {
    assert!(tx_context::sender(ctx) == heartbeat::owner(log), ENotOwner);
    assert!(!heartbeat::is_revoked(log), EAlreadyRevoked);
    heartbeat::set_revoked(log);
    event::emit(events::VaultRevoked {
        vault_id: heartbeat::vault_id(log),
        revoked_at_ms: heartbeat::current_time_ms(log),
    });
}
```

### `mark_triggered` (entry function)

Convenience flag flipped by the trigger daemon. **Does not control decryption** — `seal_approve_release` re-checks all conditions live.

```move
public entry fun mark_triggered(
    log: &mut HeartbeatLog,
    reason: u8,
    clock: &Clock,
    ctx: &TxContext,
) {
    // Idempotent
    if (heartbeat::is_triggered(log)) return;
    heartbeat::set_triggered(log, reason, clock::timestamp_ms(clock));
    event::emit(events::VaultTriggered {
        vault_id: heartbeat::vault_id(log),
        reason,
        triggered_at_ms: clock::timestamp_ms(clock),
    });
}
```

### Vault accessor functions (read-only, used by policy module)

```move
public fun id(v: &Vault): ID { object::id(v) }
public fun walrus_blob_id(v: &Vault): &vector<u8> { &v.walrus_blob_id }
public fun seal_id(v: &Vault): &vector<u8> { &v.seal_id }
public fun heartbeat_log_id(v: &Vault): ID { v.heartbeat_log_id }
public fun inactivity_seconds(v: &Vault): u64 { v.inactivity_seconds }
public fun guardian_quorum(v: &Vault): u8 { v.guardian_quorum }
public fun guardian_set(v: &Vault): &vector<address> { &v.guardian_set }
public fun dao_id(v: &Vault): &Option<ID> { &v.dao_id }
public fun version(v: &Vault): u64 { v.version }
```

---

## 4. The Heartbeat Module

The mutable sidecar that tracks liveness and attestations.

### HeartbeatLog struct

```move
public struct HeartbeatLog has key {
    id: UID,
    vault_id: ID,
    owner: address,
    last_heartbeat_ms: u64,
    revoked: bool,
    triggered: bool,
    trigger_reason: u8,                // 0=none, 1=inactivity, 2=guardian-quorum, 3=dao
    attestations: vector<address>,     // distinct guardians who have attested
    dao_released: bool,                // set by dao_release::execute
}
```

### Constructor (called from vault::create_and_seal)

```move
public(package) fun new(
    id: UID,
    owner: address,
    now_ms: u64,
    ctx: &mut TxContext,
): HeartbeatLog {
    HeartbeatLog {
        id,
        vault_id: /* set externally */,
        owner,
        last_heartbeat_ms: now_ms,
        revoked: false,
        triggered: false,
        trigger_reason: 0,
        attestations: vector::empty(),
        dao_released: false,
    }
}
```

### `heartbeat` (entry function)

```move
public entry fun heartbeat(
    log: &mut HeartbeatLog,
    clock: &Clock,
    ctx: &TxContext,
) {
    assert!(tx_context::sender(ctx) == log.owner, ENotOwner);
    assert!(!log.revoked, EVaultRevoked);
    assert!(!log.triggered, EVaultTriggered);
    log.last_heartbeat_ms = clock::timestamp_ms(clock);
    event::emit(events::Heartbeat {
        vault_id: log.vault_id,
        timestamp_ms: log.last_heartbeat_ms,
    });
}
```

### Accessors

```move
public fun vault_id(log: &HeartbeatLog): ID { log.vault_id }
public fun owner(log: &HeartbeatLog): address { log.owner }
public fun last_heartbeat_ms(log: &HeartbeatLog): u64 { log.last_heartbeat_ms }
public fun is_revoked(log: &HeartbeatLog): bool { log.revoked }
public fun is_triggered(log: &HeartbeatLog): bool { log.triggered }
public fun attestations(log: &HeartbeatLog): &vector<address> { &log.attestations }
public fun is_dao_released(log: &HeartbeatLog): bool { log.dao_released }
```

### Setters (package-visibility; used only by other Keepra modules)

```move
public(package) fun set_revoked(log: &mut HeartbeatLog) { log.revoked = true; }
public(package) fun set_triggered(log: &mut HeartbeatLog, reason: u8, ms: u64) {
    log.triggered = true; log.trigger_reason = reason;
}
public(package) fun set_dao_released(log: &mut HeartbeatLog) { log.dao_released = true; }
public(package) fun add_attestation(log: &mut HeartbeatLog, who: address) {
    if (!vector::contains(&log.attestations, &who)) {
        vector::push_back(&mut log.attestations, who);
    }
}
```

---

## 5. The Guardian Module

### GuardianCap struct

```move
public struct GuardianCap has key {
    id: UID,
    vault_id: ID,
    guardian: address,  // intended recipient (set at mint time)
}
```

> Note: `GuardianCap` deliberately has only the `key` ability (not `store`). This prevents it being wrapped in another object and transferred indirectly. Once delivered to the guardian's address, it can only be used in `attest`.

### `mint_cap` (package-visibility)

Called from `vault::create_and_seal` once per guardian.

```move
public(package) fun mint_cap(
    vault_id: ID,
    guardian: address,
    ctx: &mut TxContext,
): GuardianCap {
    GuardianCap {
        id: object::new(ctx),
        vault_id,
        guardian,
    }
}
```

### `attest` (entry function)

```move
public entry fun attest(
    cap: &GuardianCap,
    log: &mut HeartbeatLog,
    clock: &Clock,
    ctx: &TxContext,
) {
    let sender = tx_context::sender(ctx);
    assert!(sender == cap.guardian, ENotGuardian);
    assert!(cap.vault_id == heartbeat::vault_id(log), ECapMismatch);
    assert!(!heartbeat::is_revoked(log), EVaultRevoked);

    heartbeat::add_attestation(log, sender);
    event::emit(events::GuardianAttested {
        vault_id: cap.vault_id,
        guardian: sender,
        timestamp_ms: clock::timestamp_ms(clock),
    });
}
```

### Properties enforced

- Only the address holding the cap can attest
- Attestation is idempotent (per-address dedup in `HeartbeatLog`)
- Cannot attest a revoked vault
- Cannot transfer the cap to another address (no `store` ability)

---

## 6. The Beneficiary Module

### BeneficiaryCap struct

```move
public struct BeneficiaryCap has key {
    id: UID,
    vault_id: ID,
    beneficiary: address,
}
```

The beneficiary cap is **optional** — in the MVP, a vault can have `beneficiary_zk_sub` set instead, and the beneficiary's identity is checked at claim time via zkLogin address derivation. The cap pattern is for advanced users who want to pre-bind to a specific Sui address.

### Claim helper (not strictly required for MVP)

The actual claim happens off-chain (the beneficiary reconstructs the DEK via Seal). On-chain, there's nothing to call — but for audit and idempotency, the beneficiary can mark their claim:

```move
public entry fun mark_claimed(
    log: &mut HeartbeatLog,
    clock: &Clock,
    ctx: &TxContext,
) {
    // Anyone can mark — this is just an audit signal
    event::emit(events::VaultClaimed {
        vault_id: heartbeat::vault_id(log),
        claimant: tx_context::sender(ctx),
        timestamp_ms: clock::timestamp_ms(clock),
    });
}
```

---

## 7. The DAO Release Module

Integrates with a DAO governance system. The DAO calls `execute` after a proposal passes; this flips `HeartbeatLog.dao_released = true`.

### Design choice: Adapter pattern

Different DAOs (Sui native multi-sig, Move-based governance, custom Keepra-shipped DAO) have different proposal structures. Keepra ships an **adapter interface**: each DAO type has its own adapter module that calls `dao_release::set_released_internal`.

### Minimal `dao_release` module

```move
public struct DAOReleaseRequest has key {
    id: UID,
    vault_id: ID,
    dao_id: ID,
    proposed_at_ms: u64,
    executed: bool,
}

public entry fun propose(
    vault_id: ID,
    dao_id: ID,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let req = DAOReleaseRequest {
        id: object::new(ctx),
        vault_id,
        dao_id,
        proposed_at_ms: clock::timestamp_ms(clock),
        executed: false,
    };
    event::emit(events::DAOReleaseProposed {
        vault_id,
        dao_id,
        proposal_id: object::id(&req),
        proposed_at_ms: clock::timestamp_ms(clock),
    });
    transfer::share_object(req);
}

/// Called by a DAO adapter once the DAO governance has passed the proposal.
/// The adapter is responsible for verifying the DAO's pass conditions.
public(package) fun set_released_internal(
    req: &mut DAOReleaseRequest,
    log: &mut HeartbeatLog,
    clock: &Clock,
) {
    assert!(!req.executed, EAlreadyExecuted);
    assert!(req.vault_id == heartbeat::vault_id(log), EVaultMismatch);
    req.executed = true;
    heartbeat::set_dao_released(log);
    event::emit(events::DAOReleaseApproved {
        vault_id: req.vault_id,
        dao_id: req.dao_id,
        timestamp_ms: clock::timestamp_ms(clock),
    });
}
```

### Adapter for a hypothetical "SimpleVoting" DAO

```move
module keepra::dao_adapter_simple_voting;

public entry fun execute_release(
    req: &mut DAOReleaseRequest,
    log: &mut HeartbeatLog,
    voting_result: &simple_voting::Result,  // hypothetical DAO type
    clock: &Clock,
) {
    assert!(simple_voting::passed(voting_result), EProposalNotPassed);
    assert!(simple_voting::proposal_target(voting_result) == object::id(req), EWrongProposal);
    dao_release::set_released_internal(req, log, clock);
}
```

The full DAO integration design (which adapters to ship, how to handle untrusted DAOs, what happens if a DAO releases the same vault twice) is in [Oracles.md](./Oracles.md).

---

## 8. The Policy Module (`seal_approve_release` lives here)

This is the **single Seal-facing module**. Key servers will only allow PTBs that call `seal_approve_*` functions in this package.

> **As-built note (Phase 4).** The identity is bound to `vault.seal_id` (a client-generated random 32-byte nonce stored in the frozen Vault), **not** `bcs::to_bytes(object::id(vault))`. Reason: on Sui you cannot know a vault's object ID before the tx that creates it, so encrypt-to-object-id + create-in-one-PTB is impossible with a frozen vault. The `seal_id` approach is collision-safe (32 random bytes, namespaced by `packageId` inside Seal) and lets encryption happen before creation. The implemented function also extracts a `public(package) fun approve_release(...): bool` pure predicate (for unit testing) that `seal_approve_release` wraps with `assert!(..., ENoAccess)`. The pseudo-code below is the original design intent; the shipped source lives in `move/keepra/sources/policy.move`.

### `seal_approve_release` — the canonical Move source

```move
module keepra::policy;

use std::bcs;
use sui::clock::{Self, Clock};
use sui::object;
use keepra::vault::{Self, Vault};
use keepra::heartbeat::{Self, HeartbeatLog};
use keepra::errors::ENoAccess;

/// THE single gateway. Seal key servers dry-run this function.
///
/// Conventions enforced by Seal:
/// - `entry`, not public
/// - Must be prefixed `seal_approve_`
/// - First parameter is the identity `id: vector<u8>`
/// - Must take a Clock argument
/// - Side-effect-free; no state mutation
/// - Deterministic across full nodes
entry fun seal_approve_release(
    id: vector<u8>,
    vault: &Vault,
    log: &HeartbeatLog,
    clock: &Clock,
) {
    // 1. Bind the requested identity to this vault's UID
    let expected_id = bcs::to_bytes(&object::id(vault));
    assert!(id == expected_id, ENoAccess);

    // 2. Cross-reference vault and heartbeat log
    assert!(object::id(vault) == heartbeat::vault_id(log), ENoAccess);

    // 3. Revocation kills decryption forever
    assert!(!heartbeat::is_revoked(log), ENoAccess);

    // 4. Evaluate release conditions (OR-composition)
    let now = clock::timestamp_ms(clock);
    let inactive_ok = now >= heartbeat::last_heartbeat_ms(log)
                            + vault::inactivity_seconds(vault) * 1000;
    let quorum_ok = (vector::length(heartbeat::attestations(log)) as u8)
                    >= vault::guardian_quorum(vault);
    let dao_ok = heartbeat::is_dao_released(log);

    assert!(inactive_ok || quorum_ok || dao_ok, ENoAccess);
}
```

### Why this is the only function

Seal allows multiple `seal_approve_*` functions, but Keepra deliberately ships **one**. Reasons:

1. **Simpler audit surface.** One function = one set of conditions to reason about.
2. **No accidental over-permission.** If a developer adds a second function with looser conditions, attackers could call it instead.
3. **All conditions OR-composed in one place.** Adding a new condition is a Move edit; not a new function.

### Future: `seal_approve_view_metadata` (Phase 14+)

A second, more permissive function could let beneficiaries fetch _metadata_ (e.g., the beneficiary letter, separately encrypted with a different identity) without unlocking the main vault. Deferred to v2.

---

## 9. The Events Module

All events emitted by Keepra, in one place for clarity.

```move
module keepra::events;

public struct VaultCreated has copy, drop, store {
    vault_id: ID,
    owner: address,
    blob_id: vector<u8>,
    heartbeat_log_id: ID,
    created_at_ms: u64,
}

public struct Heartbeat has copy, drop, store {
    vault_id: ID,
    timestamp_ms: u64,
}

public struct GuardianAttested has copy, drop, store {
    vault_id: ID,
    guardian: address,
    timestamp_ms: u64,
}

public struct VaultTriggered has copy, drop, store {
    vault_id: ID,
    reason: u8,
    triggered_at_ms: u64,
}

public struct VaultRevoked has copy, drop, store {
    vault_id: ID,
    revoked_at_ms: u64,
}

public struct DAOReleaseProposed has copy, drop, store {
    vault_id: ID,
    dao_id: ID,
    proposal_id: ID,
    proposed_at_ms: u64,
}

public struct DAOReleaseApproved has copy, drop, store {
    vault_id: ID,
    dao_id: ID,
    timestamp_ms: u64,
}

public struct VaultClaimed has copy, drop, store {
    vault_id: ID,
    claimant: address,
    timestamp_ms: u64,
}
```

### Event consumption

The off-chain indexer subscribes to all of these via `suiClient.subscribeEvent({ filter: { Package: KEEPRA_PKG } })` and mirrors them into Postgres for fast queries. See [Backend.md](./Backend.md).

---

## 10. The Errors Module

```move
module keepra::errors;

const ENoAccess: u64 = 0;
const ENotOwner: u64 = 1;
const ENotGuardian: u64 = 2;
const ECapMismatch: u64 = 3;
const EVaultRevoked: u64 = 4;
const EVaultTriggered: u64 = 5;
const EAlreadyRevoked: u64 = 6;
const EInvalidQuorum: u64 = 7;
const EQuorumExceedsSet: u64 = 8;
const EInvalidInactivity: u64 = 9;
const EInvalidThreshold: u64 = 10;
const EProposalNotPassed: u64 = 11;
const EWrongProposal: u64 = 12;
const EAlreadyExecuted: u64 = 13;
const EVaultMismatch: u64 = 14;
```

Error codes are stable across versions; new codes append to the end. They're encoded into transaction abort responses for off-chain error mapping.

---

## 11. The Capability Pattern

Keepra uses Sui's idiomatic **capability pattern**: rights are encoded as owned objects (`*Cap`) whose ownership grants the right to call specific functions.

### Capabilities in Keepra

| Cap                         | Owner         | Grants                                         |
| --------------------------- | ------------- | ---------------------------------------------- |
| `GuardianCap`               | Each guardian | Call `guardian::attest` for one specific vault |
| `BeneficiaryCap` (optional) | Beneficiary   | Mark vault as claimed (audit only)             |

### Why this pattern wins

| Property                  | How achieved                                                                                    |
| ------------------------- | ----------------------------------------------------------------------------------------------- |
| **Unforgeable**           | Caps are created only inside `vault::create_and_seal`; no other function can mint them          |
| **Transferable** (or not) | We choose `key`-only abilities to prevent transfer; v1 may add `store` for trustless delegation |
| **Type-safe**             | Move's type system prevents using a `GuardianCap` where a `BeneficiaryCap` is expected          |
| **Auditable**             | Cap ownership shows up in `getOwnedObjects`; provable on-chain history                          |

### What we explicitly don't use

| Anti-pattern                   | Why avoided                                           |
| ------------------------------ | ----------------------------------------------------- |
| `owner: address` field check   | Fragile; doesn't compose; doesn't transfer cleanly    |
| Allowlist table in Vault       | Mutability complications; Vault is frozen             |
| ECDSA signature checks in Move | Off-chain key management; Sui's native auth is better |

---

## 12. Upgrade Strategy

### Testnet: upgradable

For the hackathon build, the Move package upgrade authority is held by a single dev key. This allows rapid iteration (fix bugs, add conditions, refine `seal_approve_release`).

**Risk:** A malicious package upgrade could loosen `seal_approve_release` and let attackers decrypt arbitrary vaults. Mitigated by:

- All Keepra vaults created on testnet are not production data
- Frontend shows "TESTNET — DO NOT STORE REAL SECRETS"

### Mainnet: immutable (post-audit)

For mainnet launch, the package upgrade authority is set to **none** (no further upgrades possible). This is done via `sui::package::make_immutable`.

**Trade-off:** Bugs cannot be patched. So:

- External audit required before mainnet deploy
- All known issues fixed and re-tested on testnet
- Mainnet has a "v2" path: if a critical bug is found, deploy a new package and migrate (which requires guardians/beneficiaries to re-seal)

### Versioning

The Vault struct includes a `version: u64` field. `seal_approve_release` could in future check the version to apply different rules per version — but for MVP, all vaults are v1 and the field is forward-compatibility insurance.

---

## 13. Testing Strategy

### Move-level tests (in `tests/`)

| Test file                | Coverage                                                                                                  |
| ------------------------ | --------------------------------------------------------------------------------------------------------- |
| `vault_tests.move`       | `create_and_seal` happy path; validates frozen state; guardian set bounds                                 |
| `heartbeat_tests.move`   | Heartbeat updates; owner check; revoked vault rejection                                                   |
| `guardian_tests.move`    | Attest happy path; cap forgery resistance; idempotency                                                    |
| `dao_release_tests.move` | Propose + execute; double-execution prevention                                                            |
| `policy_tests.move`      | `seal_approve_release` for each release condition; OR composition; identity binding                       |
| `integration_tests.move` | Full lifecycle: create → heartbeat → guardians attest → seal_approve passes → revoke → seal_approve fails |

### Integration tests (off-chain)

- Encrypt → Walrus upload → Move call → Seal decrypt → byte-equality round-trip
- Negative: revoked → access denied
- Negative: too few attestations → access denied
- Negative: too-fresh heartbeat → access denied

### Property-based tests (optional, v1+)

Generate random vault parameters and assert:

- Decryption is permitted iff at least one condition is satisfied
- Decryption is denied if revoked
- Heartbeat after creation always extends the window

---

## 14. Gas Estimates (approximate, mainnet)

| Operation                                   | Approximate gas      |
| ------------------------------------------- | -------------------- |
| `create_and_seal` (3 guardians, no DAO)     | ~3M MIST             |
| `create_and_seal` (with DAO)                | ~3.5M MIST           |
| `heartbeat`                                 | ~700K MIST           |
| `heartbeat` + extend_blob                   | ~1.5M MIST           |
| `attest`                                    | ~800K MIST           |
| `mark_triggered`                            | ~600K MIST           |
| `revoke_vault`                              | ~600K MIST           |
| `dao_release::propose`                      | ~1M MIST             |
| `dao_release::execute` (via adapter)        | ~1.2M MIST           |
| `seal_approve_release` (dry-run, off-chain) | N/A — no gas charged |

Daemon and DAO-execute transactions are paid by Keepra ops budget. User-facing transactions (claim, attest) are paid by Enoki sponsorship. Owner-paid: vault creation (one-time) and heartbeat (recurring).

---

## See also

- [Architecture.md](./Architecture.md) — system-level view
- [Flows.md](./Flows.md) — how these contracts are used in each flow
- [Security.md](./Security.md) — threat model for the contracts
- [TechStack.md](./TechStack.md) — exact Move framework version and dependencies
